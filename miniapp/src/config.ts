import { createConfig } from "@privy-io/wagmi";
import { http, fallback } from "wagmi";
import { bscTestnet } from "viem/chains";
import { inTelegram } from "./telegram";

export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const;
export const MUSDC = "0x5930d789bE286F3645BD6678fB8eD1c786c2CE36" as const;
export const VAULT = "0x1B846fb2d2EB2FD83Da5680d0b63CcAee04511C4" as const;
export const BOT_URL = "https://t.me/Omnidegen_bot";
export const FAUCET = "https://www.bnbchain.org/en/testnet-faucet";
export const SCAN_TX = (h: string) => `https://testnet.bscscan.com/tx/${h}`;

export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://bnb-testnet.g.alchemy.com/v2/mizf9D18M3qQqOUwjdXOt";

export const CHAIN = bscTestnet;
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? "";
export const API_URL = import.meta.env.VITE_API_URL ?? "";
// Bypass interstitial zrok agar fetch API langsung dapat JSON (bukan halaman gate).
export const apiHeaders = (extra: Record<string, string> = {}) => ({
  "skip_zrok_interstitial": "1",
  ...extra,
});
// Wajib di webview Telegram: tanpa ini Privy buka dompet via scheme mentah
// (metamask://…) yang membunuh Mini App (ERR_UNKNOWN_URL_SCHEME).
// Dengan ini koneksi lewat relay WalletConnect + universal link https.
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID ?? "";

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: fallback([
      http(RPC_URL),
      http("https://bsc-testnet-rpc.publicnode.com"),
      http("https://bsc-testnet-dataseed.bnbchain.org"),
      http("https://bsc-testnet.bnbchain.org"),
      http("https://bsc-prebsc-dataseed.bnbchain.org"),
      http("https://data-seed-prebsc-1-s2.binance.org:8545"),
    ]),
  },
});

export const privyConfig = {
  // Login hanya via dompet. Fokus 2 dompet: MetaMask (tombol langsung) +
  // Rabby (via entri WalletConnect — registry resmi WC; 'rabby_wallet'
  // sebagai nama sudah deprecated di Privy dan tak bisa dipakai langsung).
  // Di webview Telegram, ketuk dompet diamankan patchCustomSchemeOpen
  // (main.tsx): MetaMask Android/Rabby via intent mentah, MetaMask iOS
  // via universal link. 'wallet_connect_qr' TIDAK dipakai: tak jalan di mobile.
  loginMethods: ["wallet"] as ["wallet"],
  supportedChains: [bscTestnet],
  defaultChain: bscTestnet,
  appearance: {
    theme: "light" as const,
    ...(inTelegram()
      ? { walletList: ["metamask", "wallet_connect"] as ["metamask", "wallet_connect"] }
      : { walletList: ["metamask", "detected_ethereum_wallets", "wallet_connect"] as ["metamask", "detected_ethereum_wallets", "wallet_connect"] }),
  },
  ...(WC_PROJECT_ID ? { walletConnectCloudProjectId: WC_PROJECT_ID } : {}),
};
