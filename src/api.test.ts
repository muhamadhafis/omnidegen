import { beforeEach, describe, expect, test } from "bun:test";
import { createApiHandler } from "./api";
import { createDb, getUserWallet } from "./db";
import type { Database } from "bun:sqlite";

const TOKEN = "123456:ABC-secret";
const WALLET = "0x1234567890123456789012345678901234567890";

function signed() {
  const data = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 6577260927 }) });
  const check = [...data.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = new Bun.CryptoHasher("sha256", "WebAppData").update(TOKEN).digest();
  data.set("hash", new Bun.CryptoHasher("sha256", secret).update(check).digest("hex"));
  return data.toString();
}

describe("wallet linking API", () => {
  let conn: Database;
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.MINIAPP_ORIGIN = "https://miniapp.example";
    conn = createDb(); // DB memori: test tak boleh menyentuh DB produksi
  });

  test("rejects foreign origin and invalid signature", async () => {
    const handler = createApiHandler(conn);
    const badOrigin = await handler(new Request("https://api.test/api/link-wallet", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ initData: signed(), wallet: WALLET }) }));
    expect(badOrigin.status).toBe(403);
    const badAuth = await handler(new Request("https://api.test/api/link-wallet", { method: "POST", headers: { origin: "https://miniapp.example", "content-type": "application/json" }, body: JSON.stringify({ initData: "auth_date=1&hash=bad", wallet: WALLET }) }));
    expect(badAuth.status).toBe(400);
  });

  test("requires valid wallet before persistence", async () => {
    const handler = createApiHandler(conn);
    const response = await handler(new Request("https://api.test/api/link-wallet", { method: "POST", headers: { origin: "https://miniapp.example", "content-type": "application/json" }, body: JSON.stringify({ initData: signed(), wallet: "attacker" }) }));
    expect(response.status).toBe(400);
  });

  test("links verified Telegram user to wallet", async () => {
    const handler = createApiHandler(conn);
    const response = await handler(new Request("https://api.test/api/link-wallet", { method: "POST", headers: { origin: "https://miniapp.example", "content-type": "application/json" }, body: JSON.stringify({ initData: signed(), wallet: WALLET }) }));
    expect(response.status).toBe(200);
    expect(getUserWallet("6577260927", conn)).toBe(WALLET);
  });
});
