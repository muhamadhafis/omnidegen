import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const ALLOWED_TARGETS = new Set(["USDC", "USDT", "BNB"]);

export function validateHedgeRequest(userWallet: string, target: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(userWallet) && ALLOWED_TARGETS.has(target.toUpperCase());
}

const vaultAbi = [
  { type: "function", name: "executeHedge", inputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "minOut", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "bnbBalance", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "stableBalance", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export async function getVaultBalances(userWallet: string) {
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
  const [walletBnb, bnb, stable] = await Promise.all([
    publicClient.getBalance({ address: userWallet as `0x${string}` }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "bnbBalance", args: [userWallet as `0x${string}`] }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "stableBalance", args: [userWallet as `0x${string}`] }),
  ]) as [bigint, bigint, bigint];
  return { walletBnb, bnb, stable };
}

export async function triggerHedgeTransaction(userWallet: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(userWallet)) throw new Error("bad wallet");
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
  // cek deposit dulu (gratis, read-only) — berlaku juga untuk mock agar tak ada "rescue palsu"
  const bal = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "bnbBalance", args: [userWallet as `0x${string}`] }) as bigint;
  if (bal === 0n) throw new Error("no deposit");
  // ponytail: mock hash untuk flow test; MOCK_TX=false untuk hedge beneran
  if (process.env.MOCK_TX !== "false")
    return `0xmock${Date.now().toString(16)}${userWallet.slice(2, 10)}` as `0x${string}`;
  // ponytail: single relayer key, upgrade ke Session Key+Bundler/Paymaster kalau mainnet
  const account = privateKeyToAccount(process.env.BACKEND_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(process.env.RPC_URL) });
  // hedge seluruh saldo BNB user di vault (amount_pct dipetakan di kontrak nanti)
  const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedge", args: [userWallet as `0x${string}`, bal, 0n] });
  return walletClient.writeContract(request);
}
