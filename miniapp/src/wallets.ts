// Deep-link shortcut per dompet: saat tx pending, tap akan membuka aplikasi
// dompet agar request tanda tangan terlihat (webview Telegram tidak auto-buka).
// Catatan: Rabby mobile belum daftar deep-link di registry WalletConnect,
// jadi rabby:// bisa gagal — gunakan MetaMask/Trust/OKX di HP.
// PENTING: buka via iframe tersembunyi, JANGAN navigasi webview — kalau scheme
// tak dikenal, navigasi langsung membunuh Mini App (ERR_UNKNOWN_URL_SCHEME).
export const WALLETS = [
  { id: "metamask", label: "MetaMask", scheme: "metamask://" },
  { id: "trust", label: "Trust", scheme: "trust://" },
  { id: "rabby", label: "Rabby", scheme: "rabby://" },
  { id: "okx", label: "OKX", scheme: "okx://wallet" },
] as const;

export function openWalletApp(scheme: string) {
  try {
    const f = document.createElement("iframe");
    f.style.display = "none";
    f.src = scheme;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 2000);
  } catch {
    /* abaikan: user buka manual */
  }
}
