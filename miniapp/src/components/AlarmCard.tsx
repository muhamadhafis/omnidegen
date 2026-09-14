import { BOT_URL } from "../config";
import Icon from "./Icon";
import { InfoTooltip } from "./ui/tooltip";

export default function AlarmCard({ ready }: { ready: boolean }) {
  return (
    <section className={`min-w-0 border-b border-border py-[18px] last:border-b-0 ${ready ? "text-foreground" : "text-muted"}`} aria-label="Pasang alarm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">03</span>
        <h2>Alarm <InfoTooltip>Setelah siap, tulis strategi seperti “jual BNB ke USDC kalau turun di bawah 450” di bot.</InfoTooltip></h2>
      </div>
      <div className="flex flex-col gap-2">
        <p className={ready ? "ok" : "warn"} aria-live="polite">
          {ready ? "Siap" : "Terkunci · wrap + approve dulu"}
        </p>
        <a
          className="w-full rounded-md border border-accent bg-accent px-[13px] py-2.5 text-center text-[15px] font-semibold text-accent-foreground transition-[transform,filter] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-px"
          href={ready ? BOT_URL : undefined}
          aria-disabled={!ready}
          onClick={(event) => {
            if (!ready) event.preventDefault();
          }}
        >
          <Icon name="chat" />
          Buka Chat Bot
        </a>
      </div>
    </section>
  );
}
