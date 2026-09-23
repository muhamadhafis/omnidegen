# Omnidegen — Asisten Strategi Kripto di Telegram

Omnidegen adalah tool untuk mengamankan aset kripto secara otomatis — seperti Grab untuk pesan ojek online, Omnidegen untuk pasang strategi stop-loss / take-profit lewat chat, lalu dieksekusi otomatis on-chain 24/7.

Bot: https://t.me/omnidegen_bot

![Mini App Omnidegen: dompet, aksi token, dan strategi](public/docs-1.png)

## Arsitektur Infrastruktur (Infrastructure)

```mermaid
flowchart TD
    subgraph Clients["Pengguna / Client Layer"]
        TG["Telegram Mobile / Desktop App"]
        MA["React MiniApp (Vite + Wagmi/Privy)"]
        LP["Landing Page (Vite + WebGL GradientWaves)"]
    end

    subgraph Tunnel["Network & Proxy Layer"]
        ZR["zrok Tunnel Public Proxy"]
        TGA["Telegram Bot API"]
    end

    subgraph Backend["Backend Service (Bun Server)"]
        API["Hono REST API (Port 8787)"]
        BOT["Telegram Bot Polling (bot.ts)"]
        AI["Groq LLM Intent Parser (ai.ts)"]
        MON["Price Monitor Loop (loop.ts - 5s)"]
        W3["Web3 Relayer Engine (web3.ts)"]
        DB[("SQLite Database (Omnidegen.sqlite)")]
    end

    subgraph Blockchain["BNB Chain Testnet (Chain ID 97)"]
        RPC["Multi-Node RPC (Alchemy / PublicNode)"]
        VAULT["OmniVaultV2 Contract (0x1B84...11C4)"]
        PANCAKE["PancakeSwap V2 Router (0xD99D...550D)"]
        WBNB["WBNB Contract (0xae13...7cd)"]
        MUSDC["mUSDC Contract (0x5930...CE36)"]
    end

    %% Flow Connections
    TG -->|"Kirim Pesan Chat"| TGA
    TGA -->|"Webhook / Long Poll"| BOT
    BOT -->|"Extract Intent"| AI
    BOT -->|"Simpan Strategi"| DB

    TG -->|"Buka MiniApp Webview"| MA
    MA -->|"HTTP POST /api/link-wallet & /api/txs"| ZR
    ZR -->|"Bypass Header"| API
    API -->|"CRUD Users, Intents & Txs"| DB

    MON -->|"Cek Strategi Aktif"| DB
    MON -->|"Fetch Live Price"| RPC
    MON -->|"Trigger Rescue"| W3

    W3 -->|"Execute executeHedgePull Tx"| VAULT
    VAULT -->|"Swap WBNB -> mUSDC"| PANCAKE
    PANCAKE -->|Transfer Asset| MUSDC
    W3 -->|"Simpan Receipt Hash"| DB
    W3 -->|"Notifikasi Hasil"| TGA
```

## Untuk pengguna: cara pakai (5 menit)

**1. Hubungkan dompet.** Buka bot → `/start` → Buka Mini App → Hubungkan Dompet (MetaMask atau Rabby). Bot mengenali dompetmu otomatis, tanpa tempel alamat manual.

**2. Siapkan dana (testnet BSC).** Isi tBNB dari faucet → **Wrap** jadi WBNB → **Approve** vault (batas bisa diatur, bisa dicabut kapan saja). Dana tetap di dompetmu; vault hanya boleh menarik sebatas izin.

**3. Kirim strategi via chat.** Contoh:
- `TP BNB kalau terbang ke 500` → take profit aktif
- `CL BNB kalau di bawah 400` → stop loss aktif

**4. Terima hasil.** Saat trigger tersentuh kamu dapat notifikasi + hash transaksi asli yang bisa diklik ke bscscan. Semua tercatat di tab Riwayat dan Transaksi.

**Fitur dompet di Mini App:** saldo BNB/WBNB/mUSDC + izin vault, unwrap WBNB→BNB, tukar balik mUSDC→WBNB (quote live, slippage 2%), cabut izin, kurs pool live, input persen + slider.

**Yang perlu kamu tahu:** bot hanya bisa JUAL otomatis (hedge ke USDC). Minta "beli" akan ditolak dengan arahan (beli manual lewat tab Tukar). Target hedge yang didukung: USDC. Strategi sekali pakai (fire sekali lalu selesai, tercatat di riwayat).

## Untuk teknikal (ringkas)

```text
Chat Telegram → Groq (parse sekali jadi JSON) → SQLite (users, intents)
Mini App → initData tervalidasi → POST /api/* → SQLite yang sama
Loop 5 dtk → trigger? → relayer executeHedgePull → Pancake WBNB→mUSDC
  → tunggu receipt → sukses/notif+link, gagal/jujur+failed
```

- **Non-custodial**: pull-model, allowance-cap, revocable, tanpa recipient param.
- **Kejujuran eksekusi**: sukses hanya bila receipt `success`; hash real disimpan di baris intent; mock tak pernah dapat link explorer.
- **Guardrail**: validasi target, tolak prompt jahat (validator + `revert` on-chain), tolak beli otomatis, normalisasi USDT→USDC, cleanup intent dompet lama, slippage 2% dari quote on-chain.
- **Kontrak (BSC testnet chain 97)**: VaultV2 `0x1B846f…04511C4`, mUSDC `0x5930d7…c2CE36`, router Pancake `0xD99D1c…16550D`.

```bash
cp .env.example .env   # TELEGRAM_BOT_TOKEN, GROQ_API_KEY, BACKEND_PRIVATE_KEY,
                       # RPC_URL (+_FALLBACK), VAULT_CONTRACT_ADDRESS, MUSDC_ADDRESS,
                       # DB_PATH, MOCK_TX=false untuk real, SLIPPAGE_BPS, API_*
bun install && bun test            # backend 43 test
bunx tsc --noEmit -p tsconfig.json
forge test --root contracts        # kontrak: unit + fork
bun run src/index.ts               # bot + monitor + API
cd miniapp && bun run build        # tsc + lint + build Mini App
cd landing-page && bun run build   # tsc + build Landing Page
```

Bot: `/start` `/app` · `/info` & `/approve` redirect ke Mini App · natural language + konfirmasi YA untuk aksi instan · `/price` · `/crash` (admin).

**Struktur**: `src/` (api, bot, loop, web3, db, ai, telegram-auth) · `contracts/` (Foundry, OmniVaultV2 pull-model) · `miniapp/` (TokenTabs, StrategiesPanel 3-tab, PoolLiveCard, ui reuse, debug `?debug=1`) · `landing-page/` (Vite + React + WebGL GradientWaves).

**Catatan produksi**: SQLite file → Postgres saat besar; single relayer key → session key; testnet-only (mUSDC mock, pool tipis).
