import { claimIntent, getActiveIntents, updateIntentStatus } from "./db";
import { triggerHedgeTransaction } from "./web3";
import { bot } from "./bot";

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

export async function tickOnce(price = mockPrice) {
  const done: number[] = [];
  for (const it of getActiveIntents() as any[]) {
    if (it.asset_to_monitor?.toUpperCase() !== "BNB") continue;
    if (!shouldTrigger(it, price)) continue;
    if (!claimIntent(it.id)) continue; // kalah race -> skip
    try {
      const tx = await triggerHedgeTransaction(it.user_wallet);
      if (tx) {
        updateIntentStatus(it.id, "executed");
        done.push(it.id);
        try {
          await bot.telegram.sendMessage(it.user_id, `🚨 Penyelamatan: ${it.asset_to_monitor}->${it.action_asset} @ $${price}\nTx: ${tx}`);
        } catch {}
      } else updateIntentStatus(it.id, "active");
    } catch {
      updateIntentStatus(it.id, "failed");
    }
  }
  return done;
}

export function startPriceMonitor(ms = 5000) {
  console.log("🕵️ monitor aktif...");
  return setInterval(async () => tickOnce(await fetchPrice()), ms);
}
