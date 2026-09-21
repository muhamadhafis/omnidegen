# Ikon token abu-abu + rapatkan gap Y di StatusCard

Sumber artwork terverifikasi: mark BNB resmi dari `bnb-chain/wallet-assets`
(`assets/BNB/logo.svg`, lingkaran gelap dibuang, hanya 2 path mark dipakai
dengan `fill="currentColor"`). mUSDC TAK PUNYA artwork resmi (token mock) →
glyph generik Lucide (bukan logo palsu), alasan dicatat (R-04/R-23).

## Edit 1 — StatusCard.tsx (satu-satunya file tsx; Metric lokal)

```tsx
import { CircleDollarSign } from "lucide-react"; // glyph generik: mUSDC mock tanpa artwork resmi

function BnbMark({ size = 16 }: { size?: number }) {
  // Mark BNB resmi (sumber: bnb-chain/wallet-assets), currentColor = abu muted.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="currentColor" aria-hidden="true">
      <path d="M34.5355 42.4676L48.0002 29.0032L61.4717 42.4747L69.3063 34.6397L48.0002 13.3333L26.7007 34.6328L34.5355 42.4676ZM21.1683 40.1646L29.003 47.9993L21.1679 55.8344L13.3333 47.9997L21.1683 40.1646ZM34.5355 53.5322L48.0002 66.9962L61.4714 53.5254L69.3105 61.3562L69.3063 61.3602L48.0002 82.6666L26.7004 61.3672L26.6895 61.3564L34.5355 53.5322ZM82.6674 48.0007L74.8327 55.8353L66.9981 48.0007L74.8327 40.166L82.6674 48.0007Z" />
      <path d="M55.9466 47.996H55.9502L47.9999 40.0456L40.0457 47.9998L40.0565 48.0109L47.9999 55.9543L55.9539 47.9998L55.9466 47.996Z" />
    </svg>
  );
}
```

`Metric` tambah prop ikon (label tetap string, ikon opsional di depannya):

```diff
-function Metric({ label, value }: { label: string; value: string }) {
+function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
   return (
-    <div className="metric mx-0.5">
-      <span className="label">{label}</span>
+    <div className="metric metric-tight mx-0.5">
+      <span className="label token-label">{icon}{label}</span>
       <span className="value">{value}</span>
     </div>
   );
 }
```

Pemakaian (import type ReactNode; CircleDollarSign size 16):

```diff
-        <Metric label="WBNB" value={fmtToken(wbnb)} />
-        <Metric label="mUSDC" value={fmtToken(musdc)} />
+        <Metric label="WBNB" value={fmtToken(wbnb)} icon={<BnbMark />} />
+        <Metric label="mUSDC" value={fmtToken(musdc)} icon={<CircleDollarSign aria-hidden="true" size={16} strokeWidth={1.8} />} />
```

## Edit 2 — index.css (scoped, tanpa ubah .metric global)

```css
.metric-tight {
  padding: 3px 0;
}

.token-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
}
```

Ikon mewarisi abu muted (#636366, 5.99) via currentColor → "abu2" seragam
untuk keduanya, tanpa warna/warna baru (R-29 aman).

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `CircleDollarSign` harus ada di lucide-react@1.46 — tsc yang memutuskan;
  fallback: `DollarSign` (pasti ada).
- `ReactNode` import type di StatusCard.
- Ikon `aria-hidden` (label teks di sebelahnya sudah cukup; anti dobel baca).
- Jangan sentuh `.metric` global (dipakai PoolLiveCard/TokenTabs).
