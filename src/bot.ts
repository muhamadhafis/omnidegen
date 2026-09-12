import { Telegraf } from "telegraf";
import { parseUserIntent, type ParsedIntent } from "./ai";
import { saveIntent } from "./db";
import { triggerHedgeTransaction, validateHedgeRequest } from "./web3";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN ?? "dummy");

// pure + testable: routing 3 use-case
export function routeIntent(p: ParsedIntent): "monitor" | "execute_now" | "reject" {
  if (!p || !p.asset || !p.target) return "reject";
  return p.type === "stop_loss" || p.type === "take_profit" ? "monitor" : "execute_now";
}

const wallets = new Map<string, string>(); // ponytail: in-memory, pindah ke kolom users kalau multi-instance
export const setWallet = (uid: string, w: string) => void wallets.set(uid, w);
export const getWallet = (uid: string) => wallets.get(uid);

bot.start((ctx) => ctx.reply("Halo! Kirim alamat wallet 0x... kamu dulu, lalu strategi. Cth: 'Jual BNB ke USDC kalau < $450'."));

bot.on("text", async (ctx) => {
  const uid = ctx.from.id.toString();
  const text = ctx.message.text.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(text)) {
    setWallet(uid, text);
    return ctx.reply("✅ Wallet tersimpan. Silakan kirim strategi.");
  }
  const wallet = getWallet(uid);
  if (!wallet) return ctx.reply("Kirim alamat wallet 0x... dulu.");
  const parsed = await parseUserIntent(text);
  if (!parsed) return ctx.reply("❌ Tidak paham. Sebut token + harga. Cth: 'kumpulin receh jadi BNB'.");
  const route = routeIntent(parsed);
  if (route === "monitor") {
    saveIntent({ userId: uid, userWallet: wallet, intentType: parsed.type, asset: parsed.asset, target: parsed.target, price: parsed.price, amountPct: parsed.amountPct });
    return ctx.reply(`✅ ${parsed.type} aktif: ${parsed.asset}->${parsed.target} @ $${parsed.price}. Pantau 24/7.`);
  }
  if (route === "execute_now") {
    if (!validateHedgeRequest(wallet, parsed.target)) return ctx.reply("❌ Target/wallet tidak diizinkan (guardrail).");
    const tx = await triggerHedgeTransaction(wallet).catch(() => null);
    return ctx.reply(tx ? `✅ Batch ${parsed.type} dieksekusi.\nTx: ${tx}` : "❌ Eksekusi gagal.");
  }
  return ctx.reply("❌ Intent ditolak guardrail.");
});
