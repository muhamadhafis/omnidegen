import { parseUserIntent, type ParsedIntent } from "./ai";
import { getActiveIntents, getLastIntent, getUserWallet, saveIntent, saveUserWallet } from "./db";
import { WBNB, getVaultBalances, triggerHedgeTransaction, validateHedgeRequest } from "./web3";
import { fetchPrice, setMockPrice, failHint, isRealTxHash } from "./loop";
import { formatEther } from "viem";

// pure + testable: routing 4 use-case (ask = tanya saldo, jawab tanpa eksekusi)
export function routeIntent(p: ParsedIntent): "monitor" | "execute_now" | "info" | "reject" {
  if (!p || !p.asset || !p.target) return "reject";
  if (p.type === "ask") return "info";
  return p.type === "stop_loss" || p.type === "take_profit" ? "monitor" : "execute_now";
}

export const setWallet = (uid: string, w: string) => saveUserWallet(uid, w);
export const getWallet = (uid: string) => getUserWallet(uid);

// konfirmasi eksekusi instan: uang beneran bergerak, wajib YA eksplisit
const pending = new Map<string, ParsedIntent>();
export const getPending = (uid: string) => pending.get(uid);
export const setPending = (uid: string, p: ParsedIntent) => void pending.set(uid, p);
export const clearPending = (uid: string) => void pending.delete(uid);

// admin demo terkontrol: /crash 440 | /price (hanya ADMIN_ID)
export function parseCrash(text: string): number | null {
  const m = text.trim().match(/^\/crash\s+(\d+(\.\d+)?)$/);
  const p = m ? Number(m[1]) : NaN;
  return p > 0 ? p : null;
}
export const isAdmin = (uid: string) => (process.env.ADMIN_ID ?? "") !== "" && uid === process.env.ADMIN_ID;

export function statusLine(it: any): string {
  const base = `${it.intent_type} ${it.asset_to_monitor}->${it.action_asset} @ $${it.trigger_price}`;
  if (it.status === "executed") return `✅ ${base} — dieksekusi`;
  if (it.status === "failed") return `❌ ${base} — gagal`;
  return `• ${base}`;
}

export function formatInfo(wallet: string, b: { walletBnb: bigint; wbnb: bigint; allowance: bigint; stable: bigint }, intents: any[], last?: any): string {
  const rows = intents.map((i) => `• ${i.intent_type} ${i.asset_to_monitor}->${i.action_asset} @ $${i.trigger_price}`).join("\n") || "(belum ada strategi aktif)";
  const tail = last && last.status !== "active" ? `\n🕓 Terakhir: ${statusLine(last)}` : "";
  return `👛 ${wallet}\n💰 Wallet: ${formatEther(b.walletBnb)} BNB | ${formatEther(b.wbnb)} WBNB | ${formatEther(b.stable)} mUSDC\n🛡️ Izin ke vault: ${formatEther(b.allowance)} WBNB\n📋 Strategi aktif:\n${rows}${tail}`;
}

export function approveText(): string {
  const v = process.env.VAULT_CONTRACT_ADDRESS ?? "?";
  return `🛡️ Izinkan vault menarik WBNB saat rescue (bisa dicabut kapan saja):\n1. Wrap: kontrak WBNB ${WBNB} → deposit() isi BNB\n2. Approve: kontrak WBNB → approve(${v}, jumlah)\nCek izin aktif via Mini App.`;
}

export function miniAppRedirect(): string {
  return "Buka Mini App untuk melihat saldo, allowance, strategi, dan transaksi wallet kamu.";
}

const token = () => process.env.TELEGRAM_BOT_TOKEN ?? "dummy";
const api = (m: string) => `https://api.telegram.org/bot${token()}/${m}`;

async function sendMessage(chat_id: string | number, text: string, markup?: unknown) {
  const r = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text, ...(markup ? { reply_markup: markup } : {}) }),
  }).then((r) => r.json());
  if (!r.ok) console.error("sendMessage fail:", JSON.stringify(r).slice(0, 200));
  else console.log(`[reply -> ${chat_id}] ${text.slice(0, 80)}`);
  return r;
}

export function webAppKeyboard(): unknown {
  const url = process.env.MINIAPP_URL ?? "";
  if (!url) return undefined;
  return { inline_keyboard: [[{ text: "📱 Buka Dompet", web_app: { url } }]] };
}

type Reply = (t: string, markup?: unknown) => Promise<unknown>;
type Ctx = { from: { id: number }; message: { text: string }; reply: Reply };
let startHandler: (ctx: Ctx) => unknown = (ctx) =>
  ctx.reply("Halo! Hubungkan dompet via Mini App, lalu kirim strategi. Cth: 'Kalau BNB di atas 500 maka TP'.", webAppKeyboard());

async function handleText(uid: string, text: string, reply: Reply) {
  const t = text.trim();
  const up = t.toUpperCase();
  if (up === "YA" || up === "BATAL") {
    const p = getPending(uid);
    clearPending(uid);
    if (up === "BATAL" || !p) return reply("Dibatalkan.");
    return runInstant(uid, p, reply);
  }
  clearPending(uid);
  const parsed = await parseUserIntent(t);
  if (!parsed) return reply("❌ Tidak paham. Sebut token + harga. Cth: 'kumpulin receh jadi BNB'.");
  const wallet = getWallet(uid);
  if (!wallet) return reply("Hubungkan wallet dulu via Mini App.", webAppKeyboard());
  const route = routeIntent(parsed);
  if (route === "info") return answerInfo(uid, wallet, reply);
  if (route === "monitor") {
    if (parsed.target !== "USDC") return reply("❌ Vault testnet hanya swap ke USDC (mUSDC). Buat ulang strategi dengan target USDC.");
    saveIntent({ userId: uid, userWallet: wallet, intentType: parsed.type, asset: parsed.asset, target: parsed.target, price: parsed.price, amountPct: parsed.amountPct });
    return reply(`✅ ${parsed.type} aktif: ${parsed.asset}->${parsed.target} @ $${parsed.price} (dompet ${wallet.slice(0, 6)}…${wallet.slice(-4)}). Pantau 24/7.`);
  }
  if (route === "execute_now") {
    if (!validateHedgeRequest(wallet, parsed.target)) return reply("❌ Target/wallet tidak diizinkan (guardrail).");
    setPending(uid, parsed);
    return reply(`⚠️ Konfirmasi: eksekusi ${parsed.type} sekarang? (hedge seluruh saldo BNB vault via Pancake)\nBalas YA untuk lanjut, BATAL untuk batal.`);
  }
  return reply("❌ Intent ditolak guardrail.");
}

async function runInstant(uid: string, parsed: ParsedIntent, reply: Reply) {
  const wallet = getWallet(uid);
  if (!wallet) return reply("Wallet tidak ditemukan. Hubungkan via Mini App.", webAppKeyboard());
  try {
    const tx = await triggerHedgeTransaction(wallet);
    if (!tx) return reply("❌ Eksekusi gagal.");
    const link = isRealTxHash(tx) ? `\nCek: https://testnet.bscscan.com/tx/${tx}` : "";
    return reply(`🚨 Batch ${parsed.type} dieksekusi.\nTx: ${tx}${link}`);
  } catch (e) {
    return reply(`❌ Eksekusi gagal: ${failHint(e instanceof Error ? e.message : "")}`);
  }
}

async function answerInfo(uid: string, wallet: string, reply: Reply) {
  try {
    const b = await getVaultBalances(wallet);
    const mine = (getActiveIntents() as any[]).filter((i) => i.user_id === uid);
    return reply(formatInfo(wallet, b, mine, getLastIntent(uid)));
  } catch {
    return reply("❌ Gagal baca vault, coba lagi.");
  }
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
        const reply = (t: string, markup?: unknown) => sendMessage(uid, t, markup);
        const ctx: Ctx = { from: { id: msg.from.id }, message: { text: msg.text }, reply };
        if (msg.text.startsWith("/start")) {
          await sendMessage(uid, "Halo! Hubungkan dompet via Mini App, lalu kirim strategi. Cth: 'Kalau BNB di atas 500 maka TP'.", webAppKeyboard());
        } else if (msg.text === "/app") {
          const kb = webAppKeyboard();
          await sendMessage(uid, kb ? "Buka dompet OmniDegen:" : "Mini App belum diset (MINIAPP_URL kosong).", kb);
        } else if (msg.text === "/info") {
          await reply(miniAppRedirect(), webAppKeyboard());
        } else if (msg.text === "/approve") {
          await reply(miniAppRedirect(), webAppKeyboard());
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
