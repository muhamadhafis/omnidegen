import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const ALLOWED_TARGETS = new Set(["USDC", "USDT", "BNB"]);

export function validateHedgeRequest(userWallet: string, target: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(userWallet) && ALLOWED_TARGETS.has(target.toUpperCase());
}

const vaultAbi = [
  { type: "function", name: "executeHedge", inputs: [{ name: "userWallet", type: "address" }], outputs: [], stateMutability: "nonpayable" },
] as const;

export async function triggerHedgeTransaction(userWallet: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(userWallet)) throw new Error("bad wallet");
  // ponytail: mock hash sampai OmniVault deploy di BSC testnet (MOCK_TX=false kalau sudah deploy)
  if (process.env.MOCK_TX !== "false")
    return `0xmock${Date.now().toString(16)}${userWallet.slice(2, 10)}` as `0x${string}`;
  // ponytail: single relayer key, upgrade ke Session Key+Bundler/Paymaster kalau mainnet
  const account = privateKeyToAccount(process.env.BACKEND_PRIVATE_KEY as `0x${string}`);
  const vault = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http(process.env.RPC_URL) });
  const { request } = await publicClient.simulateContract({ account, address: vault, abi: vaultAbi, functionName: "executeHedge", args: [userWallet as `0x${string}`] });
  return walletClient.writeContract(request);
}
