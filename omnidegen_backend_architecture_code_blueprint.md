# 🚀 Omnidegen: AI Agent Backend (Bun + TypeScript)

Dokumen ini berisi cetak biru (blueprint) kode untuk *backend* Omnidegen. Arsitektur ini dirancang agar sangat ringan, modular, dan memiliki latensi sangat rendah dengan memanfaatkan **Bun 1.4**, **Groq (LPU)**, dan **SQLite bawaan**.

## 📁 Struktur Direktori Proyek

```text
Omnidegen-agent/
├── .env                  # Environment variables
├── package.json          # Dependencies
├── src/
│   ├── index.ts          # Entry point utama (menjalankan Bot & Cron Job)
│   ├── db.ts             # Konfigurasi SQLite & Schema
│   ├── ai.ts             # Integrasi Groq (LLM Parser)
│   ├── bot.ts            # Telegram Bot Controller (Telegraf)
│   ├── web3.ts           # Koneksi RPC opBNB & Smart Contract (Viem)
│   └── loop.ts           # Event Loop / Engine Pemantau Harga
└── README.md
```

---

## ⚙️ 1. Persiapan Awal (Setup)

Jalankan perintah ini di terminal untuk menginisialisasi proyek dan menginstal pustaka yang dibutuhkan:

```bash
bun init
bun add telegraf viem groq-sdk
```

Buat file `.env` di direktori utama proyek:

```env
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
GROQ_API_KEY="YOUR_GROQ_API_KEY"
BACKEND_PRIVATE_KEY="YOUR_WALLET_PRIVATE_KEY" # Ini dompet server/Session Key
RPC_URL="https://opbnb-testnet-rpc.bnbchain.org"
VAULT_CONTRACT_ADDRESS="0xYourVaultContractAddress"
```

---

## 🗄️ 2. Database Setup (`src/db.ts`)

Kita menggunakan `bun:sqlite` bawaan yang tidak memerlukan instalasi tambahan. Skrip ini akan otomatis membuat tabel saat pertama kali dijalankan.

```typescript
import { Database } from "bun:sqlite";

// Membuka atau membuat file database lokal
export const db = new Database("omnidegen.sqlite", { create: true });

// Inisialisasi tabel Intents (Niat Pengguna)
db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    asset_to_monitor TEXT NOT NULL,
    action_asset TEXT NOT NULL,
    trigger_price REAL NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'executed', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("✅ Database SQLite siap!");

// Fungsi utilitas untuk menyimpan intent
export function saveIntent(userId: string, asset: string, target: string, price: number) {
  const query = db.query(`
    INSERT INTO intents (user_id, asset_to_monitor, action_asset, trigger_price) 
    VALUES ($userId, $asset, $target, $price)
  `);
  query.run({ $userId: userId, $asset: asset, $target: target, $price: price });
}

// Fungsi utilitas untuk mengambil intent aktif
export function getActiveIntents() {
  const query = db.query(`SELECT * FROM intents WHERE status = 'active'`);
  return query.all();
}

// Fungsi utilitas untuk mengubah status
export function updateIntentStatus(id: number, status: string) {
  const query = db.query(`UPDATE intents SET status = $status WHERE id = $id`);
  query.run({ $status: status, $id: id });
}
```

---

## 🧠 3. AI Parser dengan Groq (`src/ai.ts`)

Modul ini bertugas menerima teks santai dari Telegram dan mengubahnya menjadi JSON terstruktur (Function Calling/JSON Mode).

```typescript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function parseUserIntent(text: string) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Anda adalah AI asisten Web3. Ekstrak data dari pesan user menjadi JSON murni tanpa markdown. 
          Gunakan schema berikut: 
          {"asset": "nama token/koin awal", "target": "nama token tujuan", "price": angka batas harga, "action": "stop_loss" | "take_profit"}.
          Jika user menggunakan kata 'turun', 'anjlok', action adalah 'stop_loss'.`
        },
        {
          role: "user",
          content: text
        }
      ],
      model: "llama3-8b-8192", // Model yang sangat cepat untuk JSON parsing
      response_format: { type: "json_object" },
    });

    const result = chatCompletion.choices[0]?.message?.content;
    if (result) {
      return JSON.parse(result);
    }
    return null;
  } catch (error) {
    console.error("Error saat parsing Groq:", error);
    return null;
  }
}
```

---

## 🔗 4. Web3 Engine (`src/web3.ts`)

Bagian ini menggunakan `viem` untuk mengirim transaksi ke kontrak `OmniVault` di jaringan uji opBNB.

```typescript
import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { opBNBTestnet } from "viem/chains";

const account = privateKeyToAccount(process.env.BACKEND_PRIVATE_KEY as `0x${string}`);
const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({
  chain: opBNBTestnet,
  transport: http(process.env.RPC_URL)
});

const walletClient = createWalletClient({
  account,
  chain: opBNBTestnet,
  transport: http(process.env.RPC_URL)
});

// ABI Minimal untuk berinteraksi dengan Vault
const vaultAbi = [
  {
    type: "function",
    name: "executeHedge",
    inputs: [{ name: "userWallet", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

export async function triggerHedgeTransaction(userAddress: string) {
  try {
    console.log(`Menyiapkan transaksi penyelamatan aset untuk: ${userAddress}`);
    
    // Simulasi transaksi (opsional tapi disarankan)
    const { request } = await publicClient.simulateContract({
      account,
      address: vaultAddress,
      abi: vaultAbi,
      functionName: "executeHedge",
      args: [userAddress as `0x${string}`]
    });

    // Eksekusi transaksi
    const txHash = await walletClient.writeContract(request);
    console.log(`✅ Transaksi berhasil dikirim! Tx Hash: ${txHash}`);
    
    return txHash;
  } catch (error) {
    console.error("Gagal mengeksekusi transaksi Web3:", error);
    return null;
  }
}
```

---

## 💬 5. Telegram Bot Controller (`src/bot.ts`)

Bot ini mendengarkan obrolan dari pengguna, mengirimkannya ke Groq, dan menyimpan hasilnya di database SQLite.

```typescript
import { Telegraf } from "telegraf";
import { parseUserIntent } from "./ai";
import { saveIntent } from "./db";

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.start((ctx) => {
  ctx.reply("Halo! Saya Omnidegen bot. Apa yang ingin Anda lindungi hari ini?\n\nContoh: 'Jual BNB saya ke USDC kalau harga turun di bawah $450.'");
});

bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  ctx.reply("🤖 Sedang menganalisis strategi Anda...");

  // 1. Kirim ke Groq untuk diproses
  const parsedIntent = await parseUserIntent(userMessage);

  if (parsedIntent && parsedIntent.asset && parsedIntent.price) {
    // 2. Simpan ke SQLite
    const userId = ctx.from.id.toString();
    saveIntent(userId, parsedIntent.asset, parsedIntent.target, parsedIntent.price);
    
    ctx.reply(`✅ Strategi aktif!\n\nTarget: ${parsedIntent.asset}\nBatas Harga: $${parsedIntent.price}\nAksi: Swap ke ${parsedIntent.target}\n\nSaya akan memantau 24/7.`);
  } else {
    ctx.reply("❌ Maaf, saya tidak mengerti maksud Anda. Bisa perjelas token dan harganya?");
  }
});
```

---

## 🔄 6. Engine Pemantau Harga (`src/loop.ts`)

Inilah "jantung" aplikasi yang berdetak setiap beberapa detik untuk mengecek kondisi pasar dan mengeksekusi strategi yang tersimpan.

```typescript
import { getActiveIntents, updateIntentStatus } from "./db";
import { triggerHedgeTransaction } from "./web3";
import { bot } from "./bot";

// Mock harga untuk simulasi (saat demo hackathon)
// Di tahap produksi, ganti ini dengan fetch API CoinGecko atau baca dari Oracle SC
let currentBNBPrice = 500; 

export function setMockPrice(newPrice: number) {
    currentBNBPrice = newPrice;
    console.log(`[ORACLE] Harga BNB berubah menjadi $${currentBNBPrice}`);
}

export function startPriceMonitor() {
  console.log("🕵️ Engine Pemantau Harga aktif...");

  // Jalankan perulangan setiap 5 detik
  setInterval(async () => {
    const activeIntents: any = getActiveIntents();

    for (const intent of activeIntents) {
      if (intent.asset_to_monitor.toUpperCase() === "BNB") {
        
        // Cek kondisi harga
        if (currentBNBPrice <= intent.trigger_price) {
          console.log(`🚨 ALERT! Harga menyentuh batas untuk user ${intent.user_id}`);
          
          // 1. Eksekusi Smart Contract (contoh address dummy pengguna)
          const dummyUserAddress = "0x1234567890123456789012345678901234567890";
          const txHash = await triggerHedgeTransaction(dummyUserAddress);

          if (txHash) {
             // 2. Update status di database agar tidak dieksekusi berulang kali
             updateIntentStatus(intent.id, 'executed');

             // 3. Beritahu pengguna via Telegram
             bot.telegram.sendMessage(
                 intent.user_id, 
                 `🚨 **PASAR ANJLOK!**\n\nTenang, Omnidegen telah menyelamatkan aset Anda ke ${intent.action_asset} di harga $${currentBNBPrice}.\n\nTx Hash: ${txHash}`
             );
          }
        }
      }
    }
  }, 5000); // 5000 ms = 5 detik
}
```

---

## 🚀 7. Entry Point (`src/index.ts`)

File utama yang menyatukan semua komponen dan menjalankannya secara bersamaan.

```typescript
import { bot } from "./bot";
import { startPriceMonitor, setMockPrice } from "./loop";

console.log("Memulai Omnidegen Agent...");

// Menjalankan Bot Telegram
bot.launch().then(() => {
    console.log("🤖 Telegram Bot sedang berjalan.");
});

// Menjalankan Engine Pemantauan Harga
startPriceMonitor();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- SIMULASI UNTUK DEMO HACKATHON ---
// Setel timer 30 detik untuk meniru market crash secara otomatis
setTimeout(() => {
    console.log("\n📉 [SIMULASI] Market crash terjadi!");
    setMockPrice(440); // Ini akan memicu eksekusi Web3
}, 30000);
```

---
**Selesai!** Kamu bisa menjalankan seluruh peladen agen ini cukup dengan perintah:
```bash
bun run src/index.ts
