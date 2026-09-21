# 1) Estimasi jangan tampil sebelum slide 2) MUSDC/WBNB se-hero WBNB/MUSDC

## Diagnosis (terverifikasi dari kode, bukan tebakan)

1. TanStack Query v5: query DISABLED tetap `status: 'pending'` → `isPending`
   true walau tak ada fetch. Display memakai `quote.isPending` → "Memuat…"
   tampil sejak mount. Obat: gate baris dengan `parsed > 0n` + pakai
   `isFetching` (true hanya saat fetch beneran).
2. Inverse kini baris metric kecil; user mau perlakuan hero yang sama.

## Edit 1 — TokenTabs.tsx (blok estimasi, anchor terverifikasi)

```diff
-        {tab === "swap" && (
+        {tab === "swap" && parsed > 0n && (
           <div className="metric">
             <span className="label">Estimasi terima</span>
-            <span className="value">{!p.router ? "…" : out === undefined ? (quote.isPending ? "Memuat…" : "—") : `${fmtToken8(out)} WBNB (min. ${fmtToken8(minOut!)})`}</span>
+            <span className="value">{!p.router ? "…" : out === undefined ? (quote.isFetching ? "Memuat…" : "—") : `${fmtToken8(out)} WBNB (min. ${fmtToken8(minOut!)})`}</span>
           </div>
         )}
```

`parsed` sudah ada di scope komponen. `isFetching` bagian API query wagmi v3
(tsc yang memutuskan; fallback bila protes: `quote.fetchStatus !== "idle"`).
Hasil: default "0"/belum slide = baris hilang total; mengetik → "Memuat…"
hanya saat fetch; gagal → "—" + pesan error yang sudah ada.

## Edit 2 — PoolLiveCard.tsx (inverse jadi hero kedua, struktur cermin)

```diff
       <div className="wallet-header">
         <div>
           <span className="eyebrow">WBNB/MUSDC</span>
           <span className="value">{!ready || spot <= 0 ? "…" : usd.format(spot)}</span>
           <InfoTooltip>Kurs pool Pancake (mUSDC ≈ $1), diperbarui tiap blok. Bukan harga trigger strategi.</InfoTooltip>
         </div>
       </div>
-      <div className="metric">
-        <span className="label">MUSDC/WBNB</span>
-        <span className="value">{!ready || spot <= 0 ? "…" : ratio6.format(1 / spot)}</span>
-      </div>
+      <div className="wallet-header">
+        <div>
+          <span className="eyebrow">MUSDC/WBNB</span>
+          <span className="value">{!ready || spot <= 0 ? "…" : ratio6.format(1 / spot)}</span>
+        </div>
+      </div>
       <div className="metric">
         <span className="label">Blok</span>
```

Nol class/CSS baru (reuse wallet-header/eyebrow/value/metric). Tooltip cukup
satu (milik baris pertama).

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

## Uji manual

1. Buka tab Tukar (nominal 0) → baris estimasi TAK ADA (bukan "Memuat…"/"—").
2. Ketik 0.05 → "Memuat…" sekilas → angka.
3. PoolLiveCard: dua blok hero (fiat + rasio), lalu Blok.
