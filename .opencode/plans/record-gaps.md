# Tutup celah pencatatan Tx + alarm (temuan audit read-only)

## Hasil audit: apa yang sebenarnya bocor vs tidak

1. Tx gagal jaringan SUDAH aman (outbox localStorage + flush saat lapor +
   saat panel dibuka + dedup hash). Bukan sumber hilangnya data.
2. Riwayat strategi SUDAH tampilkan waktu (`created_at` slice di kedua tipe
   item StrategiesPanel). DB juga simpan waktu sejak awal.
3. Satu DB file, tak ada split-brain. Dedup hash benar (bukan penyebab).
4. Celah NYATA #1 — `handleText` tanpa try/catch: `saveIntent` throw
   (BUSY/edge) → tertangkap catch poll global → user TAK DAPAT balasan
   apa pun + intent hilang diam-diam.
5. Celah NYATA #2 — Tx yang dilakukan LANGSUNG di aplikasi dompet
   (MetaMask/Rabby, bukan lewat UI Mini App) tak pernah dilaporkan
   frontend → tak ada di riwayat. Backend hanya tahu yang dilaporkan.
6. Bukan celah: konsumsi one-shot oleh trigger, validasi/guard yang memang
   membalas pesan ke user.

## Edit 1 — src/bot.ts (jaring pengaman jujur, kecil)

```diff
-        } else await handleText(uid, msg.text, reply);
+        } else {
+          try {
+            await handleText(uid, msg.text, reply);
+          } catch (e) {
+            console.error("handleText gagal:", e instanceof Error ? e.message : e);
+            await reply("❌ Gagal memproses, coba kirim ulang perintahmu.");
+          }
+        }
```

Efek: tak ada lagi pesan yang ditelan diam-diam; user selalu dapat jawaban.

## Edit 2 — verifikasi cakupan lapor frontend (baca saja, ubah bila kurang)

- Buka TokenTabs effect lapor: pastikan 6 handle (wrap/appr/unwrap/rAppr/
  rSwap/revoke) + kind yang dikirim ⊆ {wrap,unwrap,approve,revoke,swap}.
- Bila ada handle/kind meleset → selaraskan (satu baris per kasus).

## OPSI (butuh keputusan user): rekonsiliasi on-chain untuk Tx luar Mini App

- `GET /api/txs/sync` memakai `BSCSCAN_API_KEY` (sudah ada di env) untuk
  menarik riwayat address, mencocokkan hash yang belum tercatat, menyimpan
  yang terlewat (status dari receipt).
- Ini fitur menengah (endpoint + UI tombol "Sinkronkan" + test), BUKAN bugfix.
- Default bila user pilih "nanti": dokumentasikan batasan (riwayat = Tx via
  Mini App + eksekusi vault).

## Verifikasi

```bash
bun test && bunx tsc --noEmit -p tsconfig.json
# workdir miniapp: bunx tsc --noEmit && bun run lint && bun run build
```
