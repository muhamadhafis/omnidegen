import { useEffect, useRef, useState } from "react";
import { SCAN_TX } from "../config";
import type { TxHandle } from "../hooks/useTx";
import { parseAmtSafe } from "../lib/format";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import AmountInput from "./AmountInput";
import Button from "./ui/Button";
import { ExternalLink, ShieldCheck, ShieldOff } from "lucide-react";

type Props = {
  tx: TxHandle;
  onApprove: (cap: string) => void;
  onRevoke: () => void;
  max: bigint | undefined;
};

function confirmRevoke(): Promise<boolean> {
  return Promise.resolve(window.confirm("Cabut izin vault? Rescue berhenti sampai approve lagi."));
}

export default function ApproveCard({ tx, onApprove, onRevoke, max, complete = false }: Props & { complete?: boolean }) {
  const [cap, setCap] = useState("0");
  const [asking, setAsking] = useState(false);
  const parsed = parseAmtSafe(cap);
  const overMax = max !== undefined && parsed > max;
  const empty = parsed <= 0n;
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
        <AmountInput id="approve-cap" label="Batas WBNB" symbol="WBNB" value={cap} onChange={setCap} max={max} />
        <Button type="button" className="gap-2 action-button" disabled={tx.isPending || empty || overMax} onClick={() => onApprove(cap)}>
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
        {overMax && (
          <p className="err">Nominal melebihi saldo WBNB.</p>
        )}
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
