# Kartu Kurs Pool Live (disetujui: kartu tersendiri, on-chain + per blok)

Keputusan user: kartu terpisah; data on-chain via RPC existing; refresh tiap
blok baru saat tampil (bukan timer buta).
Status: SIAP EKSEKUSI, tertunda permission `edit`.
Backend NOL perubahan (murni read contract).

## Edit 1 — miniapp/src/abi.ts (tambah, jangan ubah yang ada)

- Di `pancakeRouterAbi`, tambah entri:
```ts
{ type: "function", name: "factory", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
```
- Konstanta baru:
```ts
export const pancakeFactoryAbi = [
  { type: "function", name: "getPair", inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }], outputs: [{ name: "pair", type: "address" }], stateMutability: "view" },
] as const;

export const pancakePairAbi = [
  { type: "function", name: "getReserves", inputs: [], outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }], stateMutability: "view" },
  { type: "function", name: "token0", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;
```

## Edit 2 — miniapp/src/components/PoolLiveCard.tsx (baru)

```tsx
import { useEffect } from "react";
import { useBlockNumber, useReadContract } from "wagmi";
import { parseEther } from "viem";
import { MUSDC, WBNB } from "../config";
import { pancakeFactoryAbi, pancakePairAbi, pancakeRouterAbi } from "../abi";
import { fmtToken } from "../lib/format";
import { InfoTooltip } from "./ui/tooltip";
import Surface from "./ui/Surface";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const SAMPLES = ["0.001", "0.01", "0.1"];

// Estimasi AMM Pancake (fee 0,25%) murni dari cadangan — untuk DISPLAY.
// Eksekusi tetap memakai quote router (source of truth).
function amountOut(amountIn: bigint, rIn: bigint, rOut: bigint): bigint {
  if (amountIn <= 0n || rIn <= 0n || rOut <= 0n) return 0n;
  const ainFee = amountIn * 9975n;
  return (ainFee * rOut) / (rIn * 10_000n + ainFee);
}

export default function PoolLiveCard({ router }: { router: `0x${string}` | undefined }) {
  const { data: blockNumber } = useBlockNumber({ watch: true, query: { enabled: !!router } });
  const factory = useReadContract({ address: router, abi: pancakeRouterAbi, functionName: "factory", query: { enabled: !!router } });
  const factoryAddr = factory.data as `0x${string}` | undefined;
  const pair = useReadContract({ address: factoryAddr, abi: pancakeFactoryAbi, functionName: "getPair", args: [WBNB, MUSDC], query: { enabled: !!factoryAddr } });
  const pairAddr = pair.data as `0x${string}` | undefined;
  const reserves = useReadContract({ address: pairAddr, abi: pancakePairAbi, functionName: "getReserves", query: { enabled: !!pairAddr && pairAddr !== ZERO } });
  const t0 = useReadContract({ address: pairAddr, abi: pancakePairAbi, functionName: "token0", query: { enabled: !!pairAddr && pairAddr !== ZERO } });

  useEffect(() => {
    if (blockNumber !== undefined) {
      factory.refetch(); pair.refetch(); reserves.refetch(); t0.refetch();
    }
  }, [blockNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // hitung spot + dampak (guard semua undefined)
  ...
  // render Surface "Kurs Pool Live": baris 1 WBNB = X mUSDC; 1 mUSDC = Y WBNB;
  // cadangan; Blok #N (bukti kesegaran); tabel dampak 3 sample.
  // pair === ZERO → "Pool tak ditemukan." loading → "…".
}
```

Detail render (ikuti pola StatusCard: `.metric` + `.label`/`.value`, `InfoTooltip`
" Harga dari pool Pancake, diperbarui tiap blok.").

## Edit 3 — miniapp/src/App.tsx

- Import PoolLiveCard; render `<PoolLiveCard router={routerAddr} />` tepat di
  atas blok setup-flow "Tukar balik" (dalam branch connected yang sama).

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `useBlockNumber({ watch: true })` — bila tsc protes di wagmi v3, fallback:
  `query: { refetchInterval: 12_000 }` pada hook reserves (catat di kode bila diganti).
- `factory.data`/`pair.data` bertipe address|undefined — cast eksplisit seperti contoh.
- `getReserves` return tuple → akses `[0]`, `[1]`; samakan sisi via `token0`.
- `Number()` untuk rasio: cadangan testnet kecil, aman; mainnet besar tetap
  dalam batas double untuk DISPLAY (bukan untuk Tx).
- Pair ZERO (pool belum ada) → jangan panggil reserves (enabled guard + pesan).
```

## Uji manual

1. Nilai cocok dengan bscscan (read contract pair).
2. Kirim Tx apapun (wrap kecil) → dalam ~1 blok angka + Blok #N berubah.
3. Putus koneksi → tetap tampil data terakhir, bukan crash.
