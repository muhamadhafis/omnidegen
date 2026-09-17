# Amount slider + chips persen + default 0 (disetujui: keduanya, wrap-100 + warning)

Keputusan user: slider + chips 25/50/75/100%; default "0" semua input;
tombol disabled saat 0/over; wrap-100 boleh + hint gas.
Status: SIAP EKSEKUSI, tertunda permission `edit`.

## 0. Install (satu dependensi baru)

```bash
bun add @radix-ui/react-slider
```
(workdir miniapp)

## 1. miniapp/src/components/ui/slider.tsx (baru, gaya shadcn + file ui/ lain)

```tsx
import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export default function Slider({ className = "", ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label="Persentase jumlah"
        className="block h-5 w-5 rounded-full border-2 border-accent bg-card shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}
```

## 2. miniapp/src/lib/format.ts (tambah, jangan ubah yang ada)

```ts
// string kompatibel parseEther: titik desimal, tanpa grouping, tanpa trailing nol,
// tanpa pembulatan (nilai presisi penuh).
export function formatAmt(v: bigint): string {
  const [i, f = ""] = formatEther(v).split(".");
  const frac = f.replace(/0+$/, "");
  return frac ? `${i}.${frac}` : i;
}

// parse aman untuk input ketikan (gagal/“” → 0n, tak pernah throw).
export function parseAmtSafe(s: string): bigint {
  try {
    const t = s.trim().replace(",", ".");
    if (!t) return 0n;
    return parseEther(t);
  } catch {
    return 0n;
  }
}

export const pctOf = (balance: bigint, pct: number): bigint =>
  (balance * BigInt(Math.max(0, Math.min(100, Math.round(pct))))) / 100n;
```

## 3. miniapp/src/components/AmountInput.tsx (baru, dipakai 4 kartu)

```tsx
import { fmtToken, formatAmt, parseAmtSafe, pctOf } from "../lib/format";
import Input from "./ui/Input";
import Slider from "./ui/slider";

type Props = {
  id: string;
  label: string;
  symbol: string;
  value: string;
  onChange: (v: string) => void;
  max: bigint | undefined; // saldo acuan persen; undefined = slider/chips nonaktif
};

const STEPS = [25, 50, 75, 100];

export default function AmountInput({ id, label, symbol, value, onChange, max }: Props) {
  const parsed = parseAmtSafe(value);
  const pct =
    max === undefined || max <= 0n
      ? 0
      : Math.min(100, Math.max(0, (Number(parsed) / Number(max)) * 100));
  const setPct = (p: number) => {
    if (max === undefined) return;
    onChange(p <= 0 ? "0" : formatAmt(pctOf(max, p)));
  };
  return (
    <div className="amount-field">
      <Input id={id} label={label} name={id} autoComplete="off" spellCheck={false}
        inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="0" />
      <div className="amount-meta">
        <span>Saldo: {fmtToken(max)} {symbol}</span>
      </div>
      <Slider value={[pct]} onValueChange={([p]) => setPct(p)} min={0} max={100} step={1}
        disabled={max === undefined} aria-label={`${label} dalam persen`} />
      <div className="chips" role="group" aria-label="Persen cepat">
        {STEPS.map((p) => (
          <button key={p} type="button" className="chip" disabled={max === undefined} onClick={() => setPct(p)}>
            {p === 100 ? "Maks" : `${p}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## 4. index.css (tambah di dekat .flow-label)

```css
.amount-field {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.amount-meta {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
}
```

(`.chips`/`.chip` sudah ada — dipakai ulang dari WalletShortcuts.)

## 5. Empat kartu (pola identik per kartu)

WrapCard (`max` = saldo BNB):
- Props tambah `max: bigint | undefined`; state awal `"0.001"` → `"0"`.
- Ganti blok `<Input …/>` dengan `<AmountInput id="wrap-amount" label="Jumlah BNB"
  symbol="BNB" value={amt} onChange={setAmt} max={max} />`.
- Tombol: `disabled={tx.isPending || parseAmtSafe(amt) <= 0n || (max !== undefined && parseAmtSafe(amt) > max)}`
  (import parseAmtSafe dari ../lib/format).
- Tambah hint gas di bawah tombol:
  `{max !== undefined && max > 0n && parseAmtSafe(amt) >= max && parseAmtSafe(amt) > 0n && (
    <p className="warn">Hati-hati: wrap 100% menghabiskan BNB untuk gas transaksi berikutnya.</p>
  )}`
- Hapus import Input bila tak terpakai lagi.

ApproveCard (`max` = saldo WBNB): sama, id `approve-cap`, label "Batas WBNB",
symbol "WBNB", callback tetap `onApprove(cap)` (cap kini dari slider/input).
Revoke tak berubah.

UnwrapCard (`max` = saldo WBNB): sama, id `unwrap-amount`, label "Jumlah WBNB".

ReverseSwapCard (`max` = saldo mUSDC): ganti Input dengan AmountInput
(id `rswap-amount`, label "Jumlah mUSDC"); `parsed` tetap dari state `amt`
(ganti helper lokal dengan `parseAmtSafe` import — hapus fungsi lokalnya);
tombol swap disabled tambah syarat `parsed > (max ?? -1n)`? — over-max:
`max !== undefined && parsed > max`. Quote hook tak berubah (pakai `parsed`).

## 6. App.tsx (oper `max`, tak ada logika baru)

```diff
-              <WrapCard tx={wrap} onWrap={doWrap} complete={(wbnb.data ?? 0n) > 0n} />
-              <ApproveCard tx={appr} onApprove={doApprove} onRevoke={doRevoke} complete={(allow.data ?? 0n) > 0n} />
+              <WrapCard tx={wrap} onWrap={doWrap} max={bnb.data?.value} complete={(wbnb.data ?? 0n) > 0n} />
+              <ApproveCard tx={appr} onApprove={doApprove} onRevoke={doRevoke} max={wbnb.data as bigint | undefined} complete={(allow.data ?? 0n) > 0n} />
```

```diff
-              <UnwrapCard tx={unwrap} onUnwrap={doUnwrap} complete={false} />
-              <ReverseSwapCard appr={rAppr} swap={rSwap} router={routerAddr} allowance={musdcAllow.data as bigint | undefined} onApprove={doApproveMusdc} onSwap={doReverseSwap} />
+              <UnwrapCard tx={unwrap} onUnwrap={doUnwrap} max={wbnb.data as bigint | undefined} complete={false} />
+              <ReverseSwapCard appr={rAppr} swap={rSwap} router={routerAddr} allowance={musdcAllow.data as bigint | undefined} max={musdc.data as bigint | undefined} onApprove={doApproveMusdc} onSwap={doReverseSwap} />
```

## 7. Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `Slider` Radix `value`/`onValueChange` bertipe `number[]` — bungkus array
  satu elemen seperti contoh.
- `parseEther` throw untuk input kosong/invalid → selalu lewat parseAmtSafe.
- `Number(bigint)` untuk posisi slider: presisi cukup untuk UI (bukan untuk Tx;
  Tx selalu dari string via parseEther).
- `chip` disabled saat `max` undefined (saldo belum termuat).
- oxlint no-unused-vars: pastikan import Input/parseAmt di tiap kartu yang
  diganti dibersihkan.

## Uji manual

1. Tiap kartu default "0", slider di 0, tombol utama disabled.
2. Chips 25/50/75/Maks mengisi input sesuai saldo; slider mengikuti ketikan.
3. Wrap 100% → hint gas muncul; submit 0 → tak bisa.
4. ReverseSwap: pilih 50% → quote tampil → approve bila perlu → swap jalan.
