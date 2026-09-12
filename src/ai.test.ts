import { describe, test, expect } from "bun:test";
import { parseIntentJson, parseUserIntent } from "./ai";

describe("ai", () => {
  test("parse stop_loss valid", () => {
    expect(parseIntentJson(JSON.stringify({ type: "stop_loss", asset: "bnb", target: "usdc", price: 450, amountPct: 100 }))).toEqual({ type: "stop_loss", asset: "BNB", target: "USDC", price: 450, amountPct: 100 });
  });
  test("reject harga 0 untuk trigger + pct over", () => {
    expect(parseIntentJson(JSON.stringify({ type: "stop_loss", asset: "BNB", target: "USDC", price: 0 }))).toBeNull();
    expect(parseIntentJson(JSON.stringify({ type: "vacuum", asset: "DUST", target: "BNB", amountPct: 999 }))).toBeNull();
    expect(parseIntentJson("bukan json")).toBeNull();
  });
  test("parseUserIntent dengan mock client", async () => {
    const fake: any = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 }) } }] }) } } };
    expect(await parseUserIntent("kumpulin receh", fake)).toEqual({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 });
  });
});
