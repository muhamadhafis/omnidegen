import { describe, test, expect } from "bun:test";
import { createDb, getActiveIntents, getLastIntent, getRecentIntents, getUserWallet, getWalletTxs, claimIntent, saveIntent, saveUserWallet, cancelStaleIntents, runMigrations, updateIntentProof, recordWalletTx, verifyPendingTxs } from "./db";

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
  test("ganti dompet membatalkan intent wallet lama saja", () => {
    const c = createDb();
    const W2 = W.replace("1234", "abcd");
    saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c);
    saveIntent({ userId: "1", userWallet: W2, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    expect(cancelStaleIntents("1", W2, c)).toBe(1);
    expect(getActiveIntents(c).length).toBe(1);
    expect((getActiveIntents(c)[0] as any).user_wallet).toBe(W2);
    expect(cancelStaleIntents("2", W2, c)).toBe(0); // user lain tak tersentuh
  });
  test("case address tak memicu cancel keliru (EIP-55 vs lowercase)", () => {
    const c = createDb();
    const mixed = "0x4Dc58A4AFbC95C337C3518b4d4878af9b80Bf3AA";
    saveUserWallet("1", mixed, c);
    expect(getUserWallet("1", c)).toBe(mixed.toLowerCase());
    saveIntent({ userId: "1", userWallet: mixed, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    expect(cancelStaleIntents("1", mixed.toLowerCase(), c)).toBe(0); // dompet sama
    expect(cancelStaleIntents("1", mixed, c)).toBe(0); // dompet sama beda case
    expect(getActiveIntents(c).length).toBe(1);
  });
  test("migrasi idempoten + proof roundtrip", () => {
    const c = createDb();
    runMigrations(c);
    runMigrations(c); // jalan kedua tak boleh throw
    const id = saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, c);
    updateIntentProof(id, "0x" + "ab".repeat(32), c);
    expect((c.query("select tx_hash from intents where id=$id").get({ $id: id }) as any).tx_hash).toBe("0x" + "ab".repeat(32));
  });
  test("wallet_txs: record valid + tolak buruk + list per-user", () => {
    const c = createDb();
    const H = "0x" + "ab".repeat(32);
    const id = recordWalletTx({ userId: "1", userWallet: W, kind: "wrap", amount: "0.001", token: "BNB", txHash: H, status: "success" }, c);
    expect(id).toBeGreaterThan(0);
    expect(() => recordWalletTx({ userId: "1", userWallet: W, kind: "hack", amount: "1", token: "X", txHash: H, status: "success" }, c)).toThrow("bad kind");
    expect(() => recordWalletTx({ userId: "1", userWallet: W, kind: "wrap", amount: "1", token: "X", txHash: "0xbad", status: "success" }, c)).toThrow("bad hash");
    expect(() => recordWalletTx({ userId: "1", userWallet: "bad", kind: "wrap", amount: "1", token: "X", txHash: H, status: "success" }, c)).toThrow("bad wallet");
    expect(getWalletTxs("1", 20, c).length).toBe(1);
    expect(getWalletTxs("2", 20, c).length).toBe(0);
  });
  test("verifyPendingTxs: success/failed/null/from-beda", async () => {
    const c = createDb();
    const mk = (suffix: string) => recordWalletTx({ userId: "1", userWallet: W, kind: "wrap", amount: "1", token: "BNB", txHash: "0x" + suffix.repeat(32), status: "submitted" }, c);
    mk("aa"); mk("bb"); mk("cc"); mk("dd");
    const stub = async (h: string) => {
      if (h.includes("aa")) return { status: "success", from: W };
      if (h.includes("bb")) return { status: "reverted", from: W };
      if (h.includes("cc")) return { status: "success", from: "0x9999999999999999999999999999999999999999" };
      return null;
    };
    expect(await verifyPendingTxs(c, stub, 10)).toBe(2);
    const rows = getWalletTxs("1", 20, c);
    expect(rows.find((r: any) => r.tx_hash.includes("aa"))?.status).toBe("success");
    expect(rows.find((r: any) => r.tx_hash.includes("bb"))?.status).toBe("failed");
    expect(rows.find((r: any) => r.tx_hash.includes("cc"))?.verified).toBe(0); // from beda: dilewati
    expect(rows.find((r: any) => r.tx_hash.includes("dd"))?.status).toBe("submitted"); // receipt null: tetap
  });
  test("riwayat urut terbaru + batas limit + per-user", () => {
    const c = createDb();
    saveIntent({ userId: "1", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    saveIntent({ userId: "1", userWallet: W, intentType: "take_profit", asset: "BNB", target: "USDC", price: 500 }, c);
    saveIntent({ userId: "2", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 400 }, c);
    const all = getRecentIntents("1", 20, c) as any[];
    expect(all.length).toBe(2);
    expect(all[0].trigger_price).toBe(500); // terbaru dulu
    expect(getRecentIntents("1", 1, c).length).toBe(1);
    expect(getRecentIntents("9", 20, c).length).toBe(0);
  });
});
