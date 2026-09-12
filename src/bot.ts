import { parseUserIntent, type ParsedIntent } from "./ai";
import { saveIntent } from "./db";
import { triggerHedgeTransaction, validateHedgeRequest } from "./web3";

// pure + testable: routing 3 use-case
export function routeIntent(p: ParsedIntent): "monitor" | "execute_now" | "reject" {
  if (!p || !p.asset || !p.target) return "reject";
  return p.type === "stop_loss" || p.type === "take_profit" ? "monitor" : "execute_now";
}

const wallets = new Map<string, string>(); // ponytail: in-memory, pindah ke kolom users kalau multi-instance
export const setWallet = (uid: string, w: string) => void wallets.set(uid, w);
export const getWallet = (uid: string) => wallets.get(uid);

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "dummy";
const api = (m: string) => `https://api.telegram.org/bot${token()}/${m}`;

async function sendMessage(chat_id: string | number, text: string) {
  const r = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text }),
  }).then((r) => r.json());
  if (!r.ok) console.error("sendMessage fail:", JSON.stringify(r).slice(0, 200));
  return r;
}

type Ctx = { from: { id: number }; message: { text: string }; reply: (t: string) => Promise<unknown> };
let startHandler: (ctx: Ctx) => unknown = (ctx) =>
  ctx.reply("Halo! Kirim alamat wallet 0x... kamu dulu, lalu strategi. Cth: 'Jual BNB ke USDC kalau < $450'.");

async function handleText(uid: string, text: string, reply: (t: string) => Promise<unknown>) {
  const t = text.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) {
    setWallet(uid, t);
    return reply("✅ Wallet tersimpan. Silakan kirim strategi.");
  }
  const wallet = getWallet(uid);
  if (!wallet) return reply("Kirim alamat wallet 0x... dulu.");
  const parsed = await parseUserIntent(t);
  if (!parsed) return reply("❌ Tidak paham. Sebut token + harga. Cth: 'kumpulin receh jadi BNB'.");
  const route = routeIntent(parsed);
  if (route === "monitor") {
    saveIntent({ userId: uid, userWallet: wallet, intentType: parsed.type, asset: parsed.asset, target: parsed.target, price: parsed.price, amountPct: parsed.amountPct });
    return reply(`✅ ${parsed.type} aktif: ${parsed.asset}->${parsed.target} @ $${parsed.price}. Pantau 24/7.`);
  }
  if (route === "execute_now") {
    if (!validateHedgeRequest(wallet, parsed.target)) return reply("❌ Target/wallet tidak diizinkan (guardrail).");
    const tx = await triggerHedgeTransaction(wallet).catch(() => null);
    return reply(tx ? `✅ Batch ${parsed.type} dieksekusi.\nTx: ${tx}` : "❌ Eksekusi gagal.");
  }
  return reply("❌ Intent ditolak guardrail.");
}

let running = false;
let offset = 0;

async function poll() {
  while (running) {
    try {
      const r: any = await fetch(api(`getUpdates?timeout=25&offset=${offset}`)).then((r) => r.json());
      for (const u of r.result ?? []) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (!msg?.text) continue;
        const uid = String(msg.from.id);
        const reply = (t: string) => sendMessage(uid, t);
        const ctx: Ctx = { from: { id: msg.from.id }, message: { text: msg.text }, reply };
        if (msg.text.startsWith("/start")) await startHandler(ctx);
        else await handleText(uid, msg.text, reply);
      }
    } catch (e) {
      console.error("poll error:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// interface kompatibel dgn pemakaian lama (loop.ts pakai bot.telegram.sendMessage)
export const bot = {
  telegram: { sendMessage: (chatId: string | number, text: string) => sendMessage(chatId, text) },
  start: (fn: (ctx: Ctx) => unknown) => void (startHandler = fn),
  on: (_ev: "text", _fn: (ctx: Ctx) => unknown) => {}, // logic sudah di handleText
  launch: async () => void ((running = true), poll()),
  stop: () => void (running = false),
};
