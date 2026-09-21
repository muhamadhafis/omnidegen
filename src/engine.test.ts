import { describe, test, expect } from "bun:test";
import { shouldTrigger, tickOnce, failHint, isRealTxHash } from "./loop";
import { applySlippage, checkPropagated, confirmTransaction, validateHedgeRequest } from "./web3";
import { routeIntent, parseCrash, isAdmin, formatInfo, statusLine, approveText, webAppKeyboard, setPending, getPending, clearPending, isBuyRequest } from "./bot";
import { createDb, saveIntent, getActiveIntents, saveUserWallet, getUserWallet } from "./db";

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
    expect(validateHedgeRequest(W, "USDT")).toBe(false); // vault tak bisa keluarkan USDT
  });
  test("slippage: potong quote per bps", () => {
    expect(applySlippage(10000n, 200)).toBe(9800n); // default 2%
    expect(applySlippage(10000n, 0)).toBe(10000n);
    expect(() => applySlippage(0n, 200)).toThrow("no liquidity");
    expect(() => applySlippage(10000n, 10001)).toThrow("bad slippage");
  });
  test("propagasi: terlihat / coba-lagi / hilang", async () => {
    expect(await checkPropagated(async () => ({ h: 1 }), "0xabc" as `0x${string}`, 3, 1)).toBe(true);
    let n = 0;
    const flaky = async () => (++n >= 2 ? { h: 1 } : null);
    expect(await checkPropagated(flaky, "0xabc" as `0x${string}`, 3, 1)).toBe(true);
    expect(n).toBe(2);
    expect(await checkPropagated(async () => { throw new Error("nf"); }, "0xabc" as `0x${string}`, 2, 1)).toBe(false);
  });
  test("isRealTxHash hanya hash 64-hex", () => {
    expect(isRealTxHash("0x" + "ab".repeat(32))).toBe(true);
    expect(isRealTxHash("0xmock123")).toBe(false);
    expect(isRealTxHash("0xtest")).toBe(false);
    expect(isRealTxHash(undefined)).toBe(false);
  });
  test("tickOnce simpan proof untuk hash real", async () => {
    const conn = createDb();
    const id = saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    await tickOnce(440, { conn, exec: async () => "0x" + "cd".repeat(32) });
    // baca via .all(): .get() berparameter flaky pada driver sqlite (lihat catatan plan)
    const rows = conn.query("select id, tx_hash from intents").all() as any[];
    expect(rows.find((r) => r.id === id)?.tx_hash).toBe("0x" + "cd".repeat(32));
  });
  test("tickOnce lewati proof untuk mock", async () => {
    const conn = createDb();
    const id = saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    await tickOnce(440, { conn, exec: async () => "0xmock1" });
    const rows = conn.query("select id, tx_hash from intents").all() as any[];
    expect(rows.find((r) => r.id === id)?.tx_hash).toBeNull();
  });
  test("confirmTransaction: sukses / revert / hilang", async () => {
    const ok = { waitForTransactionReceipt: async () => ({ status: "success" }) };
    await confirmTransaction(ok, "0xabc" as `0x${string}`, 1000);
    const bad = { waitForTransactionReceipt: async () => ({ status: "reverted" }) };
    await expect(confirmTransaction(bad, "0xabc" as `0x${string}`, 1000)).rejects.toThrow("reverted");
    const hang = { waitForTransactionReceipt: () => new Promise<{ status: string }>(() => {}) };
    await expect(confirmTransaction(hang, "0xabc" as `0x${string}`, 50)).rejects.toThrow("no receipt");
    expect(failHint("no receipt (60s): 0xabc")).toContain("dropped");
    expect(failHint("tx reverted: 0xabc")).toContain("revert");
  });
  test("routing 3 use-case", () => {
    expect(routeIntent({ type: "stop_loss", asset: "BNB", target: "USDC", price: 450, amountPct: 100 })).toBe("monitor");
    expect(routeIntent({ type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 })).toBe("execute_now");
    expect(routeIntent({ type: "defi_batch", asset: "USDT", target: "BNB", price: 0, amountPct: 50 })).toBe("execute_now");
    expect(routeIntent({ type: "ask", asset: "BNB", target: "BNB", price: 0, amountPct: 100 } as any)).toBe("info");
    const c = createDb(); // DB memori: test tak boleh menyentuh DB produksi
    saveUserWallet("u1", W, c);
    expect(getUserWallet("u1", c)).toBe(W);
  });
  test("permintaan beli ditolak sebelum LLM", () => {
    expect(isBuyRequest("beli BNB kalau turun ke 100")).toBe(true);
    expect(isBuyRequest("Borong mUSDC sekarang")).toBe(true);
    expect(isBuyRequest("buy the dip")).toBe(true);
    expect(isBuyRequest("jual BNB kalau turun ke 100")).toBe(false);
    expect(isBuyRequest("kalau bnb turun ke $100 jual")).toBe(false);
    expect(isBuyRequest("TP BNB ke 500")).toBe(false);
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
    const bal = { walletBnb: 5000000000000000n, wbnb: 1000000000000000n, allowance: 1000000000000000n, stable: 396434372331416720n };
    const s = formatInfo(W, bal, [
      { intent_type: "stop_loss", asset_to_monitor: "BNB", action_asset: "USDC", trigger_price: 450 },
    ]);
    expect(s).toContain(W);
    expect(s).toContain("0.005");
    expect(s).toContain("0.001");
    expect(s).toContain("stop_loss");
    expect(s).toContain("Izin ke vault");
    expect(formatInfo(W, { walletBnb: 0n, wbnb: 0n, allowance: 0n, stable: 0n }, [])).toContain("belum ada");
    expect(statusLine({ intent_type: "stop_loss", asset_to_monitor: "BNB", action_asset: "USDC", trigger_price: 450, status: "failed" })).toContain("gagal");
    expect(formatInfo(W, { walletBnb: 0n, wbnb: 0n, allowance: 0n, stable: 0n }, [], { intent_type: "stop_loss", asset_to_monitor: "BNB", action_asset: "USDC", trigger_price: 450, status: "failed" })).toContain("Terakhir");
    expect(approveText()).toContain("Approve");
    expect(failHint("no approve")).toContain("Mini App");
  });
  test("pending konfirmasi instan", () => {    const p: any = { type: "vacuum", asset: "DUST", target: "BNB", price: 0, amountPct: 100 };
    expect(getPending("u1")).toBeUndefined();
    setPending("u1", p);
    expect(getPending("u1")).toEqual(p);
    clearPending("u1");
    expect(getPending("u1")).toBeUndefined();
  });
  test("keyboard mini app", () => {
    delete process.env.MINIAPP_URL;
    expect(webAppKeyboard()).toBeUndefined();
    process.env.MINIAPP_URL = "https://x.vercel.app";
    expect(JSON.stringify(webAppKeyboard())).toContain("web_app");
    delete process.env.MINIAPP_URL;
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
  test("tickOnce gagal: notif alasan + status failed", async () => {
    const conn = createDb();
    saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    const sent: string[] = [];
    const done = await tickOnce(440, { conn, exec: async () => { throw new Error("no deposit"); }, notify: async (uid, m) => void sent.push(m) });
    expect(done).toEqual([]);
    expect(sent.length).toBe(1);
    expect(sent[0]).toContain("gagal");
    expect(sent[0]).toContain("deposit");
    expect(getActiveIntents(conn).length).toBe(0);
    expect(failHint("no deposit")).toContain("deposit");
    expect(failHint("boom")).toBe("boom");
  });
  test("tickOnce: harga aman tidak eksekusi", async () => {
    const conn = createDb();
    saveIntent({ userId: "u9", userWallet: W, intentType: "stop_loss", asset: "BNB", target: "USDC", price: 450 }, conn);
    let called = 0;
    expect(await tickOnce(500, { conn, exec: async () => { called++; return "0xx"; } })).toEqual([]);
    expect(called).toBe(0);
    expect(getActiveIntents(conn).length).toBe(1);
  });
});
