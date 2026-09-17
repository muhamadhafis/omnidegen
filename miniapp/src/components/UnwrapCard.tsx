import { useEffect, useRef, useState } from "react";
import { SCAN_TX } from "../config";
import type { TxHandle } from "../hooks/useTx";
import { parseAmtSafe } from "../lib/format";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import AmountInput from "./AmountInput";
import Button from "./ui/Button";
import { ExternalLink, ArrowDownUp } from "lucide-react";

type Props = { tx: TxHandle; onUnwrap: (amt: string) => void; max: bigint | undefined };

export default function UnwrapCard({ tx, onUnwrap, max, complete = false }: Props & { complete?: boolean }) {
  const [amt, setAmt] = useState("0");
  const parsed = parseAmtSafe(amt);
  const overMax = max !== undefined && parsed > max;
  const empty = parsed <= 0n;
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (tx.error) errRef.current?.focus();
  }, [tx.error]);

  return (
    <section className="min-w-0 border-b border-border py-[18px] last:border-b-0" aria-label="Unwrap WBNB ke BNB">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">01</span>
        <h2 className={complete ? "text-muted" : "text-foreground"}>Unwrap WBNB <InfoTooltip>Unwrap mengubah WBNB kembali menjadi BNB native.</InfoTooltip></h2>
      </div>
      <div className="mt-3 flex min-w-0 items-end gap-2 max-[380px]:grid max-[380px]:grid-cols-1 max-[380px]:items-stretch">
        <AmountInput id="unwrap-amount" label="Jumlah WBNB" symbol="WBNB" value={amt} onChange={setAmt} max={max} />
        <Button type="button" className="gap-2 action-button" disabled={tx.isPending || empty || overMax} onClick={() => onUnwrap(amt)}>
          <ArrowDownUp aria-hidden="true" size={16} strokeWidth={1.8} />
          {tx.isPending ? "Memproses…" : "Unwrap WBNB"}
        </Button>
      </div>
      {overMax && (
        <p className="err">Nominal melebihi saldo WBNB.</p>
      )}
      <div aria-live="polite">
        {tx.isPending && <WalletShortcuts />}
        {tx.hash && (
          <a className="tx" href={SCAN_TX(tx.hash)} target="_blank" rel="noreferrer">
            Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        )}
        {tx.error && (
          <p ref={errRef} tabIndex={-1} className="err">
            Gagal unwrap: {tx.error.message.slice(0, 100)}. Cek saldo WBNB lalu coba lagi.
          </p>
        )}
      </div>
    </section>
  );
}
