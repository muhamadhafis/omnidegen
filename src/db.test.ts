import { describe, test, expect } from "bun:test";
import { createDb, saveIntent, getActiveIntents, claimIntent, getLastIntent } from "./db";

const W = "0x1234567890123456789012345678901234567890";

describe("db", () => {
  test("save stop_loss + claim anti double", () => {
    const c = createDb();
    const id = saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c);
    expect(id).toBeGreaterThan(0);
    expect(getActiveIntents(c).length).toBe(1);
    expect(claimIntent(id, c)).toBe(true);
    expect(claimIntent(id, c)).toBe(false); // race kalah
  });
  test("reject bad wallet/price/asset", () => {
    const c = createDb();
    expect(() => saveIntent({ userId: "1", userWallet: "bad", intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c)).toThrow();
    expect(() => saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 0 }, c)).toThrow();
    expect(() => saveIntent({ userId: "1", userWallet: W, intentType: "vacuum", asset: "DUST", target: "SHIT", price: 0 }, c)).toThrow();
  });
  test("vacuum tanpa harga lolos", () => {
    const c = createDb();
    const id = saveIntent({ userId: "1", userWallet: W, intentType: "vacuum", asset: "DUST", target: "BNB" }, c);
    expect(id).toBeGreaterThan(0);
  });
  test("getLastIntent mengembalikan terbaru", () => {
    const c = createDb();
    expect(getLastIntent("1", c)).toBeNull();
    const a = saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c);
    const b = saveIntent({ userId: "1", userWallet: W, intentType: "vacuum", asset: "DUST", target: "BNB" }, c);
    expect((getLastIntent("1", c) as any).id).toBe(b);
    expect((getLastIntent("2", c) as any)).toBeNull();
    void a;
  });
});
