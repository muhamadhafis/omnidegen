import { parseUserIntent, type ParsedIntent } from "./ai";
import { getActiveIntents, getLastIntent, saveIntent } from "./db";
import { getVaultBalances, triggerHedgeTransaction, validateHedgeRequest } from "./web3";
import { fetchPrice, setMockPrice } from "./loop";
import { formatEther } from "viem";

// pure + testable: routing 3 use-case
export function routeIntent(p: ParsedIntent): "monitor" | "execute_now" | "reject" {
  if (!p || !p.asset || !p.target) return "reject";
  return p.type === "stop_loss" || p.type === "take_profit" ? "monitor" : "execute_now";
}

const wallets = new Map<string, string>(); // ponytail: in-memory, pindah ke kolom users kalau multi-instance
export const setWallet = (uid: string, w: string) => void wallets.set(uid, w);
export const getWallet = (uid: string) => wallets.get(uid);

// admin demo terkontrol: /crash 440 | /price (hanya ADMIN_ID)
export function parseCrash(text: string): number | null {
  const m = text.trim().match(/^\/crash\s+(\d+(\.\d+)?)$/);
  const p = m ? Number(m[1]) : NaN;
  return p > 0 ? p : null;
}
export const isAdmin = (uid: string) => (process.env.ADMIN_ID ?? "") !== "" && uid === process.env.ADMIN_ID;

// pure + testable: format /info
export function statusLine(it: any): string {
  const base = `${it.intent_type} ${it.asset_to_monitor}->${it.action_asset} @ $${it.trigger_price}`;
  if (it.status === "executed") return `✅ ${base} — dieksekusi`;
  if (it.status === "failed") return `❌ ${base} — gagal`;
  return `• ${base}`;
}
export function formatInfo(wallet: string, bnb: bigint, stable: bigint, intents: any[], last?: any): string {
  const rows = intents.map((i) => `• ${i.intent_type} ${i.asset_to_monitor}->${i.action_asset} @ $${i.trigger_price}`).join("\n") || "(belum ada strategi aktif)";
  const tail = last && last.status !== "active" ? `\n🕓 Terakhir: ${statusLine(last)}` : "";
  return `👛 ${wallet}\n💰 Vault: ${formatEther(bnb)} BNB | ${formatEther(stable)} mUSDC\n📋 Strategi aktif:\n${rows}${tail}`;
}

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "dummy";
const api = (m: string) => `https://api.telegram.org/bot${token()}/${m}`;

async function sendMessage(chat_id: string | number, text: string) {
  const r = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text }),
  }).then((r) => r.json());
  if (!r.ok) console.error("sendMessage fail:", JSON.stringify(r).slice(0, 200));
  else console.log(`[reply -> ${chat_id}] ${text.slice(0, 80)}`);
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
        console.log(`[inbox ${uid}] ${(msg.text ?? "").slice(0, 80)}`);
        const reply = (t: string) => sendMessage(uid, t);
        const ctx: Ctx = { from: { id: msg.from.id }, message: { text: msg.text }, reply };
        if (msg.text.startsWith("/start")) await startHandler(ctx);
        else if (msg.text === "/info") {
          const w = getWallet(uid);
          if (!w) {
            await reply("Kirim alamat wallet 0x... dulu.");
            continue;
          }
          try {
            const b = await getVaultBalances(w);
            const mine = (getActiveIntents() as any[]).filter((i) => i.user_id === uid);
            await reply(formatInfo(w, b.bnb, b.stable, mine, getLastIntent(uid)));
          } catch {
            await reply("❌ Gagal baca vault, coba lagi.");
          }
        } else if (msg.text.startsWith("/crash") || msg.text === "/price") {
          if (!isAdmin(uid)) {
            await reply("⛔ Khusus admin demo.");
            continue;
          }
          if (msg.text === "/price") {
            await reply(`BNB sekarang $${await fetchPrice()}`);
            continue;
          }
          const p = parseCrash(msg.text);
          if (p === null) {
            await reply("Format: /crash 440");
            continue;
          }
          setMockPrice(p);
          await reply(`📉 Harga diset $${p}. Pantau rescue...`);
        } else await handleText(uid, msg.text, reply);
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
