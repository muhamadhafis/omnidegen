import { bot } from "./bot";
import { startPriceMonitor } from "./loop";
import { startApi } from "./api";

console.log("Omnidegen agent start...");
if ((process.env.TELEGRAM_BOT_TOKEN ?? "dummy") !== "dummy") {
  bot.launch().then(() => console.log("🤖 bot jalan"));
  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());
} else console.log("skip bot.launch (no token)");
startPriceMonitor();
if ((process.env.API_ENABLED ?? "true") === "true") {
  startApi();
  console.log(`🌐 api :${process.env.API_PORT ?? 8787} origin=${process.env.MINIAPP_ORIGIN ?? "-"}`);
} else console.log("skip api (API_ENABLED=false)");
