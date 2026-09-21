import { db, saveUserWallet, getUserWallet, getActiveIntents, getRecentIntents, recordWalletTx, getWalletTxs, verifyPendingTxs, updateIntentStatus, cancelStaleIntents } from "./db";
import type { Database } from "bun:sqlite";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "viem/chains";
import { verifyTelegramInitData } from "./telegram-auth";

const getAllowedOrigin = () => process.env.MINIAPP_ORIGIN ?? "";
const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "dummy";
const apiUrl = (m: string) => `https://api.telegram.org/bot${token()}/${m}`;

const stamp = () => new Date().toISOString().slice(11, 19);
function log(...a: unknown[]) {
  console.log(`[api ${stamp()}]`, ...a);
}

async function sendTelegramMessage(chatId: string, text: string) {
  try {
    const r: any = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }).then((r) => r.json());
    if (!r.ok) log(`notify ${chatId} GAGAL:`, JSON.stringify(r).slice(0, 160));
  } catch (e) {
    log(`notify ${chatId} ERROR:`, e instanceof Error ? e.message : "?");
  }
}

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-headers": "content-type, x-telegram-init-data, skip_zrok_interstitial",
    "access-control-allow-methods": "POST, OPTIONS, GET",
    ...(origin && getAllowedOrigin() && origin === getAllowedOrigin() ? { "access-control-allow-origin": origin } : {}),
    "content-type": "application/json",
  };
}

function requireAuth(req: Request): string {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  if (!initData) throw new Error("missing initData");
  return verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN ?? "");
}

// cek receipt on-chain (best-effort): status final hanya dari chain, bukan klaim klien.
async function liveReceipt(hash: string): Promise<{ status: string; from: string } | null> {
  try {
    const client = createPublicClient({ chain: bscTestnet, transport: http(process.env.RPC_URL) });
    const r = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
    return { status: r.status, from: r.from };
  } catch {
    return null;
  }
}

// conn di-inject agar test tak menyentuh DB produksi (default = db file).
export function createApiHandler(conn: Database = db) {
  return async function handler(req: Request) {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/link-wallet" && req.method === "POST") {
      if (getAllowedOrigin() && origin !== getAllowedOrigin()) {
        log(`POST /api/link-wallet → 403 origin=${origin ?? "-"}`);
        return Response.json({ error: "origin forbidden" }, { status: 403 });
      }
      try {
        const body = await req.json() as { initData?: string; wallet?: string };
        const userId = verifyTelegramInitData(body.initData ?? "", process.env.TELEGRAM_BOT_TOKEN ?? "");
        saveUserWallet(userId, body.wallet ?? "", conn);
        const dropped = cancelStaleIntents(userId, body.wallet ?? "", conn);
        log(`POST /api/link-wallet → 200 user=${userId} wallet=${body.wallet ?? ""} staleCancelled=${dropped}`);
        sendTelegramMessage(userId, "✅ Wallet tersinkron dengan bot. Sekarang kamu bisa kirim strategi via chat.");
        return Response.json({ ok: true }, { headers: corsHeaders(origin) });
      } catch (error) {
        log(`POST /api/link-wallet → 400 err=${error instanceof Error ? error.message : "?"}`);
        return Response.json({ error: error instanceof Error ? error.message : "bad request" }, { status: 400, headers: corsHeaders(origin) });
      }
    }

    if (path === "/api/me" && req.method === "GET") {
      try {
        const userId = requireAuth(req);
        const wallet = getUserWallet(userId, conn);
        if (!wallet) {
          log(`GET /api/me → 404 user=${userId} (belum link)`);
          return Response.json({ error: "wallet not linked" }, { status: 404, headers: corsHeaders(origin) });
        }
        const intents = getActiveIntents(conn).filter((i: any) => i.user_id === userId);
        log(`GET /api/me → 200 user=${userId} intents=${intents.length}`);
        return Response.json({ wallet, intents }, { headers: corsHeaders(origin) });
      } catch (error) {
        log(`GET /api/me → 401 err=${error instanceof Error ? error.message : "?"}`);
        return Response.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401, headers: corsHeaders(origin) });
      }
    }

    if (path === "/api/history" && req.method === "GET") {
      try {
        const userId = requireAuth(req);
        const items = getRecentIntents(userId, Number(new URL(req.url).searchParams.get("limit") ?? 20), conn);
        log(`GET /api/history → 200 user=${userId} items=${items.length}`);
        return Response.json({ items }, { headers: corsHeaders(origin) });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401, headers: corsHeaders(origin) });
      }
    }

    if (path === "/api/txs" && req.method === "POST") {
      if (getAllowedOrigin() && origin !== getAllowedOrigin()) return Response.json({ error: "origin forbidden" }, { status: 403 });
      try {
        const body = await req.json() as { initData?: string; wallet?: string; kind?: string; amount?: string; token?: string; txHash?: string; status?: string };
        const userId = verifyTelegramInitData(body.initData ?? "", process.env.TELEGRAM_BOT_TOKEN ?? "");
        const id = recordWalletTx({ userId, userWallet: body.wallet ?? "", kind: body.kind ?? "", amount: body.amount ?? "0", token: body.token ?? "", txHash: body.txHash ?? "", status: body.status ?? "submitted" }, conn);
        log(`POST /api/txs → 200 user=${userId} kind=${body.kind} hash=${(body.txHash ?? "").slice(0, 10)}…`);
        verifyPendingTxs(conn, liveReceipt, 5).catch(() => {});
        return Response.json({ ok: true, id }, { headers: corsHeaders(origin) });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "bad request" }, { status: 400, headers: corsHeaders(origin) });
      }
    }

    if (path === "/api/txs" && req.method === "GET") {
      try {
        const userId = requireAuth(req);
        const url_q = new URL(req.url).searchParams;
        try {
          await verifyPendingTxs(conn, liveReceipt, 10);
        } catch { /* verifikasi gagal = lewati, data tetap dikembalikan */ }
        const items = getWalletTxs(userId, Number(url_q.get("limit") ?? 20), conn);
        return Response.json({ items }, { headers: corsHeaders(origin) });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401, headers: corsHeaders(origin) });
      }
    }

    if (path.startsWith("/api/intents/") && path.endsWith("/cancel") && req.method === "POST") {
      try {
        const userId = requireAuth(req);
        const intentId = Number(path.split("/")[3]);
        if (!Number.isInteger(intentId)) return Response.json({ error: "invalid id" }, { status: 400, headers: corsHeaders(origin) });
        const intents = getActiveIntents(conn) as any[];
        const intent = intents.find((i) => i.id === intentId && i.user_id === userId);
        if (!intent) {
          log(`POST /api/intents/${intentId}/cancel → 404 user=${userId}`);
          return Response.json({ error: "not found" }, { status: 404, headers: corsHeaders(origin) });
        }
        updateIntentStatus(intentId, "cancelled", conn);
        log(`POST /api/intents/${intentId}/cancel → 200 user=${userId}`);
        return Response.json({ ok: true }, { headers: corsHeaders(origin) });
      } catch (error) {
        log(`POST ${path} → 401 err=${error instanceof Error ? error.message : "?"}`);
        return Response.json({ error: error instanceof Error ? error.message : "unauthorized" }, { status: 401, headers: corsHeaders(origin) });
      }
    }

    if (path.startsWith("/api/")) log(`${req.method} ${path} → 404 origin=${origin ?? "-"}`);
    return Response.json({ error: "not found" }, { status: 404, headers: corsHeaders(origin) });
  };
}

export function startApi(port = Number(process.env.API_PORT ?? 8787)) {
  const handler = createApiHandler();
  return Bun.serve({
    port,
    fetch: handler,
  });
}
