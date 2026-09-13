import { http, createConfig } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;
export const MUSDC = "0x5930d789bE286F3645BD6678fB8eD1c786c2CE36" as const;
export const VAULT = "0x1B846fb2d2EB2FD83Da5680d0b63CcAee04511C4" as const;
export const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as const;
export const BOT_URL = "https://t.me/omnidegen_bot";
export const SCAN_TX = (h: string) => `https://testnet.bscscan.com/tx/${h}`;

export const config = createConfig({
  chains: [bscTestnet],
  connectors: [
    injected(),
    walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID ?? "" }),
  ],
  transports: { [bscTestnet.id]: http() },
});
