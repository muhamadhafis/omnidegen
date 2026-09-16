const MAX_AGE_SECONDS = 24 * 60 * 60;

function hex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equalHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyTelegramInitData(initData: string, botToken: string, now = Math.floor(Date.now() / 1000)): string {
  if (!initData || !botToken) throw new Error("missing auth data");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date"));
  const userRaw = params.get("user");
  if (!hash || !Number.isSafeInteger(authDate) || !userRaw) throw new Error("invalid auth data");
  if (authDate > now + 60 || now - authDate > MAX_AGE_SECONDS) throw new Error("expired auth data");

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = new Bun.CryptoHasher("sha256", "WebAppData").update(botToken).digest();
  const hmac = new Bun.CryptoHasher("sha256", secret).update(dataCheckString).digest();
  if (!equalHex(hex(hmac), hash)) throw new Error("invalid auth signature");

  try {
    const user = JSON.parse(userRaw) as { id?: number };
    if (!Number.isSafeInteger(user.id)) throw new Error("invalid user");
    return String(user.id);
  } catch {
    throw new Error("invalid user");
  }
}
