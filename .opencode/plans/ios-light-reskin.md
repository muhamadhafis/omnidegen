# Reskin Mini App: terang minimalis ala iOS (mode DURING, dial E1/R2/M1)

Direction (dari owner, pengganti DESIGN.md): minimalis, tema terang seperti iOS.
Design Read: dompet kripto Mini App Telegram untuk pengguna HP, bahasa visual
iOS terang minimal, dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Palet final (semua lolos contrast-check.py, R-25)

| Pakai | Hex | Rasio di atasnya | Alasan satu baris (R-31) |
|---|---|---|---|
| Page bg | #F2F2F7 | — | iOS systemGroupedBackground: abu pembeda grup kartu |
| Card bg | #FFFFFF | — | kartu putih iOS grouped list |
| Teks | #1C1C1E | 17.01:1 PASS | iOS label, hampir hitam |
| Muted | #636366 | 5.99:1 PASS | secondary label yang tetap terbaca (#8E8E93 FAIL 3.26, ditolak) |
| Aksen (button primer bg) | #F0B90B + teks #1C1C1E | 9.44:1 PASS | emas = identitas produk existing (README/bot); iOS-ness dari permukaan+tipografi, bukan warna |
| Link | #005FCC | 5.98:1 PASS | biru digelapkan (#007AFF FAIL 4.02, ditolak) |
| Sukses teks | #1A7F37 | 5.08:1 PASS | hijau gelap terbaca di putih |
| Bahaya teks | #D70015 | 5.38:1 PASS | merah iOS yang lolos AA |
| Border input/focus | ikut #636366 (5.99) | lolos non-teks 3:1 | jangan #AEAEB2 (FAIL 2.21) |

## Fase 1 — fondasi tema (index.css :root + @theme)

- Ganti 9 var di atas; `color-scheme: light` (html + :root); radius: card 14,
  kontrol 10 (alasan: iOS continuous-corner terasa, bukan pil seragam R-11).
- Font: PERTAHANKAN stack system (-apple-system pertama = SF asli di iPhone,
  alasan R-06); angka pakai tabular-nums yang sudah ada; mono hanya address/hash.
- Cek telegram.ts theme/header-color sync agar header Telegram tak bentrok.

## Fase 2 — komponen (App, StatusCard, TokenTabs, AmountInput, StrategiesPanel,
## PoolLiveCard, AlarmCard, WalletShortcuts, ui/*)

- Surface → kartu putih radius 14 di atas #F2F2F7 (motif identitas: grouped iOS).
- Button primer emas+teks gelap; ghost/secondary-Kontras ulang di terang.
- Badge "Testnet": label status real → boleh tetap (R-09 lolos, ada fungsi).
- Tabs/segmented: selected = emas tipis + teks gelap (gantikan gaya gelap).
- Slider thumb min visual boleh kecil TAPI hit area ≥44px (padding transparan,
  R-03); chips dipertahankan.
- Status sukses/gagal hijau/merah baru; Notice warning kuning digelapkan teksnya.
- StatusCard hero: angka besar gelap di putih, label muted #636366.
- Copy audit: grep em dash (R-02), emoji di UI Mini App (R-04, bot chat di luar
  cakupan), CTA sudah spesifik ("Wrap BNB" lolos R-15), ikon Lucide tulis
  relevansinya per ikon atau buang.

## Fase 3 — human/mobile gates (Growth + checklist skill)

- Semua teks/sssudah di tabel = R-25 PASS; fokus-visible dipertahankan +
  cek di terang; keyboard Radix (tabs/slider) tetap jalan; empty/loading/error
  yang sudah ada dicek ulang di tema terang; safe-area + max-width 440 tetap;
- Catat: tanpa screenshot tool, verifikasi visual = baca kode + build; tulis
  jujur di laporan.

## Fase 4 — Delivery Gate + build + lapor PASS/FAIL per item.
