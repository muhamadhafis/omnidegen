# Riwayat Tx dompet di backend, semua status (disetujui: Backend + semua status)

Keputusan user: simpan di backend; catat sukses/gagal/pending.
Status: SIAP EKSEKUSI, tertunda permission `edit`.
Prinsip: hash terverifikasi receipt sebelum dianggap final (anti-dummy);
frontend lapor, backend yang mengesahkan.

## 1. src/db.ts — tabel + fungsi

```sql
CREATE TABLE IF NOT EXISTS wallet_txs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_wallet TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount TEXT DEFAULT '0',
  token TEXT DEFAULT '',
  tx_hash TEXT NOT NULL,
  status TEXT DEFAULT 'submitted',
  verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- Tambah ke SCHEMA + fungsi:
```ts
const TX_KINDS = ["wrap", "unwrap", "approve", "revoke", "swap"] as const;
export type TxKind = (typeof TX_KINDS)[number];
const TX_STATUS = ["submitted", "success", "failed"] as const;

export function recordWalletTx(input: { userId: string; userWallet: string; kind: string; amount: string; token: string; txHash: string; status: string }, conn: Database = db): number {
  if (!input.userId || !/^0x[0-9a-fA-F]{40}$/.test(input.userWallet)) throw new Error("bad wallet");
  if (!(TX_KINDS as readonly string[]).includes(input.kind)) throw new Error("bad kind");
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) throw new Error("bad hash");
  const st = (TX_STATUS as readonly string[]).includes(input.status) ? input.status : "submitted";
  const q = conn.query(`INSERT INTO wallet_txs (user_id, user_wallet, kind, amount, token, tx_hash, status)
    VALUES ($uid, $wallet, $kind, $amount, $token, $hash, $st) RETURNING id as id`);
  return (q.get({ $uid: input.userId, $wallet: input.userWallet.toLowerCase(), $kind: input.kind, $amount: String(input.amount).slice(0, 64), $token: String(input.token).slice(0, 12), $hash: input.txHash.toLowerCase(), $st: st }) as any).id as number;
}

export function getWalletTxs(userId: string, limit = 20, conn: Database = db) {
  const n = Math.floor(Number(limit));
  const lim = !(n >= 1) ? 20 : Math.min(n, 100);
  return conn.query(`SELECT * FROM wallet_txs WHERE user_id=$uid ORDER BY id DESC LIMIT ${lim}`).all({ $uid: userId }) as any[];
}

// Verifikasi tertunda: untuk baris unverified, cek receipt via fetcher injeksi
// (testable, tanpa network di test). Kembalikan jumlah yang terverifikasi.
export async function verifyPendingTxs(
  conn: Database,
  getReceipt: (hash: string) => Promise<{ status: string; from: string } | null>,
  limit = 10,
): Promise<number> {
  const rows = conn.query(`SELECT * FROM wallet_txs WHERE verified=0 ORDER BY id DESC LIMIT ${Math.min(Math.max(1, Math.floor(Number(limit)) || 10), 50)}`).all() as any[];
  let done = 0;
  for (const r of rows) {
    try {
      const rc = await getReceipt(r.tx_hash);
      if (!rc) continue;
      if (rc.from && rc.from.toLowerCase() !== String(r.user_wallet).toLowerCase()) continue; // bukan Tx dompet ini
      const st = rc.status === "success" ? "success" : "failed";
      conn.query(`UPDATE wallet_txs SET status=$s, verified=1 WHERE id=$id`).run({ $s: st, $id: r.id });
      done++;
    } catch { /* best-effort: coba lagi di kunjungan berikut */ }
  }
  return done;
}
```

## 2. src/api.ts — endpoint (auth + validasi + verifikasi cepat)

- Import: `recordWalletTx, getWalletTxs, verifyPendingTxs` dari db;
  `createPublicClient, http` viem + `bscTestnet` untuk receipt check.
- `POST /api/txs` body `{initData, wallet, kind, amount, token, txHash, status}`:
  origin check seperti link-wallet; `verifyTelegramInitData` → userId;
  `recordWalletTx(...)` (throw → 400 dengan pesan error);
  best-effort verifikasi langsung 1 hash (timeout ~8 dtk via AbortSignal?) —
  SEDERHANA SAJA: panggil verifyPendingTxs(conn, liveFetcher, 5) di dalam
  try/catch tanpa await? — JANGAN fire-and-forget tanpa tangani rejection
  (UnhandledRejection): `verifyPendingTxs(...).catch(() => {})` eksplisit.
  Response `{ ok: true, id }`. Log ringkas (tanpa initData).
- `GET /api/txs?limit=`:
  `requireAuth` → `await verifyPendingTxs(conn, liveFetcher, 10)` dalam
  try/catch (gagal = lewati, tetap kembalikan data) → `getWalletTxs`.
- liveFetcher:
```ts
const rpcClient = () => createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
const liveReceipt = async (hash: string) => {
  try {
    const r = await rpcClient().getTransactionReceipt({ hash: hash as `0x${string}` });
    return { status: r.status, from: r.from };
  } catch { return null; }
};
```
- `failHint` tak perlu (bukan jalur chat).

## 3. Test backend (bun test, tanpa network)

- db.test: record valid + tolak kind/hash/wallet buruk; getWalletTxs limit +
  isolasi user; verifyPendingTxs dengan stub: success→status success verified=1,
  reverted→failed, null→tetap submitted, from beda→dilewati.
- api.test (conn memori): POST valid → 200 + row tersimpan; POST hash buruk →
  400; POST tanpa initData → 401; GET tanpa auth → 401; GET dengan auth →
  200 + items (receipt check akan gagal network → tertelan try/catch, data tetap).

## 4. Mini App

4a. `miniapp/src/lib/txlog.ts` (baru): lapor sekali per hash (Set modul),
silent-catch:
```ts
import { API_URL, apiHeaders } from "../config";
import { telegramInitData } from "../telegram";
const sent = new Set<string>();
export function reportWalletTx(kind: string, amount: string, token: string, hash: string, status: "submitted" | "success" | "failed") {
  try {
    if (!API_URL || sent.has(hash)) return;
    const initData = telegramInitData();
    if (!initData) return;
    sent.add(hash);
    fetch(`${API_URL}/api/txs`, { method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ initData, wallet: undefined, kind, amount, token, txHash: hash, status }),
    }).catch(() => { sent.delete(hash); });
  } catch { /* abaikan: riwayat tak boleh ganggu Tx */ }
}
```
wallet: ambil dari address aktif — teruskan sebagai param dari TokenTabs
(`reportWalletTx({..., wallet: address})`; ubah signature terima wallet explisit,
JANGAN baca global — deterministik).
4b. `TokenTabs.tsx`: `lastSubmit` ref `{kind, amt, token}` diisi di tiap handler
sebelum panggil onX (wrap/BNB, approveVault/cap/WBNB, revoke/cap/WBNB,
unwrap/WBNB, approveMusdc/mUSDC, swap/mUSDC); effect per 5 handle:
bila `hash` ada dan `isSuccess` → report success; bila `error` → butuh hash —
error tanpa hash (user reject) tak tercatat (catat di komentar kode).
Reset `lastSubmit` setelah report? — Set modul cegah duplikat; cukup.
4c. `TxHistory.tsx` (baru, pola StrategyCard): GET `/api/txs?limit=20`,
daftar `{kindLabel, amount token, status badge, waktu, link bscscan}`;
label kind id-ID; class status baru di index.css:
`.tx-submitted` (accent), `.tx-success` (green), `.tx-failed` (red).
Render di App di bawah StrategyCard.
4d. App: tak ada logika baru selain render `<TxHistory/>` (butuh initData —
oper seperti StrategyCard).

## 5. Verifikasi

```bash
bun test && bunx tsc --noEmit -p tsconfig.json
# workdir miniapp:
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `r.from` viem receipt bertipe address — lower-case manual dua sisi.
- POST harus tetap 200 walau RPC mati (verifikasi best-effort, jangan blokir).
- `initData` JANGAN masuk log atau DB.
- StrictMode double-effect: Set modul cegah lapor ganda.
- Error tanpa hash (reject di dompet) = tak ada yang dilaporkan (by design).
