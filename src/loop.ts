import { claimIntent, db, getActiveIntents, updateIntentStatus } from "./db";
import { triggerHedgeTransaction } from "./web3";
import { bot } from "./bot";
import type { Database } from "bun:sqlite";

let mockPrice = 500;
export const setMockPrice = (p: number) => (mockPrice = p);
export const getMockPrice = () => mockPrice;

// pure + testable: 1 fungsi untuk semua trigger
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
        console.log(`[hedge] ${tag}user=${it.user_id} ${it.asset_to_monitor}->${it.action_asset} @ $${price} tx=${tx}`);
        try {
          await notify(it.user_id, `🚨 ${tag}Penyelamatan: ${it.asset_to_monitor}->${it.action_asset} @ $${price}\nTx: ${tx}`);
        } catch {}
      } else updateIntentStatus(it.id, "active", conn);
    } catch {
      updateIntentStatus(it.id, "failed", conn);
    }
  }
  return done;
}

export function startPriceMonitor(ms = 5000) {
  console.log("🕵️ monitor aktif...");
  return setInterval(async () => tickOnce(await fetchPrice()), ms);
}
