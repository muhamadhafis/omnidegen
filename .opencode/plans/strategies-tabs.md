# Kartu Strategi 3-tab gabungan (disetujui: Aktif + Riwayat + Transaksi)

Keputusan user: 3 tab dalam satu kartu, dengan count di label.
Status: SIAP EKSEKUSI, tertunda permission `edit`.
Backend NOL perubahan (3 endpoint sudah ada).

## Langkah 1 — miniapp/src/components/StrategiesPanel.tsx (baru)

Gabungan StrategyCard + TxHistory. Struktur:

```tsx
import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { API_URL, apiHeaders, SCAN_TX } from "../config";
import { inTelegram, shortAddr } from "../telegram";
import Button from "./ui/Button";
import Surface from "./ui/Surface";
import { X } from "lucide-react";

type Strategy = { id, intent_type, asset_to_monitor, action_asset,
  trigger_price, status, user_wallet, tx_hash? } (salin dari StrategyCard kini);
type TxItem = { id, kind, amount, token, tx_hash, status, created_at }
  (salin dari TxHistory kini);
const KIND_LABEL = { wrap, unwrap, approve, revoke, swap } (pindahan TxHistory);
const STATUS_CLASS = { submitted, success, failed } (pindahan TxHistory);

function StrategyItem({ s, onCancel }: { s: Strategy; onCancel?: (id: number) => void }) {
  // SATU renderer dipakai tab Aktif (dengan onCancel) dan Riwayat (tanpa):
  // strategy-type, detail arah+harga, Dompet shortAddr, link Tx bila hash real,
  // badge strategy-status, tombol X hanya bila s.status === "active" && onCancel.
}

function TxRow({ t }: { t: TxItem }) {
  // pindahan isi <li> TxHistory kini (label kind, jumlah token, waktu slice,
  // link Tx, badge STATUS_CLASS).
}

export default function StrategiesPanel({ initData }: { initData: string }) {
  // state: strategies, history, txs, loading, error, tab ("active"|"history"|"txs")
  // fetchAll(): GET /api/me → strategies; GET /api/history → history non-active;
  //   GET /api/txs?limit=20 → txs. Pola try/catch/finally StrategyCard kini.
  // useEffect(fetchAll, [initData]) + eslint-disable seperti pola file ini.
  // cancelStrategy(id): POST cancel → fetchAll().
  // if (!inTelegram()) return null;
  // Surface > Tabs.Root > Tabs.List.panel-tabs (3 Trigger .tab-trigger
  //   dengan count: `Aktif ({strategies.length})` dst) + 3 Tabs.Content.
  // Empty-state tiap tab reuse teks muted yang ada kini.
}
```

Aturan: JANGAN ubah teks/behavior fetch/cancel — murni pindah + bungkus Tabs.

## Langkah 2 — App.tsx

```diff
-import StrategyCard from "./components/StrategyCard";
-import TxHistory from "./components/TxHistory";
+import StrategiesPanel from "./components/StrategiesPanel";
```

```diff
             {tele && address && telegramInitData() && (
-              <>
-                <StrategyCard initData={telegramInitData()} />
-                <TxHistory initData={telegramInitData()} />
-              </>
+              <StrategiesPanel initData={telegramInitData()} />
             )}
```

## Langkah 3 — hapus file lama + CSS

```bash
rm miniapp/src/components/StrategyCard.tsx miniapp/src/components/TxHistory.tsx
grep -r "StrategyCard\|TxHistory" miniapp/src/ || echo bersih
```

`index.css`, tambah setelah `.token-tabs` (atau akhir blok tab):

```css
.panel-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
```

(`.tab-trigger` dipakai ulang apa adanya; label pendek + count muat di 1/3 lebar HP.)

## Langkah 4 — verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `Tabs.Content` default unmount tab tak aktif — disengaja (hemat render).
- `onValueChange` bertipe string → cast ke union tab.
- `shortAddr`, `SCAN_TX`, regex hash real dipakai ulang persis (jangan tulis ulang).
- oxlint exhaustive-deps: ikuti pola eslint-disable yang sudah ada di file asal.

## Uji manual

1. Tab Aktif (n) → batalkan satu → count berkurang, Riwayat bertambah.
2. Tab Riwayat → executed ber-link Tx valid; failed/cancelled tanpa link mati.
3. Tab Transaksi → badge submitted/success/failed + link.
4. Kosong semua → tiap tab tampilkan empty-state, bukan blank.
