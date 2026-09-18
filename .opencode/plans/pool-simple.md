# Sederhanakan Kurs Pool Live → format WBNB/MUSDC $xx

Tujuan: satu baris pair-price + bukti kesegaran. Hapus: baris inverse,
cadangan, tabel dampak 3 sampel (angka actionable min-diterima tetap ada di
kartu swap — tidak hilang dari aplikasi).

## Edit — miniapp/src/components/PoolLiveCard.tsx (tulis ulang render + bersih impor)

Hapus: `SAMPLES`, `amountOut`, `parseAmt`, `parseEther`, `fmtToken`
(tak terpakai lagi — awas lint unused).

Tambah formatter sekali di level modul:

```ts
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
```

Hook + hitung `ready`/`rW`/`rM`/`spot` TETAP PERSIS (factory→pair→reserves→token0
+ refetch per blok — tak tersentuh).

Render baru:

```tsx
  return (
    <Surface className="status-card" aria-label="Kurs pool live">
      <div className="wallet-header">
        <div>
          <span className="eyebrow">WBNB/MUSDC</span>
          <span className="value">{!ready || spot <= 0 ? "…" : usd.format(spot)}</span>
          <InfoTooltip>Kurs pool Pancake (mUSDC ≈ $1), diperbarui tiap blok. Bukan harga trigger strategi.</InfoTooltip>
        </div>
      </div>
      <div className="metric">
        <span className="label">Blok</span>
        <span className="value">{blockNumber === undefined ? "…" : `#${blockNumber.toString()}`}</span>
      </div>
      {!pairOk && pairAddr !== undefined && (
        <p className="err">Pool tak ditemukan.</p>
      )}
    </Surface>
  );
```

Hasil: `WBNB/MUSDC` kecil di atas, `$204.82` besar, baris `Blok #…` mungil.
Contoh angka memakai kurs live terakhir yang terverifikasi.

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- Hapus SEMUA referensi `fmtToken`, `parseEther`, `SAMPLES`, `amountOut`,
  `parseAmt`, `impact` — satu saja tertinggal = lint/tsc merah.
- `usd.format(spot)` butuh `spot` number hingga — guard `spot <= 0` sudah ada.
- Struktur `wallet-header` tanpa `.addr-actions` tetap valid (CSS grid aman).
