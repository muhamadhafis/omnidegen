import { describe, test, expect } from "bun:test";
import { shouldTrigger } from "./loop";
import { validateHedgeRequest } from "./web3";
import { routeIntent, setWallet, getWallet } from "./bot";

const W = "0x1234567890123456789012345678901234567890";

describe("engine", () => {
  test("shouldTrigger stop/take", () => {
    expect(shouldTrigger({ intent_type: "stop_loss", trigger_price: 450 }, 440)).toBe(true);
    expect(shouldTrigger({ intent_type: "stop_loss", trigger_price: 450 }, 460)).toBe(false);
    expect(shouldTrigger({ intent_type: "take_profit", trigger_price: 600 }, 610)).toBe(true);
    expect(shouldTrigger({ intent_type: "vacuum" }, 1)).toBe(false);
  });
  test("guardrail web3", () => {
    expect(validateHedgeRequest(W, "USDC")).toBe(true);
    expect(validateHedgeRequest("bad", "USDC")).toBe(false);
    expect(validateHedgeRequest(W, "HACK")).toBe(false);
  });
  test("routing 3 use-case", () => {
    expect(routeIntent({ type: "stop_loss", asset: "BNB", target: "USDC", price: 450, amountPct: 100 })).toBe("monitor");
    expect(routeIntent({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 })).toBe("execute_now");
    expect(routeIntent({ type: "defi_batch", asset: "USDT", target: "BNB", price: 0, amountPct: 50 })).toBe("execute_now");
    setWallet("u1", W);
    expect(getWallet("u1")).toBe(W);
  });
});
