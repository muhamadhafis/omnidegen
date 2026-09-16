// Deep-link shortcut per dompet fokus (MetaMask + Rabby): saat connect/tx
// pending, tap membuka aplikasi dompet agar request terlihat
// (webview Telegram tidak auto-buka).
// PENTING: buka via iframe tersembunyi, JANGAN navigasi webview — kalau scheme
// tak dikenal, navigasi langsung membunuh Mini App (ERR_UNKNOWN_URL_SCHEME).
export const WALLETS = [
  { id: "metamask", label: "MetaMask", scheme: "metamask://" },
  { id: "rabby", label: "Rabby", scheme: "rabby://" },
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
