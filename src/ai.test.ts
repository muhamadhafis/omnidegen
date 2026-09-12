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
  test("parse ask tanpa syarat aset/harga", () => {
    expect(parseIntentJson(JSON.stringify({ type: "ask" }))).toEqual({ type: "ask", asset: "BNB", target: "BNB", price: 0, amountPct: 100 });
  });
  test("parseUserIntent dengan mock client", async () => {
    let got: any;
    const fake: any = { chat: { completions: { create: async (a: any) => (got = a, { choices: [{ message: { content: JSON.stringify({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 }) } }] }) } } };
    expect(await parseUserIntent("kumpulin receh", fake)).toEqual({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 });
    expect(got.temperature).toBe(0); // anti-lotre untuk uang beneran
  });
});
