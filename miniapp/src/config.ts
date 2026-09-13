import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { bscTestnet } from "@reown/appkit/networks";

export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;
export const MUSDC = "0x5930d789bE286F3645BD6678fB8eD1c786c2CE36" as const;
export const VAULT = "0x1B846fb2d2EB2FD83Da5680d0b63CcAee04511C4" as const;
export const BOT_URL = "https://t.me/omnidegen_bot";
export const SCAN_TX = (h: string) => `https://testnet.bscscan.com/tx/${h}`;

const projectId = import.meta.env.VITE_WC_PROJECT_ID ?? "";
const networks: [typeof bscTestnet] = [bscTestnet];
export const CHAIN = bscTestnet;

export const wagmiAdapter = new WagmiAdapter({ networks, projectId });

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "OmniDegen Wallet",
    description: "Telegram Mini App companion for OmniDegen auto-hedging",
    url: "https://miniapp-omnidegen.vercel.app",
    icons: ["https://miniapp-omnidegen.vercel.app/favicon.svg"],
  },
  themeMode: "dark",
  features: { analytics: false, email: false, socials: false },
});
