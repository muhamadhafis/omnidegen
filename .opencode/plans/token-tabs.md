# TokenTabs: 4 kartu → 1 panel tab + reset 0% (disetujui: Radix Tabs, AlarmCard tetap)

Keputusan user: Radix Tabs; AlarmCard tetap di bawah; reset tiap sukses + ganti tab.
Status: SIAP EKSEKUSI, tertunda permission `edit`.
Catatan cakupan: riwayat limit-10 + load-more BELUM disetujui → tidak termasuk.

## Langkah 0 — commit kerja slider yang tertunda (WAJIB DULU)

File: miniapp/package.json + bun.lock (radix slider), ui/slider.tsx,
AmountInput.tsx, lib/format.ts, WrapCard/ApproveCard/UnwrapCard/ReverseSwapCard,
App.tsx, index.css (.amount-field dkk).

Pesan: `feat(miniapp): input persen slider + chips untuk semua nominal token`

## Langkah 1 — install

```bash
bun add @radix-ui/react-tabs
```
(workdir miniapp)

## Langkah 2 — miniapp/src/components/TokenTabs.tsx (baru, pengganti 4 kartu)

```tsx
import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useReadContract } from "wagmi";
import { MUSDC, SCAN_TX, WBNB } from "../config";
import { pancakeRouterAbi } from "../abi";
import type { TxHandle } from "../hooks/useTx";
import { fmtToken, parseAmtSafe } from "../lib/format";
import AmountInput from "./AmountInput";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import Button from "./ui/Button";
import { ExternalLink } from "lucide-react";

type TabId = "wrap" | "approve" | "unwrap" | "swap";

const TABS: { id: TabId; label: string; tip: string }[] = [
  { id: "wrap", label: "Wrap BNB", tip: "Wrap mengubah BNB menjadi WBNB agar vault dapat menjalankan rescue." },
  { id: "approve", label: "Approve Vault", tip: "Approve memberi vault izin terbatas untuk menarik WBNB saat alarm aktif. Izin dapat dicabut kapan saja." },
  { id: "unwrap", label: "Unwrap WBNB", tip: "Unwrap mengubah WBNB kembali menjadi BNB native." },
  { id: "swap", label: "Tukar mUSDC", tip: "Swap balik via Pancake dengan slippage tetap 2%. Setujui dulu bila izin kurang." },
];

const SLIPPAGE_BPS = 200;

type Props = {
  bnb: bigint | undefined;
  wbnb: bigint | undefined;
  musdc: bigint | undefined;
  allowVault: bigint | undefined;
  allowRouter: bigint | undefined;
  router: `0x${string}` | undefined;
  wrap: TxHandle; appr: TxHandle; unwrap: TxHandle; rAppr: TxHandle; rSwap: TxHandle;
  onWrap: (amt: string) => void;
  onApproveVault: (cap: string) => void;
  onRevoke: () => void;
  onUnwrap: (amt: string) => void;
  onApproveMusdc: (amt: string) => void;
  onReverseSwap: (amt: string, minOut: bigint) => void;
};
```

Isi komponen:

- `const [tab, setTab] = useState<TabId>("wrap");`
- `const [amt, setAmt] = useState("0");`
- `const parsed = parseAmtSafe(amt);`
- max per tab: `{ wrap: bnb, approve: wbnb, unwrap: wbnb, swap: musdc }[tab]`
- symbol per tab: `{ wrap: "BNB", approve: "WBNB", unwrap: "WBNB", swap: "mUSDC" }[tab]`
- label input per tab: `{ wrap: "Jumlah BNB", approve: "Batas WBNB", unwrap: "Jumlah WBNB", swap: "Jumlah mUSDC" }[tab]`
- Reset: `const watchTx = { wrap, approve: appr, unwrap, swap: rSwap }[tab];`
  ```ts
  useEffect(() => { if (watchTx.isSuccess) setAmt("0"); }, [watchTx.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAmt("0"); }, [tab]);
  ```
  (Catatan sadar: reset HANYA saat aksi primer sukses — approve mUSDC sukses
  TIDAK me-reset agar user lanjut tap swap. `watchTx` untuk tab swap = rSwap.)
- Quote (khusus tab swap, pindahan logika ReverseSwapCard):
  ```ts
  const quote = useReadContract({ address: router, abi: pancakeRouterAbi,
    functionName: "getAmountsOut", args: [parsed, [MUSDC, WBNB]],
    query: { enabled: tab === "swap" && !!router && parsed > 0n } });
  const out = quote.data?.[1] as bigint | undefined;
  const minOut = out !== undefined ? (out * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n : undefined;
  useEffect(() => { if (rSwap.isSuccess) quote.refetch(); }, [rSwap.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps
  ```
- `needsApprove = (allowRouter ?? 0n) < parsed` (tab swap).
- `overMax = max !== undefined && parsed > max`; `empty = parsed <= 0n`.
- Tombol primer per tab:
  - wrap: `Wrap BNB` (label `Sudah di-wrap` bila `(wbnb ?? 0n) > 0n`, pertahankan
    perilaku WrapCard), onClick `onWrap(amt)`, disabled `wrap.isPending || empty || overMax`.
  - approve: `Approve Vault` (`Sudah di-approve` bila `(allowVault ?? 0n) > 0n`),
    onClick `onApproveVault(amt)`, disabled `appr.isPending || empty || overMax`.
  - unwrap: `Unwrap WBNB`, onClick `onUnwrap(amt)`, disabled `unwrap.isPending || empty || overMax`.
  - swap: bila needsApprove → `Approve mUSDC` (onClick `onApproveMusdc(amt)`,
    disabled `busy || empty` — approve di atas saldo BOLEH, jangan gate overMax);
    bila tidak → `Tukar ke WBNB` (onClick `minOut !== undefined && onReverseSwap(amt, minOut)`,
    disabled `busy || empty || overMax || !router || out === undefined`).
- Tombol secondary HANYA tab approve, di bawah primer (pindahan ApproveCard):
  `Cabut Izin` + state `asking` + `window.confirm` + `onRevoke()`.
- Area status (satu blok, isi tergantung tab):
  - overMax → `<p className="err">Nominal melebihi saldo {symbol}.</p>`
  - wrap-100 gas hint (syarat persis WrapCard kini).
  - baris quote (tab swap): `.metric` estimasi + min, reuse fmtToken.
  - hash link: hash handle relevan per tab (wrap/unwrap: tx.hash; approve:
    appr.hash; swap: swap.hash ?? appr.hash) via SCAN_TX + class `tx`.
  - error handle relevan: pesan `Gagal …: {msg slice 100}` + pola focus errRef
    (pindahan kartu).
  - `busy && <WalletShortcuts />`.
- Struktur Tabs Radix:
  ```tsx
  <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabId)}>
    <Tabs.List className="..." aria-label="Fitur token">
      {TABS.map((t) => (
        <Tabs.Trigger key={t.id} value={t.id} className="...">{t.label}</Tabs.Trigger>
      ))}
    </Tabs.List>
    <h2>{title} <InfoTooltip>{tip}</InfoTooltip></h2>
    <AmountInput ... />
    ...tombol + status...
  </Tabs.Root>
  ```
  Styling trigger: reuse `.chip`? chip didesain untuk WalletShortcuts —
  CEK visual saat eksekusi; bila janggal buat class `.tab-trigger` minimal di
  index.css (aria-selected state via `data-state="active"` Radix:
  selektor `.tab-trigger[data-state="active"]`).

## Langkah 3 — App.tsx

- Import TokenTabs; HAPUS import WrapCard/ApproveCard/UnwrapCard/ReverseSwapCard.
- Hapus pemakaian 4 kartu; ganti satu blok:
  ```tsx
  <div className="setup-flow" aria-label="Aksi token">
    <div className="flow-label">Aksi token</div>
    <TokenTabs bnb={bnb.data?.value} wbnb={wbnb.data as bigint | undefined}
      musdc={musdc.data as bigint | undefined}
      allowVault={allow.data as bigint | undefined}
      allowRouter={musdcAllow.data as bigint | undefined}
      router={routerAddr} wrap={wrap} appr={appr} unwrap={unwrap}
      rAppr={rAppr} rSwap={rSwap} onWrap={doWrap} onApproveVault={doApprove}
      onRevoke={doRevoke} onUnwrap={doUnwrap} onApproveMusdc={doApproveMusdc}
      onReverseSwap={doReverseSwap} />
    <AlarmCard ready={readyTx} />
  </div>
  ```
  (Hapus blok setup-flow "Tukar balik" lama; AlarmCard tetap di bawah.)
- Handler doWrap/doApprove/doRevoke/doUnwrap/doApproveMusdc/doReverseSwap TETAP
  (tak berubah).

## Langkah 4 — hapus 4 file kartu

`WrapCard.tsx`, `ApproveCard.tsx`, `UnwrapCard.tsx`, `ReverseSwapCard.tsx`
(pakai `rm`; pastikan tak ada import sisa via grep).

## Langkah 5 — verifikasi (workdir miniapp + root)

```bash
bun test && bunx tsc --noEmit -p tsconfig.json   # root: backend tak tersentuh, smoke
bunx tsc --noEmit && bun run lint && bun run build  # miniapp
```

Jebakan yang diantisipasi:
- `Tabs.Trigger` Radix butuh `value` string unik — pakai id tab.
- `onValueChange` bertipe string → cast `as TabId`.
- `useReadContract` wagmi v3: tetap pola `query: { enabled }`.
- `minOut!` non-null assertion hanya di dalam guard `minOut !== undefined`.
- oxlint no-unused-vars: hapus import Input/parseEther lokal yang tak terpakai
  (logika pindah ke TokenTabs).
- Setelah hapus kartu: grep `WrapCard|ApproveCard|UnwrapCard|ReverseSwapCard`
  harus nol kecuali TokenTabs.

## Uji manual

1. Tiap tab default "0", tombol mati; slider/chips mengisi; ganti tab → reset 0.
2. Selesaikan satu wrap → amount kembali "0" otomatis.
3. Tab approve: tombol Cabut Izin hanya di sini.
4. Tooltip judul berubah per tab.
5. Swap: quote tampil, approve→swap berurutan tanpa reset di tengah.
