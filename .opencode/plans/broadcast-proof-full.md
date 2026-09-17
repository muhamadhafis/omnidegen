# FULL: broadcast jujur + bukti on-chain (disetujui user, tertunda permission edit)

Konteks: 3/3 Tx real (`0x7f9f`, `0xfa69`, `0x5aa7`) tak pernah mined; nonce origin
lompat 25→29 (pending hanya di node origin) = kegagalan broadcast sistematis.
Prinsip user: "harus di blockchain, bukan dummy di DB" → DB simpan alert +
pointer bukti chain.

## Edit 1 — src/web3.ts (tambah setelah `confirmTransaction`)

```ts
// pure + testable: pastikan Tx terlihat di jaringan (bukan cuma di node origin).
export async function checkPropagated(
  getTx: (hash: `0x${string}`) => Promise<unknown>,
  hash: `0x${string}`,
  tries = 3,
  delayMs = 4000,
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      if (await getTx(hash)) return true;
    } catch { /* belum terlihat, coba lagi */ }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}
```

## Edit 2 — src/web3.ts (ganti blok kirim di `triggerHedgeTransaction`)

LAMA:

```ts
  const hash = await walletClient.writeContract(request);
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
  console.log(`[hedge-tx] hash=${hash} nonce=${nonce} gas=${String(request.gas ?? "?")} maxFee=${(request.maxFeePerGas ?? request.gasPrice)?.toString() ?? "?"}`);
  await confirmTransaction(publicClient, hash);
  return hash;
```

BARU:

```ts
  const hash = await walletClient.writeContract(request);
  const sent = await publicClient.getTransaction({ hash }).catch(() => null);
  if (!sent) throw new Error(`origin tak menyimpan tx: ${hash}`);
  console.log(`[hedge-tx] hash=${hash} nonce=${sent.nonce} fee=${(sent.gasPrice ?? sent.maxFeePerGas)?.toString() ?? "?"}`);
  const fallbacks = [...new Set((process.env.RPC_URL_FALLBACK ?? "https://bsc-testnet-dataseed.bnbchain.org").split(",").map((s) => s.trim()).filter(Boolean))].filter((u) => u !== process.env.RPC_URL);
  if (fallbacks.length > 0) {
    const fb = createPublicClient({ chain: bscTestnet, transport: http(fallbacks[0]) });
    if (!(await checkPropagated((h) => fb.getTransaction({ hash: h }), hash)))
      throw new Error(`tx not propagating (origin ok, relay tak melihat): ${hash}`);
  }
  await confirmTransaction(publicClient, hash);
  return hash;
```

## Edit 3 — src/db.ts (kolom bukti + migrasi + writer)

3a. SCHEMA, di tabel intents setelah `status`:

```diff
     status TEXT DEFAULT 'active',
+    tx_hash TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

3b. Setelah `createDb`, tambah migrasi idempoten + panggil di `createDb`:

```ts
// migrasi ringan: ALTER dibungkus try/catch agar idempoten untuk DB lama.
export function runMigrations(conn: Database) {
  for (const sql of ["ALTER TABLE intents ADD COLUMN tx_hash TEXT"]) {
    try {
      conn.exec(sql);
    } catch { /* kolom sudah ada */ }
  }
}
```

```diff
 export function createDb(path = ":memory:") {
   const conn = new Database(path, { create: true });
   conn.exec(SCHEMA);
+  runMigrations(conn);
   return conn;
 }
```

3c. Di akhir dekat `updateIntentStatus`, tambah:

```ts
// bukti eksekusi: hash Tx yang SUDAH terkonfirmasi receipt success.
// Tulis hanya untuk hash real (panggil dengan isRealTxHash).
export function updateIntentProof(id: number, txHash: string, conn: Database = db) {
  conn.query(`UPDATE intents SET tx_hash=$h WHERE id=$id`).run({ $h: txHash, $id: id });
}
```

## Edit 4 — src/loop.ts

4a. Setelah `failHint`, tambah (sebelum `shouldTrigger`):

```ts
// pure + testable: hanya hash 64-hex yang boleh di-link ke explorer.
// Mock (0xmock…) dan string lain bukan bukti chain.
export function isRealTxHash(tx: unknown): tx is `0x${string}` {
  return typeof tx === "string" && /^0x[0-9a-fA-F]{64}$/.test(tx);
}
```

4b. `failHint`, tambah setelah mapping "revert":

```ts
if (reason.includes("propagating") || reason.includes("origin tak menyimpan")) return "Tx tak terlihat jaringan (RPC origin bermasalah?) — cek RPC_URL, buat intent baru dan coba lagi";
```

4c. Cabang sukses `tickOnce`, ganti:

```diff
       const tx = await exec(it.user_wallet);
       if (tx) {
         updateIntentStatus(it.id, "executed", conn);
         done.push(it.id);
         const tag = String(tx).startsWith("0xmock") ? "[SIMULASI] " : "";
-        console.log(`[hedge] ${tag}user=${it.user_id} ${it.asset_to_monitor}->${it.action_asset} @ $${price} tx=${tx}`);
+        const link = isRealTxHash(tx) ? `\nCek: https://testnet.bscscan.com/tx/${tx}` : "";
+        if (isRealTxHash(tx)) updateIntentProof(it.id, tx, conn);
+        console.log(`[hedge] ${tag}user=${it.user_id} ${it.asset_to_monitor}->${it.action_asset} @ $${price} tx=${tx}`);
         try {
-          await notify(it.user_id, `🚨 ${tag}Penyelamatan: ${it.asset_to_monitor}->${it.action_asset} @ $${price}\nTx: ${tx}`);
+          await notify(it.user_id, `🚨 ${tag}Penyelamatan: ${it.asset_to_monitor}->${it.action_asset} @ $${price}\nTx: ${tx}${link}`);
         } catch {}
       } else updateIntentStatus(it.id, "active", conn);
```

## Edit 5 — src/bot.ts

5a. Import: `import { fetchPrice, setMockPrice, failHint } from "./loop";`
→ tambah `isRealTxHash`.

5b. `runInstant`, ganti:

```diff
   try {
     const tx = await triggerHedgeTransaction(wallet);
-    return reply(tx ? `🚨 Batch ${parsed.type} dieksekusi.\nTx: ${tx}\nCek: https://testnet.bscscan.com/tx/${tx}` : "❌ Eksekusi gagal.");
+    if (!tx) return reply("❌ Eksekusi gagal.");
+    const link = isRealTxHash(tx) ? `\nCek: https://testnet.bscscan.com/tx/${tx}` : "";
+    return reply(`🚨 Batch ${parsed.type} dieksekusi.\nTx: ${tx}${link}`);
   } catch (e) {
```

## Edit 6 — miniapp/src/components/StrategyCard.tsx

6a. Import: tambah `SCAN_TX`: `import { API_URL, apiHeaders, SCAN_TX } from "../config";`
6b. Type: tambah `tx_hash?: string | null;`
6c. Render, setelah baris Dompet:

```tsx
{s.tx_hash && /^0x[0-9a-fA-F]{64}$/.test(s.tx_hash) && (
  <a className="tx" href={SCAN_TX(s.tx_hash)} target="_blank" rel="noreferrer">
    Lihat Tx ↗
  </a>
)}
```

## Edit 7 — .env.example (tambah di bawah RPC_URL)

```env
RPC_URL_FALLBACK=https://bsc-testnet-dataseed.bnbchain.org
```

## Edit 8 — test

8a. `src/engine.test.ts`: import tambah `checkPropagated` (dari web3) dan
`isRealTxHash` (dari loop — cek import loop sudah ada: `shouldTrigger, tickOnce,
failHint`; tambah di situ). Test baru:

```ts
test("propagasi: terlihat / coba-lagi / hilang", async () => {
  expect(await checkPropagated(async () => ({ h: 1 }), "0xabc" as `0x${string}`, 3, 1)).toBe(true);
  let n = 0;
  const flaky = async () => (++n >= 2 ? { h: 1 } : null);
  expect(await checkPropagated(flaky, "0xabc" as `0x${string}`, 3, 1)).toBe(true);
  expect(n).toBe(2);
  expect(await checkPropagated(async () => { throw new Error("nf"); }, "0xabc" as `0x${string}`, 2, 1)).toBe(false);
});
test("isRealTxHash hanya hash 64-hex", () => {
  expect(isRealTxHash("0x" + "ab".repeat(32))).toBe(true);
  expect(isRealTxHash("0xmock123")).toBe(false);
  expect(isRealTxHash("0xtest")).toBe(false);
  expect(isRealTxHash(undefined)).toBe(false);
});
test("tickOnce simpan proof hanya untuk hash real", async () => {
  const conn = createDb();
  const id = saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
  await tickOnce(440, { conn, exec: async () => "0x" + "cd".repeat(32) });
  expect((conn.query("select tx_hash from intents where id=$id").get({ $id: id }) as any).tx_hash).toBe("0x" + "cd".repeat(32));
  const id2 = saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
  await tickOnce(440, { conn, exec: async () => "0xmock1" });
  expect((conn.query("select tx_hash from intents where id=$id2").get({ $id: id2 }) as any).tx_hash).toBeNull();
});
```

8b. `src/db.test.ts`, tambah:

```ts
test("migrasi idempoten + proof roundtrip", () => {
  const c = createDb();
  runMigrations(c);
  runMigrations(c); // jalan kedua tak boleh throw
  const id = saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c);
  updateIntentProof(id, "0x" + "ab".repeat(32), c);
  expect((c.query("select tx_hash from intents where id=$id").get({ $id: id }) as any).tx_hash).toBe("0x" + "ab".repeat(32));
});
```

Import `runMigrations, updateIntentProof` di db.test.ts.

## Verifikasi

```bash
bun test                       # target 35+/35+
bunx tsc --noEmit -p tsconfig.json
# miniapp (workdir miniapp):
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `sent.gasPrice`/`sent.maxFeePerGas` opsional di viem → optional chaining sudah dipakai.
- `fb.getTransaction` throw bila tak ada → ditangkap checkPropagated.
- `updateIntentProof` hanya dipanggil untuk hash real → test "0xtest" lama tetap lolos.

## Setelah deploy + restart + uji /crash

- Sukses: log `[hedge-tx]` + receipt → chat dapat link Cek bscscan; row intent berisi
  tx_hash; StrategyCard tampilkan "Lihat Tx ↗".
- Gagal propagasi: chat jujur "Tx tak terlihat jaringan", intent `failed`,
  hash TIDAK ditulis ke DB (bukan bukti).
