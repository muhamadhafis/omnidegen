import Groq from "groq-sdk";
import { INTENT_TYPES, type IntentType } from "./db";

export type ParsedIntent = {
  type: IntentType;
  asset: string;
  target: string;
  price: number;
  amountPct: number;
};

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "dummy" });

const SYSTEM = `Ekstrak perintah user jadi JSON murni tanpa markdown.
Schema: {"type":"stop_loss"|"take_profit"|"vacuum"|"defi_batch"|"ask","asset":"BNB"|"USDC"|"USDT"|"DUST","target":"BNB"|"USDC","price":number,"amountPct":1-100}.
stop_loss/take_profit target SELALU USDC (vault testnet hanya swap ke mUSDC; user sebut USDT/BUSD/DAI anggap USDC).
turun/anjlok/jatuh->stop_loss, naik/profit->take_profit, receh/kumpulkan/claim->vacuum, TANYA saldo/aset/portofolio/info (berapa, cek, lihat, tampilkan saldo)->ask, sisanya multi-step->defi_batch. Kata kerja aksi mengalahkan kata arah: beli/borong TIDAK PERNAH jadi stop_loss, vacuum, atau defi_batch. Default amountPct 100, price 0 jika tak ada.`;

// pure + testable: normalisasi + validasi hasil LLM
export function parseIntentJson(raw: string): ParsedIntent | null {
  try {
    const j = JSON.parse(raw);
    if (!INTENT_TYPES.includes(j.type)) return null;
    if (j.type === "ask") return { type: "ask", asset: "BNB", target: "BNB", price: 0, amountPct: 100 };
    const asset = String(j.asset ?? "").toUpperCase();
    const target0 = String(j.target ?? "").toUpperCase();
    // vault hanya swap ke mUSDC: stable apa pun untuk hedge dinormalisasi ke USDC
    const target = (j.type === "stop_loss" || j.type === "take_profit") && ["USDC", "USDT", "BUSD", "DAI"].includes(target0) ? "USDC" : target0;
    if (!asset || !target) return null;
    const price = Number(j.price ?? 0);
    const amountPct = Number(j.amountPct ?? 100);
    if ((j.type === "stop_loss" || j.type === "take_profit") && !(price > 0)) return null;
    if (!(amountPct >= 1 && amountPct <= 100)) return null;
    return { type: j.type, asset, target, price, amountPct };
  } catch {
    return null;
  }
}

export async function parseUserIntent(text: string, client = groq): Promise<ParsedIntent | null> {
  try {
    const r = await client.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      model: GROQ_MODEL,
      temperature: 0, // deterministik: kalimat sama -> JSON sama (uang bergerak, tak boleh lotre)
      response_format: { type: "json_object" },
    } as any);
    return parseIntentJson(r.choices[0]?.message?.content ?? "");
  } catch (e) {
    console.error("Groq error:", e);
    return null;
  }
}
