# 1) Badge auto-render setelah revoke 2) Badge fill solid

## Diagnosis (terverifikasi dari kode)

1. Blok refetch kedua di App.tsx (baris 150-154) me-refetch wbnb/musdc/
   musdcAllow/bnb TAPI TIDAK `allow` (allowance WBNB→vault). Setelah revoke
   sukses, `allow.data` basi (nilai lama) → `ready` tetap true → badge macet
   di "Siap". Blok approve tidak bermasalah (ikut me-refetch allow).
2. StatusBadge kini teks polos berwarna; diminta jadi pill fill solid.

## Edit 1 — App.tsx (satu baris, akar masalah)

```diff
     if (unwrap.isSuccess || rAppr.isSuccess || rSwap.isSuccess || revoke.isSuccess) {
       wbnb.refetch();
       musdc.refetch();
+      allow.refetch();
       musdcAllow.refetch();
       bnb.refetch();
     }
```

## Edit 2 — StatusBadge.tsx (fill solid + teks putih)

```diff
-    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold ${ready ? "text-success" : "text-muted"}`}>
+    <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${ready ? "bg-success text-white" : "bg-muted text-white"}`}>
```

Kontras sudah lolos via simetri rasio terverifikasi: putih/#1A7F37 = 5.08,
putih/#636366 = 5.99. Utilitas `bg-success`/`bg-muted`/`text-white` tersedia
dari token @theme + Tailwind standar. Ikon Check/Shield + label teks tetap
(bukan sinyal warna-saja).

## Edit 3 — index.css (hapus CSS mati, terverifikasi 0 pemakaian tsx)

Hapus blok `.readiness-label` (baris ~228) dan `.readiness-dot` +
`.readiness.is-ready .readiness-dot` (~240-250). Status dot digantikan ikon
di StatusBadge; menghapus dead code, bukan mengubah tampilan.

## Verifikasi (workdir miniapp)

```bash
bunx tsc --noEmit && bun run lint && bun run build
grep -r "readiness-dot\|readiness-label" src/ || echo bersih
```

## Uji manual

1. Approve → badge hijau "Siap rescue" (fill).
2. Cabut Izin → tanpa reload, badge otomatis jadi abu "Belum siap…".
3. Approve lagi → kembali hijau otomatis.
