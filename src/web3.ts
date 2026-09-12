import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { opBNBTestnet } from "viem/chains";

const ALLOWED_TARGETS = new Set(["USDC", "USDT", "BNB"]);

export function validateHedgeRequest(userWallet: string, target: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(userWallet) && ALLOWED_TARGETS.has(target.toUpperCase());
}

const vaultAbi = [
  { type: "function", name: "executeHedge", inputs: [{ name: "userWallet", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

export async function triggerHedgeTransaction(userWallet: string) {
  if (!validateHedgeRequest(userWallet, "USDC") && !/^0x[0-9a-fA-F]{40}$/.test(userWallet)) throw new Error("bad wallet");
  // ponytail: single relayer key, upgrade ke Session Key+Bundler/Paymaster kalau mainnet
  const account = privateKeyToAccount(process.env.BACKEND_PRIVATE_KEY as `0x${string}`);
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: opBNBTestnet, transport: http(process.env.RPC_URL) });
  const walletClient = createWalletClient({ account, chain: opBNBTestnet, transport: http(process.env.RPC_URL) });
  const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedge", args: [userWallet as `0x${string}`] });
  return walletClient.writeContract(request);
}
