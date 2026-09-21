# Pengaman beli: tolak eksplisit sebelum LLM (disetujui: pengaman saja)

Bahaya yang ditutup: "beli ... turun ..." → stop_loss (jual terbalik);
"beli token X" → defi_batch → execute_now → jual-all setelah YA.
Catatan bahasa: TANPA em dash di teks balasan (aturan R-02).

## Edit 1 — src/bot.ts (helper murni + guard di handleText)

Tambah setelah definisi `routeIntent` (atau dekatnya):

```ts
// pure + testable: kata kerja beli terdeteksi SEBELUM LLM, agar kata arah
// (turun/naik) tak pernah membalikkan aksi menjadi jual.
export function isBuyRequest(text: string): boolean {
  return /(beli|borong|buy|akumulasi|serok)/i.test(text.trim());
}
```

Di `handleText`, antara `clearPending(uid);` dan `parseUserIntent`:

```diff
   clearPending(uid); // pesan baru menggugurkan konfirmasi lama
+  if (isBuyRequest(t)) return reply("⚠️ Beli otomatis belum didukung. Bot hanya hedge/JUAL otomatis. Untuk beli, pakai tab Tukar mUSDC di Mini App.");
   const parsed = await parseUserIntent(t);
```

## Edit 2 — src/ai.ts SYSTEM (pertahanan lapis dua, tanpa ubah kode parse)

Tambah kalimat ke SYSTEM (setelah baris mapping arah):

```text
Kata kerja aksi mengalahkan kata arah: beli/borong TIDAK PERNAH jadi
stop_loss, vacuum, atau defi_batch.
```

## Edit 3 — src/engine.test.ts (test guard)

Import: tambah `isBuyRequest` ke baris import dari "./bot".
Test baru sebelum `test("admin crash command", ...)`:

```ts
  test("permintaan beli ditolak sebelum LLM", () => {
    expect(isBuyRequest("beli BNB kalau turun ke 100")).toBe(true);
    expect(isBuyRequest("Borong mUSDC sekarang")).toBe(true);
    expect(isBuyRequest("buy the dip")).toBe(true);
    expect(isBuyRequest("jual BNB kalau turun ke 100")).toBe(false);
    expect(isBuyRequest("kalau bnb turun ke $100 jual")).toBe(false);
    expect(isBuyRequest("TP BNB ke 500")).toBe(false);
  });
```

## Verifikasi

```bash
bun test && bunx tsc --noEmit -p tsconfig.json
```

## Uji manual (chat bot)

- "beli BNB kalau turun ke 100" → balasan ⚠️ (BUKAN stop_loss; cek tidak ada
  intent baru di /api/me).
- "jual BNB kalau turun ke 100" → tetap stop_loss seperti semula.
