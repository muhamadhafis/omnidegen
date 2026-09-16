# Eksekusi: Opsi A — Perbaiki Privy tanpa embedded wallet

Keputusan user: Opsi A, embedded TIDAK wajib, eksekusi langsung.
Status: TERTUNDA — permission `edit` ditolak untuk semua path kecuali `.opencode/plans/`.
File ini berisi instruksi eksak agar eksekusi bisa jalan segera setelah permission dibuka
(atau dikerjakan manual).

## Konteks diagnosis (jangan diulang)

1. Rabby terpental = login eksternal + `createOnLogin: users-without-wallets` melahirkan
   embedded kedua → `useAccount` ambigu + `link-wallet` double-POST.
2. Sign loop MetaMask desktop = tersangka duel extension atas `window.ethereum`
   dan/atau efek auto-switch lama (efek sudah dihapus; butuh bukti log).
3. Mobile stuck = transport deep-link (terpisah, fix iframe sudah dibangun, tinggal uji).

Fakta penopang: `connectWallet` = connect saja tanpa SIWE (auth butuh `loginOrLink`
eksplisit yang tak pernah dipanggil); `useSetActiveWallet` tersedia di
`@privy-io/wagmi` 4.0.17; backend auth pakai Telegram initData (tak peduli SIWE).

## Langkah 1 — miniapp/src/config.ts

Hapus satu baris (embedded resmi dibuang):

```diff
   loginMethods: ["wallet"] as ["wallet"],
   supportedChains: [bscTestnet],
   defaultChain: bscTestnet,
-  embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" as const } },
```

`loginMethods: ["wallet"]` dipertahankan. `walletList` tidak berubah
(Telegram: metamask + wallet_connect; desktop: metamask + detected + wallet_connect).

## Langkah 2 — miniapp/src/App.tsx

2a. Import — tambah `useSetActiveWallet`:

```diff
 import { useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
+import { useSetActiveWallet } from "@privy-io/wagmi";
```

2b. Gate koneksi berbasis address saja (lepas gate SIWE; `authenticated` tetap
dibaca hanya untuk log):

```diff
-  const connected = authenticated && !!address;
-  const embedded = wallets.some((w) => w.walletClientType === "privy");
+  const connected = !!address;
```

2c. Aktifkan dompet eksternal saat connect sukses (obat ambiguitas dua wallet,
termasuk user lama yang sudah terlanjur punya embedded ter-link):

```diff
+  const { setActiveWallet } = useSetActiveWallet();
   const { connectWallet } = useConnectWallet({
-    onSuccess: () => {
+    onSuccess: ({ wallet }) => {
       if (connectTimer.current) clearTimeout(connectTimer.current);
       setConnecting(false);
-      dlog("connect: onSuccess (lanjut SIWE/address)");
+      dlog(`connect: onSuccess wallet=${wallet.address} type=${wallet.walletClientType}`);
+      setActiveWallet(wallet).catch((e) => dlog(`active-wallet: gagal (${e instanceof Error ? e.message : "?"})`));
     },
```

2d. Catat kondisi multi-wallet (bukti diagnosa, tanpa setState):

```diff
   // Transisi wallet (address/chain) — tanpa setState di effect, hanya catat.
   const prevWallet = useRef("");
   useEffect(() => {
     const cur = `${address ?? "-"}#${chainId ?? "?"}`;
     if (cur !== prevWallet.current) {
       prevWallet.current = cur;
       dlog(`wallet: address=${address ?? "-"} chainId=${chainId ?? "?"} auth=${authenticated}`);
     }
   }, [address, chainId, authenticated]);
+  useEffect(() => {
+    if (wallets.length > 1) dlog(`wallets: ${wallets.length} terhubung (${wallets.map((w) => w.walletClientType).join(",")})`);
+  }, [wallets]);
```

2e. Faucet notice untuk semua yang connected (bukan cuma embedded):

```diff
-            {tele && embedded && (
+            {tele && (
               <Notice aria-label="Isi saldo testnet">
```

2f. Hint desktop di Notice connect (satu extension aktif):

```diff
           <Notice aria-label="Hubungkan dompet" className="gap-2">
+            {!tele && (
+              <p className="muted">Aktifkan satu extension dompet (MetaMask ATAU Rabby) agar tidak konflik.</p>
+            )}
             <Button variant="primary" type="button" disabled={connecting} onClick={startConnect}>
```

2g. Call sites — hapus prop `embedded`:

```diff
-              <WrapCard tx={wrap} embedded={embedded} onWrap={doWrap} complete={(wbnb.data ?? 0n) > 0n} />
-              <ApproveCard tx={appr} embedded={embedded} onApprove={doApprove} onRevoke={doRevoke} complete={(allow.data ?? 0n) > 0n} />
+              <WrapCard tx={wrap} onWrap={doWrap} complete={(wbnb.data ?? 0n) > 0n} />
+              <ApproveCard tx={appr} onApprove={doApprove} onRevoke={doRevoke} complete={(allow.data ?? 0n) > 0n} />
```

`authenticated` tetap di-destructure (dipakai di log 2d). `logout` tetap dipakai.
`useWallets` tetap dipakai (efek 2d).

## Langkah 3 — WrapCard.tsx dan ApproveCard.tsx

Hapus prop `embedded`, selalu tampilkan shortcut saat pending:

```diff
-type Props = { tx: TxHandle; embedded: boolean; onWrap: (amt: string) => void };
+type Props = { tx: TxHandle; onWrap: (amt: string) => void };
-export default function WrapCard({ tx, embedded, onWrap, complete = false }: Props & { complete?: boolean }) {
+export default function WrapCard({ tx, onWrap, complete = false }: Props & { complete?: boolean }) {
-        {tx.isPending && !embedded && <WalletShortcuts />}
+        {tx.isPending && <WalletShortcuts />}
```

```diff
 type Props = {
   tx: TxHandle;
-  embedded: boolean;
   onApprove: (cap: string) => void;
   onRevoke: () => void;
 };
-export default function ApproveCard({ tx, embedded, onApprove, onRevoke, complete = false }: Props & { complete?: boolean }) {
+export default function ApproveCard({ tx, onApprove, onRevoke, complete = false }: Props & { complete?: boolean }) {
-        {tx.isPending && !embedded && <WalletShortcuts />}
+        {tx.isPending && <WalletShortcuts />}
```

`WalletShortcuts.tsx` TIDAK berubah (sudah MetaMask + Rabby via WALLETS).

## Langkah 4 — Verifikasi (wajib hijau semua)

```bash
# matrix transport (tak tersentuh, smoke test)
bun -e '...' # resolveWalletOpen 6 kasus (lihat riwayat sesi)
# miniapp
bunx tsc --noEmit && bun run lint && bun run build
# backend
bun test
```

Perhatian saat verifikasi:
- `tsc` mungkin komplain tipe param `onSuccess ({ wallet })` atau return
  `setActiveWallet` — sesuaikan annotasi mengikuti pesan error, JANGAN pakai `any`.
- `lint` pola set-state-in-effect: efek baru hanya `dlog` (bukan setState) → bersih.

## Kriteria selesai

- Desktop satu extension: connect tanpa sign-loop; Rabby connect tanpa dompet kedua.
- `?debug=1` menampilkan `active-wallet` + transisi `auth=` sebagai bukti.
- Mobile: tetap observasi via log (transport terpisah).

## Fallback bila bukti baru muncul

Jika log menunjukkan SIWE prompt TANPA `loginOrLink` dari kode (auto-auth Privy),
tambahkan tombol "Aktifkan Strategi (Sign)" eksplisit yang memanggil
`wallets[0].loginOrLink()` — JANGAN kembalikan gate `authenticated`.
