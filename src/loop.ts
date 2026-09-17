import { claimIntent, db, getActiveIntents, updateIntentProof, updateIntentStatus } from "./db";
import { triggerHedgeTransaction } from "./web3";
import { bot } from "./bot";
import type { Database } from "bun:sqlite";

let mockPrice = 500;
export const setMockPrice = (p: number) => (mockPrice = p);
export const getMockPrice = () => mockPrice;

// pure + testable: alasan gagal jadi bahasa manusia
export function failHint(reason: string): string {
  if (reason.includes("no approve")) return "belum approve vault — buka Mini App untuk approve";
  if (reason.includes("no balance")) return "saldo WBNB kurang — wrap dulu, cek /info";
  if (reason.includes("no deposit")) return "tidak ada BNB di vault — deposit dulu, cek /info";
  if (reason.includes("no receipt")) return "Tx terkirim tapi tak terkonfirmasi (kemungkinan dropped) — cek hash di bscscan, buat intent baru bila perlu";
  if (reason.includes("revert")) return "Tx ditolak chain (revert) — cek allowance/saldo, lalu buat intent baru";
  if (reason.includes("propagating") || reason.includes("origin tak menyimpan")) return "Tx tak terlihat jaringan (RPC origin bermasalah?) — cek RPC_URL, buat intent baru dan coba lagi";
  return reason.slice(0, 120);
}
// pure + testable: hanya hash 64-hex yang boleh di-link ke explorer.
// Mock (0xmock…) dan string lain bukan bukti chain.
export function isRealTxHash(tx: unknown): tx is `0x${string}` {
  return typeof tx === "string" && /^0x[0-9a-fA-F]{64}$/.test(tx);
}
export function shouldTrigger(intent: any, price: number): boolean {
  if (intent.intent_type === "stop_loss") return price <= Number(intent.trigger_price);
  if (intent.intent_type === "take_profit") return price >= Number(intent.trigger_price);
  return false; // vacuum/defi_batch = instant, tak lewat loop
}

export async function fetchPrice(): Promise<number> {
  if (process.env.MOCK_MODE !== "false") return mockPrice;
  const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
  const j = await r.json();
  return Number(j.binancecoin.usd);
}

export async function tickOnce(
  price = mockPrice,
  deps: { conn?: Database; exec?: (w: string) => Promise<unknown>; notify?: (uid: string, msg: string) => Promise<unknown> } = {},
) {
  const conn = deps.conn ?? db;
  const exec = deps.exec ?? triggerHedgeTransaction;
  const notify = deps.notify ?? ((uid, msg) => bot.telegram.sendMessage(uid, msg));
  const done: number[] = [];
  for (const it of getActiveIntents(conn) as any[]) {
    if (it.asset_to_monitor?.toUpperCase() !== "BNB") continue;
    if (!shouldTrigger(it, price)) continue;
    if (!claimIntent(it.id, conn)) continue; // kalah race -> skip
    try {
      const tx = await exec(it.user_wallet);
      if (tx) {
        updateIntentStatus(it.id, "executed", conn);
        done.push(it.id);
        const tag = String(tx).startsWith("0xmock") ? "[SIMULASI] " : "";
        const link = isRealTxHash(tx) ? `\nCek: https://testnet.bscscan.com/tx/${tx}` : "";
        if (isRealTxHash(tx)) updateIntentProof(it.id, tx, conn);
        console.log(`[hedge] ${tag}user=${it.user_id} ${it.asset_to_monitor}->${it.action_asset} @ $${price} tx=${tx}`);
        try {
          await notify(it.user_id, `🚨 ${tag}Penyelamatan: ${it.asset_to_monitor}->${it.action_asset} @ $${price}\nTx: ${tx}${link}`);
        } catch {}
      } else updateIntentStatus(it.id, "active", conn);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "unknown";
      updateIntentStatus(it.id, "failed", conn);
      console.log(`[hedge-gagal] user=${it.user_id} ${it.intent_type} sebab=${reason}`);
      try {
        await notify(it.user_id, `❌ ${it.intent_type} ${it.asset_to_monitor}->${it.action_asset} gagal: ${failHint(reason)}`);
      } catch {}
    }
  }
  return done;
}

export function startPriceMonitor(ms = 5000) {
  console.log("🕵️ monitor aktif...");
  return setInterval(async () => tickOnce(await fetchPrice()), ms);
}
