# Auto-refresh tab Transaksi saat ada Tx baru (tanpa refresh manual)

Prinsip: event-driven (bukan polling interval). Satu event global dari pintu
lapor Tx yang sudah ada → StrategiesPanel refetch. Nol perubahan TokenTabs/App.

## Edit 1 — miniapp/src/lib/txlog.ts (dispatch event, 3 baris)

Di `reportWalletTx`, setelah `sent.add(input.hash);` tambah:

```ts
    try {
      window.dispatchEvent(new CustomEvent("Omnidegen:tx", { detail: { hash: input.hash } }));
    } catch {
      /* non-browser: abaikan */
    }
```

## Edit 2 — miniapp/src/components/StrategiesPanel.tsx (listener + refetch)

Setelah effect mount (baris `}, [initData]); // eslint-disable-line...`), tambah:

```ts
  // refresh otomatis saat Tx dompet baru dilaporkan (tokenTabs → txlog):
  // langsung (status submitted terlihat seketika) + sekali lagi 15 dtk kemudian
  // (menangkap konfirmasi success/failed tanpa aksi user).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onTx = () => {
      fetchAll();
      if (t) clearTimeout(t);
      t = setTimeout(fetchAll, 15_000);
    };
    window.addEventListener("Omnidegen:tx", onTx);
    return () => {
      window.removeEventListener("Omnidegen:tx", onTx);
      if (t) clearTimeout(t);
    };
  }, [initData]); // eslint-disable-line react-hooks/exhaustive-deps
```

Catatan sadar:
- `fetchAll` closure awal aman (hanya setState + initData stabil).
- GET /api/txs tiap refetch menjalankan verifikasi receipt server-side,
  jadi baris submitted ter-upgrade otomatis — tak perlu logika status di frontend.
- Tak ada polling saat idle: nol request tambahan bila user tak bertransaksi.
- Diluar cakupan (sengaja): eksekusi vault dari bot (bukan Tx frontend) tetap
  terlihat saat buka tab/kembali — tambah bila diminta (opsi: refetch saat tab
  diklik).

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
```

## Uji manual

1. Swap kecil → tab Transaksi (n+1) muncul baris submitted TANPA pindah tab manual.
2. Tunggu ~15 dtk → badge jadi success (+ link Tx) sendiri.
3. Gagalkan satu Tx (nominal over) → baris failed tercatat otomatis.
