# iOS refinement 2: aksen, radius, font tunggal, spacing scale (TERTUNDA, butuh 1 keputusan)

## 0. Fakta terverifikasi (contrast-check.py)

- Biru muda SEBAGAI TEKS putih-di-atasnya FAIL: putih di #0A84FF = 3.65.
- Biru muda SEBAGAI background + teks gelap LULUS KUAT: #1C1C1E di #CFE8FF = 13.48.
- Varian: teks #005FCC di atas #CFE8FF = 4.74 PASS (cadangan bila perlu teks biru).
- Emas existing tetap valid: #1C1C1E di #F0B90B = 9.44.

## 1. Aksen: KEPUTUSAN USER = TETAP EMAS (biru muda hanya link/fokus #005FCC)

- Opsi A (pertahankan emas): nol risiko, identitas disetujui 2x. Biru tetap
  hanya untuk link/fokus (#005FCC).
- Opsi B (pindah ke biru muda): CTA primer `bg #CFE8FF + teks #1C1C1E`
  (13.48), range slider + spinner + wash ikut keluarga biru, emas HILANG total
  dari UI (R-29: satu aksen, tak boleh dua). Rasa iOS naik, identitas emas hilang.
- Rekomendasi: B bila brief "seperti iOS" lebih penting dari kontinuitas emas.

## 2. Radius (diputuskan, tak perlu ditanya)

- Button → `rounded-full` SAJA (pill khusus aksi; alasan R-11: bukan semua pil —
  kartu 14, input 10, chip/row 6-8 tetap).
- iOS murni pakai ~10px, jadi full-pill = gaya "crypto app" modern bukan iOS
  tulen: jujur dicatat, user yang minta eksplisit.

## 3. Satu font (diputuskan)

- Stack systemiland sudah satu family di semua teks. Ubah: hero balance +
  `.value` angka dari mono → system semibold (tabular-nums dipertahankan);
  mono TINGGAL untuk address/hash/kode. Italic: tidak dipakai di copy
  (tak ada yang diubah; aturan: bedakan via size/weight saja).

## 4. Spacing scale + reusable — HASIL EKSEKUSI (deviasi tercatat)

- Token --s1..s4 DIBATALKAN: skala Tailwind (gap-2/3/4, p-3/4, mt-4, mb-3)
  ternyata sudah jadi sistem de-facto; menambah sistem paralel lebih buruk.
- Snap: py-[18px]→py-4, gap-2.5→gap-3, gap-1.5→gap-2, mb-[var(--space)]→mb-3,
  px done earlier. Var --space/--radius mati → dihapus.
- `ui/Stack.tsx` baru dipakai di AmountInput, TokenTabs, AlarmCard.
- TEMUAN saat eksekusi: typo `id={`token-${tab}-amount"}` (quote nyasar →
  asosiasi label rusak, nyaris R-32) — diperbaiki.
- (bagian plan lama di bawah ini sudah dieksekusi apa adanya)

- Token di :root: `--s1:4px; --s2:8px; --s3:12px; --s4:16px;` ganti nilai
  manual (`py-[18px]`→`py-4`, `px-[13px]`→`px-4`, `gap-2.5`→`gap-3`,
  `mb-[var(--space)]`→`mb-4`, `mt-3`→`mt-4`) di Button/Input/cards.
- Primitif `ui/Stack.tsx` baru (`direction/gap` via prop) dipakai di
  AmountInput, TokenTabs status area, StrategyPanel rows — ganti flex-col
  manual yang berulang. Tidak untuk layout sekali-pakai.
- Verifikasi: `tsc && lint && build` + grep sisa `py-[|px-[` = 0.

## 5. Gates: ulangi contrast untuk pasangan baru bila Opsi B menang
## (emas-hilang total → cek ulang tiap pemakaian #CFE8FF), Delivery Gate update.
