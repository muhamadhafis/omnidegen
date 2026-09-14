import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { bscTestnet } from "viem/chains";
import { inTelegram } from "./telegram";

export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;
export const MUSDC = "0x5930d789bE286F3645BD6678fB8eD1c786c2CE36" as const;
export const VAULT = "0x1B846fb2d2EB2FD83Da5680d0b63CcAee04511C4" as const;
export const BOT_URL = "https://t.me/omnidegen_bot";
export const FAUCET = "https://www.bnbchain.org/en/testnet-faucet";
export const SCAN_TX = (h: string) => `https://testnet.bscscan.com/tx/${h}`;

export const CHAIN = bscTestnet;
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? "";
// Wajib di webview Telegram: tanpa ini Privy buka dompet via scheme mentah
// (metamask://…) yang membunuh Mini App (ERR_UNKNOWN_URL_SCHEME).
// Dengan ini koneksi lewat relay WalletConnect + universal link https.
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  transports: { [bscTestnet.id]: http() },
});

export const privyConfig = {
  // Login hanya via dompet. Di webview Telegram, ketuk dompet diamankan
  // patchCustomSchemeOpen (main.tsx): scheme → universal https → openLink.
  loginMethods: ["wallet"] as ["wallet"],
  supportedChains: [bscTestnet],
  defaultChain: bscTestnet,
  embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" as const } },
  appearance: {
    theme: "dark" as const,
    // OKX dikecualikan di Telegram: universal link-nya scheme mentah
    // (okex://…) yang tak bisa ditulis ulang aman. Trust/OKX/dll via QR.
    ...(inTelegram()
      ? { walletList: ["metamask", "rainbow", "coinbase_wallet", "wallet_connect_qr"] as ["metamask", "rainbow", "coinbase_wallet", "wallet_connect_qr"] }
      : {}),
  },
  ...(WC_PROJECT_ID ? { walletConnectCloudProjectId: WC_PROJECT_ID } : {}),
};
