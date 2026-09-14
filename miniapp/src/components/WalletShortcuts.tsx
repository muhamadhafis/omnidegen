import { WALLETS, openWalletApp } from "../wallets";

// Shortcut tap-to-open: webview Telegram tidak auto-buka dompet saat sign,
// jadi user ketuk manual agar request terlihat.
export default function WalletShortcuts() {
  return (
    <div aria-live="polite">
      <p>Ketuk dompetmu untuk tanda tangan:</p>
      <div className="chips">
        {WALLETS.map((w) => (
          <button key={w.id} type="button" className="chip" onClick={() => openWalletApp(w.scheme)}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
