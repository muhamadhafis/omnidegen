# Tambah baris inverse MUSDC/WBNB di Kurs Pool Live

Tujuan: tampilkan dua arah (`WBNB/MUSDC $xx` + `MUSDC/WBNB 0.00xxxx`).
Tanpa fetch/read baru — turunan aritmetika dari `spot` yang sudah ada.
Backend NOL perubahan.

## Edit — miniapp/src/components/PoolLiveCard.tsx (2 titik)

1. Formatter di samping `usd` (level modul):

```ts
const ratio6 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });
```

2. Baris metric baru antara header dan baris Blok:

```diff
       <div className="metric">
+        <span className="label">MUSDC/WBNB</span>
+        <span className="value">{!ready || spot <= 0 ? "…" : ratio6.format(1 / spot)}</span>
+      </div>
+      <div className="metric">
         <span className="label">Blok</span>
         <span className="value">{blockNumber === undefined ? "…" : `#${blockNumber.toString()}`}</span>
       </div>
```

Hasil (contoh angka live): header `WBNB/MUSDC $204.82`, baris `MUSDC/WBNB 0.004882`,
baris `Blok #…`. Kelas `.metric`/`.label`/`.value` dipakai ulang — nol CSS baru.
Enam desimal cukup untuk rasio sekecil 0.000001; di atas itu tampil penuh.

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi: tidak ada (aritmetika murni + Intl standar).
Pembagi nol sudah dijaga guard `spot <= 0` yang sama.
