import { describe, test, expect } from "bun:test";
import { shouldTrigger, tickOnce } from "./loop";
import { validateHedgeRequest } from "./web3";
import { routeIntent, setWallet, getWallet, parseCrash, isAdmin, formatInfo } from "./bot";
import { createDb, saveIntent, getActiveIntents } from "./db";

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
  test("admin crash command", () => {
    expect(parseCrash("/crash 440")).toBe(440);
    expect(parseCrash("/crash abc")).toBeNull();
    expect(parseCrash("/crash -5")).toBeNull();
    process.env.ADMIN_ID = "1";
    expect(isAdmin("1")).toBe(true);
    expect(isAdmin("2")).toBe(false);
    delete process.env.ADMIN_ID;
    expect(isAdmin("1")).toBe(false);
  });
  test("format /info", () => {
    const s = formatInfo(W, 2000000000000000n, 396434372331416720n, [
      { intent_type: "stop_loss", asset_to_monitor: "BNB", action_asset: "USDC", trigger_price: 450 },
    ]);
    expect(s).toContain(W);
    expect(s).toContain("0.002");
    expect(s).toContain("stop_loss");
    expect(formatInfo(W, 0n, 0n, [])).toContain("belum ada");
  });
  test("tickOnce end-to-end: crash mengeksekusi + notif", async () => {
    const conn = createDb();
    const id = saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    const sent: string[] = [];
    const done = await tickOnce(440, { conn, exec: async () => "0xtest", notify: async (uid, m) => void sent.push(uid + m) });
    expect(done).toEqual([id]);
    expect(sent.length).toBe(1);
    expect(getActiveIntents(conn).length).toBe(0);
  });
  test("tickOnce: harga aman tidak eksekusi", async () => {
    const conn = createDb();
    saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    let called = 0;
    expect(await tickOnce(500, { conn, exec: async () => void called++ && "0xx" })).toEqual([]);
    expect(called).toBe(0);
    expect(getActiveIntents(conn).length).toBe(1);
  });
});
