import Groq from "groq-sdk";
import { INTENT_TYPES, type IntentType } from "./db";

export type ParsedIntent = {
  type: IntentType;
  asset: string;
  target: string;
  price: number;
  amountPct: number;
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY ?? "dummy" });

const SYSTEM = `Ekstrak perintah user jadi JSON murni tanpa markdown.
Schema: {"type":"stop_loss"|"take_profit"|"vacuum"|"defi_batch","asset":"BNB"|"USDC"|"USDT"|"DUST","target":"BNB"|"USDC"|"USDT","price":number,"amountPct":1-100}.
turun/anjlok/jatuh->stop_loss, naik/profit->take_profit, receh/kumpulkan/claim->vacuum, sisanya multi-step->defi_batch. Default amountPct 100, price 0 jika tak ada.`;

// pure + testable: normalisasi + validasi hasil LLM
export function parseIntentJson(raw: string): ParsedIntent | null {
  try {
    const j = JSON.parse(raw);
    if (!INTENT_TYPES.includes(j.type)) return null;
    const asset = String(j.asset ?? "").toUpperCase();
    const target = String(j.target ?? "").toUpperCase();
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
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    } as any);
    return parseIntentJson(r.choices[0]?.message?.content ?? "");
  } catch (e) {
    console.error("Groq error:", e);
    return null;
  }
}
