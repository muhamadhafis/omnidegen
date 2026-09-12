import { bot } from "./bot";
import { startPriceMonitor, setMockPrice } from "./loop";

console.log("OmniDegen agent start...");
if ((process.env.TELEGRAM_BOT_TOKEN ?? "dummy") !== "dummy") {
  bot.launch().then(() => console.log("🤖 bot jalan"));
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} else console.log("skip bot.launch (no token)");
startPriceMonitor();

// demo crash terkontrol untuk juri
setTimeout(() => {
  console.log("\n📉 SIMULASI crash!");
  setMockPrice(440);
}, 30_000);
