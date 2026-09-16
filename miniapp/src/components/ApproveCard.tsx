import { useEffect, useRef, useState } from "react";
import { SCAN_TX } from "../config";
import type { TxHandle } from "../hooks/useTx";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";

type Props = {
  tx: TxHandle;
  onApprove: (cap: string) => void;
  onRevoke: () => void;
};

function confirmRevoke(): Promise<boolean> {
  return Promise.resolve(window.confirm("Cabut izin vault? Rescue berhenti sampai approve lagi."));
}

export default function ApproveCard({ tx, onApprove, onRevoke, complete = false }: Props & { complete?: boolean }) {
  const [cap, setCap] = useState("0.001");
  const [asking, setAsking] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (tx.error) errRef.current?.focus();
  }, [tx.error]);

  return (
    <section className="min-w-0 border-b border-border py-[18px] last:border-b-0" aria-label="Approve vault">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">02</span>
        <h2 className={complete ? "text-muted" : "text-foreground"}>Approve Vault <InfoTooltip>Approve memberi vault izin terbatas untuk menarik WBNB saat alarm aktif. Izin dapat dicabut kapan saja.</InfoTooltip></h2>
      </div>
      <div className="mt-3 flex min-w-0 items-end gap-2 max-[440px]:grid max-[440px]:grid-cols-1 max-[440px]:items-stretch">
        <Input
          id="approve-cap"
          label="Batas WBNB"
          name="approve-cap"
          autoComplete="off"
          spellCheck={false}
          inputMode="decimal"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          placeholder="0.001…"
        />
        <Button type="button" className="gap-2 action-button" disabled={tx.isPending} onClick={() => onApprove(cap)}>
          <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.8} />
          {tx.isPending ? "Memproses…" : complete ? "Sudah di-approve" : "Approve Vault"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="gap-2 action-button"
          disabled={tx.isPending || asking}
          onClick={async () => {
            setAsking(true);
            try {
              if (await confirmRevoke()) onRevoke();
            } finally {
              setAsking(false);
            }
          }}
        >
          <ShieldOff aria-hidden="true" size={16} strokeWidth={1.8} />
          {asking ? "…" : "Cabut Izin"}
        </Button>
      </div>
      <div aria-live="polite">
        {tx.isPending && <WalletShortcuts />}
        {tx.hash && (
          <a className="tx" href={SCAN_TX(tx.hash)} target="_blank" rel="noreferrer">
            Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        )}
        {tx.error && (
          <p ref={errRef} tabIndex={-1} className="err">
            Gagal approve: {tx.error.message.slice(0, 100)}. Buka dompet lalu coba lagi.
          </p>
        )}
      </div>
    </section>
  );
}
