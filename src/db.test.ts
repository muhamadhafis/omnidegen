import { describe, test, expect } from "bun:test";
import { createDb, getActiveIntents, getLastIntent, getUserWallet, claimIntent, saveIntent, saveUserWallet } from "./db";

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
  test("persists wallet by Telegram user and updates it", () => {
    const c = createDb();
    saveUserWallet("6577260927", W, c);
    expect(getUserWallet("6577260927", c)).toBe(W);
    saveUserWallet("6577260927", W.replace("1234", "abcd"), c);
    expect(getUserWallet("6577260927", c)).toBe(W.replace("1234", "abcd"));
    expect(() => saveUserWallet("6577260927", "not-an-address", c)).toThrow();
  });
});
