# FULL: riwayat strategi + matikan timer SIMULASI (disetujui: keduanya, one-shot tetap)

Status: SIAP EKSEKUSI, tertunda permission `edit`.
Konteks: strategi "hilang" setelah logout sebenarnya terkonsumsi trigger
(executed/failed/cancelled) — daftar aktif saja yang tampil. Solusi: tampilkan
riwayat + bunuh timer demo yang bisa menembak intent user.

## Edit 1 — src/index.ts (matikan timer SIMULASI crash)

```diff
 import { bot } from "./bot";
-import { startPriceMonitor, setMockPrice } from "./loop";
+import { startPriceMonitor } from "./loop";
 import { startApi } from "./api";
```

```diff
 } else console.log("skip api (API_ENABLED=false)");
-
-// demo crash terkontrol untuk juri
-setTimeout(() => {
-  console.log("\n📉 SIMULASI crash!");
-  setMockPrice(440);
-}, 30_000);
```

(`/crash` manual tetap ada untuk testing; yang dihapus hanya tembakan otomatis.)

## Edit 2 — src/db.ts (riwayat, taruh setelah `getLastIntent`)

```ts
// riwayat: N intent terakhir user (termasuk executed/failed/cancelled).
export function getRecentIntents(userId: string, limit = 20, conn: Database = db) {
  const n = Math.floor(Number(limit));
  const lim = !(n >= 1) ? 20 : Math.min(n, 100);
  return conn.query(`SELECT * FROM intents WHERE user_id=$uid ORDER BY id DESC LIMIT ${lim}`).all({ $uid: userId }) as any[];
}
```

(LIMIT di-interpolasi dari integer yang sudah di-clamp — aman dari injeksi.)

## Edit 3 — src/api.ts (route + import)

```diff
-import { db, saveUserWallet, getUserWallet, getActiveIntents, updateIntentStatus, cancelStaleIntents } from "./db";
+import { db, saveUserWallet, getUserWallet, getActiveIntents, getRecentIntents, updateIntentStatus, cancelStaleIntents } from "./db";
```

Tambah setelah blok `/api/me` (sebelum blok `/api/intents/`):

```ts
    if (path === "/api/history" && req.method === "GET") {
      try {
        const userId = requireAuth(req);
        const items = getRecentIntents(userId, 20, conn);
        log(`GET /api/history → 200 user=${userId} items=${items.length}`);
        return Response.json({ items }, { headers: corsHeaders(origin) });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401, headers: corsHeaders(origin) });
      }
    }
```

## Edit 4 — test backend

4a. `src/api.test.ts`: import tambah `saveIntent`:
`import { createDb, getUserWallet, saveIntent } from "./db";`
Test baru di dalam describe (pakai `conn` + `signed()` yang sudah ada):

```ts
  test("history mengembalikan intent user + tolak tanpa auth", async () => {
    const handler = createApiHandler(conn);
    saveIntent({ userId: "6577260927", userWallet: WALLET, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, conn);
    const res = await handler(new Request("https://api.test/api/history", { headers: { origin: "https://miniapp.example", "x-telegram-init-data": signed() } }));
    expect(res.status).toBe(200);
    const j: any = await res.json();
    expect(j.items.length).toBe(1);
    expect(j.items[0].intent_type).toBe("stop_loss");
    const unauth = await handler(new Request("https://api.test/api/history", { headers: { origin: "https://miniapp.example" } }));
    expect(unauth.status).toBe(401);
  });
```

4b. `src/db.test.ts`: import tambah `getRecentIntents`. Test baru:

```ts
  test("riwayat urut terbaru + batas limit + per-user", () => {
    const c = createDb();
    saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    saveIntent({ userId: "1", userWallet: W, intentType: "take_profit", asset: "BNB", target: "USDC", price: 500 }, c);
    saveIntent({ userId: "2", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    const all = getRecentIntents("1", 20, c) as any[];
    expect(all.length).toBe(2);
    expect(all[0].trigger_price).toBe(500); // terbaru dulu
    expect(getRecentIntents("1", 1, c).length).toBe(1);
    expect(getRecentIntents("9", 20, c).length).toBe(0);
  });
```

## Edit 5 — miniapp/src/components/StrategyCard.tsx (seksi Riwayat)

5a. State tambah: `const [history, setHistory] = useState<Strategy[]>([]);`
5b. Di `fetchStrategies`, setelah `setStrategies(...)` tambah:

```ts
      const resH = await fetch(`${API_URL}/api/history`, {
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (resH.ok) {
        const dh = await resH.json();
        setHistory((dh.items ?? []).filter((s: Strategy) => s.status !== "active"));
      }
```

Juga reset saat guard awal: tambah `setHistory([]);` di samping `setStrategies([]);`
5c. Render, setelah `</ul>` blok aktif (sebelum `</Surface>`):

```tsx
      {!loading && !error && history.length > 0 && (
        <>
          <div className="flow-label">Riwayat</div>
          <ul className="strategy-list">
            {history.map((s) => (
              <li key={s.id} className="strategy-item">
                <div className="strategy-info">
                  <span className="strategy-type">{s.intent_type}</span>
                  <span className="strategy-detail">
                    {s.asset_to_monitor} → {s.action_asset} @ ${s.trigger_price}
                  </span>
                  <span className="strategy-detail">Dompet {shortAddr(s.user_wallet)}</span>
                  {s.tx_hash && /^0x[0-9a-fA-F]{64}$/.test(s.tx_hash) && (
                    <a className="tx" href={SCAN_TX(s.tx_hash)} target="_blank" rel="noreferrer">
                      Lihat Tx ↗
                    </a>
                  )}
                  <span className={`strategy-status ${s.status}`}>{s.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
```

## Edit 6 — miniapp/src/index.css (warna status riwayat)

Tambah setelah rule `.strategy-status.cancelled`:

```css
.strategy-status.executed {
  background: rgba(61, 220, 132, 0.15);
  color: var(--green);
}

.strategy-status.failed {
  background: rgba(246, 70, 93, 0.15);
  color: var(--red);
}
```

## Verifikasi

```bash
bun test                       # backend
bunx tsc --noEmit -p tsconfig.json
# workdir miniapp:
bunx tsc --noEmit && bun run lint && bun run build
```

## Setelah deploy + restart

- Daftar aktif hanya berisi yang benar-benar menunggu trigger.
- Riwayat menampilkan executed (dengan link Tx, mis. SL@400 → 0x9b43…),
  failed, cancelled — tak ada lagi kesan "hilang".
- Timer SIMULASI mati: restart backend tak lagi menggeser harga sendiri.
- Catatan tertunda (di luar scope ini): reclaim baris `claimed` yang macet
  bila backend di-Ctrl+C saat receipt-wait; klaim tidak ada baris claimed
  aktif di DB saat plan ditulis.
