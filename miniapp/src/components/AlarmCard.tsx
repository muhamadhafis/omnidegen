import { Bell, MessageCircle } from "lucide-react";
import { BOT_URL } from "../config";
import { openBot } from "../telegram";
import Button from "./ui/Button";
import SectionTitle from "./ui/SectionTitle";
import Stack from "./ui/Stack";

export default function AlarmCard({ ready }: { ready: boolean }) {
  return (
    <section className={`min-w-0 border-b border-border last:border-b-0 ${ready ? "text-foreground" : "text-muted"}`} aria-label="Pasang alarm">
      <div className="flex min-w-0 items-center gap-3">
        <SectionTitle tip="Setelah siap, tulis strategi seperti “jual BNB ke USDC kalau turun di bawah 450” di bot."><Bell aria-hidden="true" size={16} strokeWidth={1.8} /><span className="sr-only">Alarm</span></SectionTitle>
      </div>
      <Stack gap={2}>
        <Button
          className="gap-2"
          variant="primary"
          type="button"
          disabled={!ready}
          onClick={() => {
            if (ready) openBot(BOT_URL);
          }}
        >
          <MessageCircle aria-hidden="true" size={16} strokeWidth={1.8} />
          Buka Chat Bot
        </Button>
      </Stack>
    </section>
  );
}
