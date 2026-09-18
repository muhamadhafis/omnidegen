import { API_URL, apiHeaders } from "../config";
import { telegramInitData } from "../telegram";

// Lapor Tx dompet ke backend SEKALI per hash (Set modul anti-dobel,
// aman dari double-effect StrictMode). Gagal diam-diam: riwayat tak boleh
// mengganggu Tx. Tanpa initData (bukan di Telegram) = lewati.
const sent = new Set<string>();

export function reportWalletTx(input: { wallet: string; kind: string; amt: string; token: string; hash: string; status: "submitted" | "success" | "failed" }) {
  try {
    if (!API_URL || sent.has(input.hash)) return;
    const initData = telegramInitData();
    if (!initData) return;
    sent.add(input.hash);
    try {
      window.dispatchEvent(new CustomEvent("omnidegen:tx", { detail: { hash: input.hash } }));
    } catch {
      /* non-browser: abaikan */
    }
    fetch(`${API_URL}/api/txs`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ initData, wallet: input.wallet, kind: input.kind, amount: input.amt, token: input.token, txHash: input.hash, status: input.status }),
    }).catch(() => {
      sent.delete(input.hash);
    });
  } catch {
    /* abaikan */
  }
}
