import { MessageCircle } from "lucide-react";
import { BOT_URL } from "../config";
import { openBot } from "../telegram";
import { InfoTooltip } from "./ui/tooltip";
import Button from "./ui/Button";

export default function AlarmCard({ ready }: { ready: boolean }) {
  return (
    <section className={`min-w-0 border-b border-border py-[18px] last:border-b-0 ${ready ? "text-foreground" : "text-muted"}`} aria-label="Pasang alarm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">03</span>
        <h2>Alarm <InfoTooltip>Setelah siap, tulis strategi seperti “jual BNB ke USDC kalau turun di bawah 450” di bot.</InfoTooltip></h2>
      </div>
      <div className="flex flex-col gap-2">
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
      </div>
    </section>
  );
}
