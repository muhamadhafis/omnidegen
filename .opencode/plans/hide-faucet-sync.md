# Hide faucet + sync indicator (UI saja, logika linking TETAP jalan)

Prinsip: yang disembunyikan hanya TAMPILAN. Fetch link-wallet, state
linkStatus/linkError, dan dlog tetap apa adanya (bot tetap dapat mapping
wallet). Backend NOL perubahan.

## Edit 1 — App.tsx (hapus 2 blok Notice + 1 import)

Hapus blok faucet (anchor terverifikasi baris 343-349):

```diff
-            {tele && (
-              <Notice aria-label="Isi saldo testnet">
-                <a className="utility-link" href={FAUCET} target="_blank" rel="noreferrer">
-                  Isi tBNB di faucet <span aria-hidden="true">→</span>
-                </a>
-              </Notice>
-            )}
```

Hapus blok status sync (baris 350-371, dari `{tele && (` pembuka kedua
sampai `)}` penutupnya).

Import: `FAUCET` keluar dari baris import config (cek `tele` tetap dipakai
di gate StrategiesPanel — ya, jangan hapus).

## Edit 2 — index.css (hapus CSS yatim, terverifikasi 0 pemakaian lain)

- `.utility-link` + `:hover` (~baris 324-333).
- `.link-status`, `.linked`, `.error`, `.status-row`, `.status-icon`,
  3 varian `.link-status.* .status-icon` (~450-456), plus `@keyframes spin`.
- `.spinner` (~497). `Notice` component tetap dipakai tempat lain — JANGAN hapus.

`FAUCET` export di config.ts DIBIARKAN (nol biaya, bisa dipakai lagi).

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
grep -rn "utility-link\|link-status\|status-row\|status-icon\|spinner\|FAUCET" src/ || echo bersih-kecuali-config
```

Jebakan yang diantisipasi:
- `linkStatus`/`linkError`/`tele` tetap dipakai (effect + gate) → tak ada
  unused-var.
- Jangan hapus `.link-status` sebelum blok tsx-nya (urutan bebas, tapi
  build akhir yang menentukan).

## Uji manual

Connect wallet → TIDAK ADA lagi baris faucet maupun status sync di bawah
StatusCard → cek `?debug=1`: baris `link-wallet: OK tersinkron` tetap muncul
(bukti mapping bot jalan) → kirim strategi via chat tetap bisa.
