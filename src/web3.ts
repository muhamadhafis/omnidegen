import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const ALLOWED_TARGETS = new Set(["USDC", "USDT", "BNB"]);
export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;

export function validateHedgeRequest(userWallet: string, target: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(userWallet) && ALLOWED_TARGETS.has(target.toUpperCase());
}

const vaultAbi = [
  { type: "function", name: "executeHedgePull", inputs: [{ name: "user", type: "address" }, { name: "amount", type: "uint256" }, { name: "minOut", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
] as const;

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
  const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedgePull", args: [userWallet as `0x${string}`, amount, 0n] });
  return walletClient.writeContract(request);
}
