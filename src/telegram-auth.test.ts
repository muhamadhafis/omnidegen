import { describe, expect, test } from "bun:test";
import { verifyTelegramInitData } from "./telegram-auth";

const TOKEN = "123456:ABC-secret";

function signed(overrides: Record<string, string> = {}) {
  const values = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 6577260927, first_name: "Test" }),
    ...overrides,
  };
  const data = new URLSearchParams(values);
  const check = [...data.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = new Bun.CryptoHasher("sha256", "WebAppData").update(TOKEN).digest();
  const hash = new Bun.CryptoHasher("sha256", secret).update(check).digest("hex");
  data.set("hash", hash);
  return data.toString();
}

describe("Telegram initData security", () => {
  test("accepts valid signed user", () => {
    expect(verifyTelegramInitData(signed(), TOKEN)).toBe("6577260927");
  });
  test("rejects tampered payload", () => {
    const value = signed().replace("Test", "Attacker");
    expect(() => verifyTelegramInitData(value, TOKEN)).toThrow("invalid auth signature");
  });
  test("rejects wrong bot token", () => {
    expect(() => verifyTelegramInitData(signed(), "wrong-token")).toThrow("invalid auth signature");
  });
  test("rejects expired payload", () => {
    const old = String(Math.floor(Date.now() / 1000) - 86401);
    expect(() => verifyTelegramInitData(signed({ auth_date: old }), TOKEN)).toThrow("expired auth data");
  });
  test("rejects future payload outside clock tolerance", () => {
    const future = String(Math.floor(Date.now() / 1000) + 120);
    expect(() => verifyTelegramInitData(signed({ auth_date: future }), TOKEN)).toThrow("expired auth data");
  });
});
