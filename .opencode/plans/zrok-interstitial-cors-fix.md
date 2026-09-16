# Fix: bypass interstitial zrok + header CORS hilang (penyebab "Failed to fetch")

## Diagnosis (read-only, terverifikasi dari kode)

1. `GET /api/me` dan `POST /api/intents/:id/cancel` mengirim header custom
   `x-telegram-init-data`, tetapi `corsHeaders` di `src/api.ts` hanya
   mengizinkan `content-type`. Preflight browser MENOLAK → `TypeError:
   Failed to fetch` — deterministik, di semua platform.
   → Ini menjelaskan "strategi aktif Failed to fetch".
2. Perbandingan "desktop normal" tidak valid: `StrategyCard` return null di luar
   Telegram (`if (!inTelegram()) return null`) dan efek link-wallet early-return
   tanpa initData — desktop TAK PERNAH memanggil API, jadi tak ada error.
3. "Gagal sinkron (link-wallet) Failed to fetch" beda sebab: POST itu preflight-nya
   lolos (cuma butuh content-type) → gagalnya murni jaringan (tunnel flap /
   HP tak mencapai zrok).
4. Interstitial zrok ("Visit Share") mengembalikan HTML 200 ke `fetch()` —
   dilewati resmi via header `skip_zrok_interstitial`.

## Perubahan (4 file, tanpa logika baru)

### 1. src/api.ts — 1 baris

```diff
-    "access-control-allow-headers": "content-type",
+    "access-control-allow-headers": "content-type, x-telegram-init-data, skip_zrok_interstitial",
```

### 2. miniapp/src/config.ts — helper setelah baris API_URL

```ts
// Bypass interstitial zrok agar fetch API langsung dapat JSON (bukan halaman gate).
export const apiHeaders = (extra: Record<string, string> = {}) => ({
  "skip_zrok_interstitial": "1",
  ...extra,
});
```

### 3. miniapp/src/App.tsx — 2 titik

```diff
-import { API_URL, CHAIN, FAUCET, MUSDC, PRIVY_APP_ID, VAULT, WBNB } from "./config";
+import { API_URL, apiHeaders, CHAIN, FAUCET, MUSDC, PRIVY_APP_ID, VAULT, WBNB } from "./config";
```

```diff
     fetch(`${API_URL}/api/link-wallet`, {
       method: "POST",
-      headers: { "content-type": "application/json" },
+      headers: apiHeaders({ "content-type": "application/json" }),
       body: JSON.stringify({ initData, wallet: address }),
     })
```

### 4. miniapp/src/components/StrategyCard.tsx — 3 titik

```diff
-import { API_URL } from "../config";
+import { API_URL, apiHeaders } from "../config";
```

Dua fetch (ganti KEDUANYA, teksnya identik):

```diff
-        headers: { "x-telegram-init-data": initData },
+        headers: apiHeaders({ "x-telegram-init-data": initData }),
```

```diff
-        headers: { "x-telegram-init-data": initData },
+        headers: apiHeaders({ "x-telegram-init-data": initData }),
```

## Verifikasi wajib

```bash
bun test                        # backend 27/27
bunx tsc --noEmit               # root backend
bun run lint && bun run build   # miniapp (pakai workdir miniapp)
```

## Deploy + uji

1. Restart backend Bun (CORS baru aktif).
2. Rebuild + redeploy Vercel.
3. HP Telegram: connect → "Gagal sinkron" harus hilang saat tunnel hidup;
   strategi aktif terisi (bukan Failed to fetch).
4. Jika link-wallet MASIH Failed to fetch sesekali → itu sisa flap tunnel
   (jalur reserved-name + anti-flap, plan terpisah).
