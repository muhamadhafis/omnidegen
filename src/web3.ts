import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

// vault hanya swap ke mUSDC: USDC = satu-satunya target hedge jujur.
// BNB dipertahankan untuk vacuum/defi_batch (DUST->BNB dst, bukan hedge).
const ALLOWED_TARGETS = new Set(["USDC", "BNB"]);
export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;

export function validateHedgeRequest(userWallet: string, target: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(userWallet) && ALLOWED_TARGETS.has(target.toUpperCase());
}

const vaultAbi = [
  { type: "function", name: "executeHedgePull", inputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "minOut", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "router", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "stable", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;

const pancakeRouterAbi = [
  { type: "function", name: "getAmountsOut", inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }], outputs: [{ name: "amounts", type: "uint256[]" }], stateMutability: "view" },
] as const;

// pure + testable: potong quote sesuai toleransi slippage (basis poin, 200 = 2%)
export function applySlippage(quote: bigint, bps: number): bigint {
  if (quote <= 0n) throw new Error("no liquidity");
  if (!(bps >= 0 && bps <= 10_000)) throw new Error("bad slippage");
  return (quote * BigInt(10_000 - bps)) / 10_000n;
}

// pure + testable (client di-inject): tunggu receipt; bedakan mined-sukses,
// revert, dan hilang (timeout). Jangan pernah percaya hash mentah.
export async function confirmTransaction(
  client: { waitForTransactionReceipt(args: { hash: `0x${string}` }): Promise<{ status: string }> },
  hash: `0x${string}`,
  timeoutMs = 60_000,
): Promise<void> {
  const receipt = await Promise.race([
    client.waitForTransactionReceipt({ hash }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`no receipt (${timeoutMs / 1000}s): ${hash}`)), timeoutMs)),
  ]);
  if (receipt.status !== "success") throw new Error(`tx reverted: ${hash}`);
}

// pure + testable: pastikan Tx terlihat di jaringan (bukan cuma di node origin).
export async function checkPropagated(
  getTx: (hash: `0x${string}`) => Promise<unknown>,
  hash: `0x${string}`,
  tries = 3,
  delayMs = 4000,
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      if (await getTx(hash)) return true;
    } catch { /* belum terlihat, coba lagi */ }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

const erc20Abi = [
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export async function getVaultBalances(userWallet: string) {
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
  const [walletBnb, wbnb, allowance, stable] = await Promise.all([
    publicClient.getBalance({ address: userWallet as `0x${string}` }),
    publicClient.readContract({ address: WBNB, abi: erc20Abi, functionName: "balanceOf", args: [userWallet as `0x${string}`] }),
    publicClient.readContract({ address: WBNB, abi: erc20Abi, functionName: "allowance", args: [userWallet as `0x${string}`, vault] }),
    publicClient.readContract({ address: process.env.MUSDC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: "balanceOf", args: [userWallet as `0x${string}`] }),
  ]) as [bigint, bigint, bigint, bigint];
  return { walletBnb, wbnb, allowance, stable };
}

export async function triggerHedgeTransaction(userWallet: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(userWallet)) throw new Error("bad wallet");
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
  // non-custodial: tarik maksimal sebesar allowance (gratis, read-only — berlaku juga untuk mock)
  const [allow, bal] = await Promise.all([
    publicClient.readContract({ address: WBNB, abi: erc20Abi, functionName: "allowance", args: [userWallet as `0x${string}`, vault] }),
    publicClient.readContract({ address: WBNB, abi: erc20Abi, functionName: "balanceOf", args: [userWallet as `0x${string}`] }),
  ]) as [bigint, bigint];
  if (allow === 0n) throw new Error("no approve");
  const amount = allow < bal ? allow : bal;
  if (amount === 0n) throw new Error("no balance");
  // ponytail: mock hash untuk flow test; MOCK_TX=false untuk hedge beneran
  if (process.env.MOCK_TX !== "false")
    return `0xmock${Date.now().toString(16)}${userWallet.slice(2, 10)}` as `0x${string}`;
  // ponytail: single relayer key, upgrade ke Session Key+Bundler/Paymaster kalau mainnet
  const account = privateKeyToAccount(process.env.BACKEND_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(process.env.RPC_URL) });
  // minOut dari quote on-chain (baca router+stable langsung dari vault: anti-drift config)
  const bps = Number(process.env.SLIPPAGE_BPS ?? 200);
  const router = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "router" }) as `0x${string}`;
  const stable = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "stable" }) as `0x${string}`;
  const amounts = await publicClient.readContract({ address: router, abi: pancakeRouterAbi, functionName: "getAmountsOut", args: [amount, [WBNB, stable]] });
  const minOut = applySlippage(amounts[1], bps);
  const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedgePull", args: [userWallet as `0x${string}`, amount, minOut] });
  const hash = await walletClient.writeContract(request);
  const sent = await publicClient.getTransaction({ hash }).catch(() => null);
  if (!sent) throw new Error(`origin tak menyimpan tx: ${hash}`);
  console.log(`[hedge-tx] hash=${hash} nonce=${sent.nonce} fee=${(sent.gasPrice ?? sent.maxFeePerGas)?.toString() ?? "?"}`);
  const fallbacks = [...new Set((process.env.RPC_URL_FALLBACK ?? "https://bsc-testnet-dataseed.bnbchain.org").split(",").map((s) => s.trim()).filter(Boolean))].filter((u) => u !== process.env.RPC_URL);
  if (fallbacks.length > 0) {
    const fb = createPublicClient({ chain: bscTestnet, transport: http(fallbacks[0]) });
    if (!(await checkPropagated((h) => fb.getTransaction({ hash: h }), hash)))
      throw new Error(`tx not propagating (origin ok, relay tak melihat): ${hash}`);
  }
  await confirmTransaction(publicClient, hash);
  return hash;
}
