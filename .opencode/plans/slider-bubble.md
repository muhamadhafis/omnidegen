# Bubble persen menempel di thumb slider (disetujui: selalu tampil + eksekusi)

Keputusan user: label tampil SELALU (bukan cuma saat drag).
Status: SIAP EKSEKUSI, tertunda permission `edit`.

## Edit 1 — miniapp/src/components/ui/slider.tsx

Ganti signature + tambah bubble (sisipkan sebelum `<SliderPrimitive.Track>`):

```diff
-export default function Slider({ className = "", ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
+type Props = ComponentProps<typeof SliderPrimitive.Root> & {
+  thumbLabel?: string; // bubble persen menempel di atas thumb (aria-hidden; nilai dibacakan thumb)
+};
+
+export default function Slider({ className = "", thumbLabel, min = 0, max = 100, value, ...props }: Props) {
   return (
     <SliderPrimitive.Root
-      className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
+      className={cn("relative flex w-full touch-none select-none items-center pb-2 pt-7", className)}
+      min={min}
+      max={max}
+      value={value}
       {...props}
     >
+      {thumbLabel !== undefined && (
+        <span
+          aria-hidden="true"
+          className="pointer-events-none absolute top-0 rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-accent"
+          style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}
+        >
+          {thumbLabel}
+        </span>
+      )}
       <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
```

Tambah hitung `pct` di badan komponen (setelah destructuring, sebelum return):

```ts
  const v = Array.isArray(value) ? value[0] ?? min : min;
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
```

Catatan:
- `left: pct%` + `translateX(-pct%)` = trik anti-overflow: 0% rata kiri,
  100% rata kanan, bubble tak pernah keluar track. Tanpa JS measuring.
- `aria-hidden` wajib: Radix thumb sudah expose aria-valuenow (anti dobel).
- `pt-7` memberi ruang bubble; semua utility sudah dipakai codebase (nol CSS baru).

## Edit 2 — miniapp/src/components/AmountInput.tsx (satu baris)

```diff
       <Slider
         value={[pct]}
         onValueChange={([p]) => setPct(p)}
         min={0}
         max={100}
         step={1}
         disabled={max === undefined}
         aria-label={`${label} dalam persen`}
+        thumbLabel={`${Math.round(pct)}%`}
       />
```

Empat kartu (Wrap/Approve/Unwrap/ReverseSwap) otomatis ikut tanpa diubah.

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `value` Radix bertipe `number[] | undefined` — guard `Array.isArray` sudah ada.
- oxlint no-unused-vars: `min`/`max`/`value` dipakai di pct + re-pass, aman.
- Jangan bungkus bubble dalam Thumb (thumb h-5 terlalu kecil untuk teks).
