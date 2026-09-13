// Deep-link shortcut per dompet: saat tx pending, tap akan membuka aplikasi
// dompet agar request tanda tangan terlihat (webview Telegram tidak auto-buka).
// Catatan: Rabby mobile belum daftar deep-link di registry WalletConnect,
// jadi rabby:// bisa gagal — gunakan MetaMask/Trust/OKX di HP.
export const WALLETS = [
  { id: "metamask", label: "MetaMask", scheme: "metamask://" },
  { id: "trust", label: "Trust", scheme: "trust://" },
  { id: "rabby", label: "Rabby", scheme: "rabby://" },
  { id: "okx", label: "OKX", scheme: "okx://wallet" },
] as const;
