# Reverse flows: UnwrapCard (WBNB→BNB) + ReverseSwapCard (mUSDC→WBNB)

Keputusan user: keduanya, slippage TETAP 2% (tanpa input user).
Status: SIAP EKSEKUSI, tertunda permission `edit`.
Prinsip: jiplak pola WrapCard/ApproveCard (useTx + WalletShortcuts + refetch);
Tx di-sign dompet user, backend tak tersentuh.

## Edit 1 — miniapp/src/abi.ts (tambah entri, jangan ubah yang ada)

```ts
export const wbnbAbi = [
  { type: "function", name: "deposit", inputs: [], outputs: [], stateMutability: "payable" },
  { type: "function", name: "withdraw", inputs: [{ name: "wad", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  ... // approve, allowance, balanceOf tetap
];

export const erc20Abi = [
  { type: "function", name: "balanceOf", ... },          // tetap
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
];

export const pancakeRouterAbi = [
  { type: "function", name: "getAmountsOut", inputs: [{ name: "amountIn", type: "uint256" }, { name: "path", type: "address[]" }], outputs: [{ name: "amounts", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "swapExactTokensForTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ name: "amounts", type: "uint256[]" }], stateMutability: "nonpayable" },
] as const;

export const vaultRouterAbi = [
  { type: "function", name: "router", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
] as const;
```

## Edit 2 — miniapp/src/components/UnwrapCard.tsx (baru, jiplak WrapCard)

- Props: `{ tx: TxHandle; onUnwrap: (amt: string) => void; complete?: boolean }`.
- Struktur section bernomor "03"? — CEK nomor urut di App setup-flow saat eksekusi
  (Wrap=01, Approve=02; sisip Unwrap sebagai 03 dan geser AlarmCard bila perlu —
  putuskan saat baca file, jangan tebak).
- Saat `tx.isPending` tampilkan `<WalletShortcuts />`; hash tampilkan link
  `SCAN_TX`; error tampilkan `.err` + focus (pola WrapCard persis).

## Edit 3 — miniapp/src/components/ReverseSwapCard.tsx (baru)

- Props: `{ txAppr: TxHandle; txSwap: TxHandle; onApprove: () => void; onSwap: (amt: string) => void }`
  (dua handle terpisah seperti pola wrap/appr di App).
- Quote: `useReadContract` router.`getAmountsOut` untuk nominal input
  (path [MUSDC, WBNB]); tampilkan estimasi WBNB + minimal diterima (quote − 2%).
- Tombol 1 "Approve mUSDC" (muncul bila allowance < nominal),
  tombol 2 "Tukar ke WBNB" (call swap dengan amountOutMin = quote*98/100,
  `to` = address user, deadline = now + 15 mnt).
- minOut dihitung dari quote TERAKHIR yang berhasil dibaca; bila quote belum ada,
  tombol swap disabled + pesan "memuat quote…".
- Pakai konstanta `SLIPPAGE_BPS = 200` lokal di file (frontend tak baca .env backend).

## Edit 4 — miniapp/src/App.tsx (wiring, ikuti pola wrap/appr yang ada)

- Router address: `useReadContract({ address: VAULT, abi: vaultRouterAbi,
  functionName: "router", query: { enabled: connected } })`.
- Allowance mUSDC→router: `useReadContract` erc20 allowance `[address, router]`.
- `const rAppr = useTx(); const rSwap = useTx();`
- `doUnwrap(amt)`: `parseEther`, `writeContract({ address: WBNB, abi: wbnbAbi,
  functionName: "withdraw", args: [parseEther(amt)] })`, alert Telegram bila nominal salah.
- `doApproveMusdc()`: approve router dengan `MaxUint256`? — TIDAK; ikuti pola
  ApproveCard: approve sebesar nominal swap (prinsip least-allowance konsisten).
  (Keputusan sadar: tiap ganti nominal perlu approve ulang — sama seperti vault.)
- `doReverseSwap(amt)`: hitung minOut dari quote hook + kirim swap.
- Refetch bnb/wbnb/musdc/allowances saat `rSwap.isSuccess` atau unwrap sukses
  (tambah ke effect refetch yang sudah ada).
- Render `<UnwrapCard>` + `<ReverseSwapCard>` di dalam `.setup-flow` setelah
  ApproveCard, sebelum AlarmCard. `readyTx` (syarat AlarmCard) TAK berubah.

## Edit 5 — verifikasi (frontend tak punya unit runner)

```bash
# workdir miniapp:
bunx tsc --noEmit && bun run lint && bun run build
```

Jebakan yang diantisipasi:
- `deadline` dalam DETIK unix (bukan ms): `BigInt(Math.floor(Date.now()/1000) + 900)`.
- `parseEther` untuk mUSDC: mUSDC 18 desimal di testnet ini (terbukti dari format
  on-chain 0.6488…) — pakai parseEther, JANGAN parseUnits(6).
- wagmi v3 `useReadContract` butuh `query: { enabled }` (pola file ini) —
  jangan pakai sintaks lama `enabled:`.
- Router address belum ada saatconnect awal → semua hook + tombol dependen
  harus guard `enabled: !!router` / disabled.

## Uji manual (user, testnet)

1. Unwrap 0.0005 WBNB → BNB naik, WBNB turun (cek StatusCard + bscscan).
2. Approve mUSDC secukupnya → swap 0.05 mUSDC → WBNB naik ±quote−2%.
3. Coba nominal > balance/allowance → error ramah, bukan revert mentah.
