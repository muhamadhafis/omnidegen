import { Database } from "bun:sqlite";

export const INTENT_TYPES = ["stop_loss", "take_profit", "vacuum", "defi_batch", "ask"] as const;
export type IntentType = (typeof INTENT_TYPES)[number];
const ALLOWED_ASSETS = new Set(["BNB", "USDC", "USDT", "DUST"]);

export type IntentInput = {
  userId: string;
  userWallet: string;
  intentType: IntentType;
  asset: string;
  target: string;
  price?: number;
  amountPct?: number;
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    telegram_user_id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_wallet TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    asset_to_monitor TEXT NOT NULL,
    action_asset TEXT NOT NULL,
    trigger_price REAL DEFAULT 0,
    amount_percentage REAL DEFAULT 100,
    status TEXT DEFAULT 'active',
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

// migrasi ringan: ALTER dibungkus try/catch agar idempoten untuk DB lama.
export function runMigrations(conn: Database) {
  for (const sql of ["ALTER TABLE intents ADD COLUMN tx_hash TEXT"]) {
    try {
      conn.exec(sql);
    } catch { /* kolom sudah ada */ }
  }
}

export function createDb(path = ":memory:") {
  const conn = new Database(path, { create: true });
  conn.exec(SCHEMA);
  runMigrations(conn);
  return conn;
}

// ponytail: file sqlite, migrasi ke postgres kalau user >1k / concurrent write
export const db = createDb(process.env.DB_PATH ?? "omnidegen.sqlite");

export function saveUserWallet(telegramUserId: string, walletAddress: string, conn: Database = db) {
  if (!telegramUserId || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) throw new Error("bad wallet");
  // address hex case-insensitive: simpan lowercase agar perbandingan tak false-positive
  const wallet = walletAddress.toLowerCase();
  conn.query(`
    INSERT INTO users (telegram_user_id, wallet_address)
    VALUES ($uid, $wallet)
    ON CONFLICT(telegram_user_id) DO UPDATE SET wallet_address=$wallet, updated_at=CURRENT_TIMESTAMP
  `).run({ $uid: telegramUserId, $wallet: wallet });
}

export function getUserWallet(telegramUserId: string, conn: Database = db): string | undefined {
  const row = conn.query(`SELECT wallet_address FROM users WHERE telegram_user_id=$uid`).get({ $uid: telegramUserId }) as { wallet_address?: string } | null;
  return row?.wallet_address;
}

// ganti dompet: batalkan intent aktif yang terikat ke wallet lain agar tak
// menembak (dan gagal berisik) setiap harga trigger. Perbandingan case-insensitive
// (EIP-55 checksum vs lowercase) + proteksi baris lama. Kembalikan jumlah dibatalkan.
export function cancelStaleIntents(telegramUserId: string, walletAddress: string, conn: Database = db): number {
  const r = conn.query(`UPDATE intents SET status='cancelled' WHERE user_id=$uid AND status='active' AND LOWER(user_wallet) != LOWER($wallet)`).run({ $uid: telegramUserId, $wallet: walletAddress });
  return Number((r as any).changes ?? 0);
}

export function saveIntent(input: IntentInput, conn: Database = db): number {
  const asset = input.asset.toUpperCase();
  const target = input.target.toUpperCase();
  if (!INTENT_TYPES.includes(input.intentType)) throw new Error("bad intent_type");
  if (!ALLOWED_ASSETS.has(asset) || !ALLOWED_ASSETS.has(target)) throw new Error("bad asset");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.userWallet)) throw new Error("bad wallet");
  const pct = input.amountPct ?? 100;
  if (pct < 1 || pct > 100) throw new Error("bad pct");
  const price = input.price ?? 0;
  if ((input.intentType === "stop_loss" || input.intentType === "take_profit") && !(price > 0))
    throw new Error("price must be >0 for price trigger");

  const q = conn.query(`
    INSERT INTO intents (user_id, user_wallet, intent_type, asset_to_monitor, action_asset, trigger_price, amount_percentage)
    VALUES ($uid, $wallet, $type, $asset, $target, $price, $pct) RETURNING id as id`);
  return (q.get({ $uid: input.userId, $wallet: input.userWallet.toLowerCase(), $type: input.intentType, $asset: asset, $target: target, $price: price, $pct: pct }) as any).id as number;
}

export function getActiveIntents(conn: Database = db) {
  return conn.query(`SELECT * FROM intents WHERE status = 'active'`).all() as any[];
}

// claim-first anti double-execute: hanya 1 worker dapat baris
export function claimIntent(id: number, conn: Database = db): boolean {
  const r = conn.query(`UPDATE intents SET status='claimed' WHERE id=$id AND status='active'`).run({ $id: id });
  return Number((r as any).changes ?? 0) > 0;
}

export function updateIntentStatus(id: number, status: string, conn: Database = db) {
  conn.query(`UPDATE intents SET status=$s WHERE id=$id`).run({ $s: status, $id: id });
}

// bukti eksekusi: hash Tx yang SUDAH terkonfirmasi receipt success.
// Tulis hanya untuk hash real (panggil dengan isRealTxHash).
export function updateIntentProof(id: number, txHash: string, conn: Database = db) {
  conn.query(`UPDATE intents SET tx_hash=$h WHERE id=$id`).run({ $h: txHash, $id: id });
}

export function getLastIntent(userId: string, conn: Database = db) {
  return conn.query(`SELECT * FROM intents WHERE user_id=$uid ORDER BY id DESC LIMIT 1`).get({ $uid: userId }) as any;
}
