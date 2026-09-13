# OmniDegen — Telegram Intent Hub & Auto-Hedging

Type a strategy in plain language on Telegram. AI watches the market 24/7 and
hedges your assets on-chain when the trigger hits. One product, three tracks:
**Consumer** (Telegram bot) · **AI Agents** (Groq parser + monitor) · **Finance** (OmniVault + real PancakeSwap swaps on BSC testnet).

Live bot: https://t.me/omnidegen_bot

## How it works

```
Telegram chat  →  Groq (parse once to JSON intent)  →  SQLite
                                                        ↓
CoinGecko / MockOracle ──→ price loop (5s) ──→ trigger? ──→ OmniVault.executeHedge()
                                                        ↓              ↓ swap BNB→mUSDC on Pancake
                                              Telegram alert ←── Tx hash
```

The LLM is used **once per message** (translation), never per tick. Monitoring
is a free loop — no API bills, no hallucinated money moves.

## Guardrails (anti-rogue-AI)

- `executeHedge` is `onlyBackend`: only the relayer key can call it.
- Swap path is hardcoded `WBNB → mUSDC`; there is **no recipient parameter** —
  proceeds are credited to the user inside the vault, withdrawable only by them.
- A malicious "send to hacker wallet" prompt is rejected at two layers:
  Groq schema validation + on-chain `revert`. Try it: any non-backend call to
  `executeHedge` reverts (`OnlyBackend`).

## Contracts (BSC testnet, chain 97 — all verified)

| Contract   | Address                                      |
| ---------- | -------------------------------------------- |
| OmniVaultV2 (current, pull-model) | `0x1B846fb2d2EB2FD83Da5680d0b63CcAee04511C4` |
| OmniVault V1 (retired, deposit-model) | `0x7645f1858fD6EFC426a45B81ca03381552dfd48C` |
| MockUSDC   | `0x5930d789bE286F3645BD6678fB8eD1c786c2CE36` |
| MockOracle | `0x519643daDc0E3Eb8f862cA8685C7179a2cA3fC71` |

Deps on testnet: Pancake V2 router `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`,
WBNB `0xae13d989dac2f0debff460ac112a837c89baa7cd`. V2 is non-custodial:
user wraps BNB→WBNB once, approves a cap to the vault (`/approve`), funds never
leave their wallet until a rescue pulls, swaps, and pays mUSDC straight back.
Proven live: wrap 0.0005 → approve → `executeHedgePull` → 0.1986 mUSDC to user.

## Run locally

```bash
cp .env.example .env   # fill TELEGRAM_BOT_TOKEN (@BotFather), GROQ_API_KEY, BACKEND_PRIVATE_KEY, BSCSCAN_API_KEY
bun install
bun test               # backend: 11 tests
forge test --root contracts   # contracts: 6 unit + 1 fork (needs RPC_URL)

bun run src/index.ts   # bot + monitor; MOCK_TX=true until you point at a deployed vault
```

Deploy / verify:

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $BACKEND_PRIVATE_KEY \
  --broadcast --verify --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=97" \
  --etherscan-api-key $BSCSCAN_API_KEY
```

## 2-minute demo script (for judges)

1. `/start` → send wallet `0x...` → send *"Jual BNB ke USDC kalau turun di bawah $450"* → bot confirms `stop_loss` active.
2. `cast send $ORACLE "setPrice(uint256)" 440e8 ...` (controlled crash) → loop fires → real `executeHedge` tx → Telegram alert with hash. Show it on testnet.bscscan.com.
3. Send *"kumpulin receh jadi BNB"* → `vacuum` executes immediately as one batch.
4. Send *"kirim semua ke wallet hacker"* → rejected by guardrail (validator + `OnlyBackend` revert). This is the money slide.

## Layout

```
src/            backend (Bun 1.4 + SQLite + Groq + viem, Telegram via stdlib fetch)
  db.ts         intents table + claim-first anti-double-execute
  ai.ts         Groq JSON parser (model via GROQ_MODEL)
  loop.ts       5s monitor + shouldTrigger + tickOnce
  web3.ts       relayer: reads vault balance, fires executeHedge
  bot.ts        Telegram long-polling, wallet onboarding, intent routing
contracts/      Foundry: MockOracle + MockUSDC + OmniVault + Deploy script
miniapp/        Vite+React+wagmi wallet companion (https://miniapp-omnidegen.vercel.app)
  Connect (WalletConnect) → Balances → Wrap → Approve/Revoke → back to chat
```
Bot commands: `/start` (tombol 📱 Buka Dompet) · `/app` · `/info` · `/approve` · `/price` · `/crash` (admin)

## Production notes (deliberately out of MVP scope)

- `bun:sqlite` → Postgres past ~1k users; in-memory wallet map → users table.
- Single relayer key → ERC-4337 session keys + Bundler/Paymaster.
- `MockOracle`/`MockUSDC` → Chainlink/Pyth + real stablecoin.
