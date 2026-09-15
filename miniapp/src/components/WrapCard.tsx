import { useEffect, useRef, useState } from "react";
import { SCAN_TX } from "../config";
import type { TxHandle } from "../hooks/useTx";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { ExternalLink, RefreshCw } from "lucide-react";

type Props = { tx: TxHandle; embedded: boolean; onWrap: (amt: string) => void };

export default function WrapCard({ tx, embedded, onWrap, complete = false }: Props & { complete?: boolean }) {
  const [amt, setAmt] = useState("0.001");
  const errRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (tx.error) errRef.current?.focus();
  }, [tx.error]);

  return (
    <section className="min-w-0 border-b border-border py-[18px] last:border-b-0" aria-label="Wrap BNB ke WBNB">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">01</span>
        <h2 className={complete ? "text-muted" : "text-foreground"}>Wrap BNB <InfoTooltip>Wrap mengubah BNB menjadi WBNB agar vault dapat menjalankan rescue.</InfoTooltip></h2>
      </div>
      <div className="mt-3 flex min-w-0 items-end gap-2 max-[380px]:grid max-[380px]:grid-cols-1 max-[380px]:items-stretch">
        <Input
          id="wrap-amount"
          label="Jumlah BNB"
          name="wrap-amount"
          autoComplete="off"
          spellCheck={false}
          inputMode="decimal"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="0.001…"
        />
        <Button type="button" className="gap-2 action-button" disabled={tx.isPending} onClick={() => onWrap(amt)}>
          <RefreshCw aria-hidden="true" size={16} strokeWidth={1.8} />
          {tx.isPending ? "Memproses…" : complete ? "Sudah di-wrap" : "Wrap BNB"}
        </Button>
      </div>
      <div aria-live="polite">
        {tx.isPending && !embedded && <WalletShortcuts />}
        {tx.hash && (
          <a className="tx" href={SCAN_TX(tx.hash)} target="_blank" rel="noreferrer">
            Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        )}
        {tx.error && (
          <p ref={errRef} tabIndex={-1} className="err">
            Gagal wrap: {tx.error.message.slice(0, 100)}. Cek saldo BNB lalu coba lagi.
          </p>
        )}
      </div>
    </section>
  );
}
