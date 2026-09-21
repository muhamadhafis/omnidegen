import { API_URL, apiHeaders } from "../config";
import { telegramInitData } from "../telegram";

type OutboxItem = {
  wallet: string;
  kind: string;
  amt: string;
  token: string;
  hash: string;
  status: "submitted" | "success" | "failed";
};

const OUTBOX_KEY = "omnidegen_txoutbox_v1";
const OUTBOX_MAX = 50;

// Set sesi anti-dobel (aman dari double-effect StrictMode).
const sent = new Set<string>();
// Guard flush konkuren (hindari double-POST dari dua pemicu bersamaan).
let flushing = false;

function loadOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((o) => o && typeof o.hash === "string") : [];
  } catch {
    return [];
  }
}

function saveOutbox(items: OutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_MAX)));
  } catch {
    /* abaikan: storage penuh / tak tersedia */
  }
}

async function postTx(initData: string, o: OutboxItem): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/txs`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ initData, wallet: o.wallet, kind: o.kind, amount: o.amt, token: o.token, txHash: o.hash, status: o.status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Kirim ulang antrean gagal. Dipanggil tiap ada laporan baru + tiap panel
// riwayat dibuka. Gagal = tetap di antrean untuk kunjungan berikut.
export async function flushTxOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    if (!API_URL) return;
    const initData = telegramInitData();
    if (!initData) return;
    const items = loadOutbox();
    if (!items.length) return;
    const rest: OutboxItem[] = [];
    for (const o of items) {
      const ok = await postTx(initData, o);
      if (ok) sent.add(o.hash);
      else rest.push(o);
    }
    saveOutbox(rest);
  } finally {
    flushing = false;
  }
}

// Lapor Tx dompet ke backend. Gagal jaringan = masuk antrean localStorage
// (bukan hilang). Tanpa initData (bukan di Telegram) = lewati.
export function reportWalletTx(input: { wallet: string; kind: string; amt: string; token: string; hash: string; status: "submitted" | "success" | "failed" }) {
  try {
    if (!API_URL || sent.has(input.hash)) return;
    const initData = telegramInitData();
    if (!initData) return;
    sent.add(input.hash);
    try {
      window.dispatchEvent(new CustomEvent("Omnidegen:tx", { detail: { hash: input.hash } }));
    } catch {
      /* non-browser: abaikan */
    }
    void flushTxOutbox();
    const item: OutboxItem = { wallet: input.wallet, kind: input.kind, amt: input.amt, token: input.token, hash: input.hash, status: input.status };
    postTx(initData, item).then((ok) => {
      if (ok) return;
      const q = loadOutbox();
      if (!q.some((o) => o.hash === item.hash)) {
        q.push(item);
        saveOutbox(q);
      }
    });
  } catch {
    /* abaikan: riwayat tak boleh mengganggu Tx */
  }
}
