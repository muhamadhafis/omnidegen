import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { MUSDC, SCAN_TX, WBNB } from "../config";
import { pancakeRouterAbi } from "../abi";
import type { TxHandle } from "../hooks/useTx";
import { fmtToken, parseAmtSafe } from "../lib/format";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import AmountInput from "./AmountInput";
import Button from "./ui/Button";
import { ExternalLink, ArrowLeftRight, ShieldCheck } from "lucide-react";

const SLIPPAGE_BPS = 200; // tetap 2%, konsisten dengan backend

type Props = {
  appr: TxHandle;
  swap: TxHandle;
  router: `0x${string}` | undefined;
  allowance: bigint | undefined;
  max: bigint | undefined;
  onApprove: (amt: string) => void;
  onSwap: (amt: string, minOut: bigint) => void;
};

export default function ReverseSwapCard({ appr, swap, router, allowance, max, onApprove, onSwap }: Props) {
  const [amt, setAmt] = useState("0");
  const errRef = useRef<HTMLParagraphElement>(null);
  const parsed = parseAmtSafe(amt);
  const overMax = max !== undefined && parsed > max;
  const empty = parsed <= 0n;

  const quote = useReadContract({
    address: router,
    abi: pancakeRouterAbi,
    functionName: "getAmountsOut",
    args: [parsed, [MUSDC, WBNB]],
    query: { enabled: !!router && parsed > 0n },
  });
  const out = quote.data?.[1] as bigint | undefined;
  const minOut = out !== undefined ? (out * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n : undefined;
  const needsApprove = (allowance ?? 0n) < parsed;
  const busy = appr.isPending || swap.isPending;
  const err = appr.error ?? swap.error;

  useEffect(() => {
    if (err) errRef.current?.focus();
  }, [err]);

  useEffect(() => {
    if (swap.isSuccess) quote.refetch();
  }, [swap.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="min-w-0 border-b border-border py-[18px] last:border-b-0" aria-label="Tukar mUSDC ke WBNB">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted">02</span>
        <h2 className="text-foreground">Tukar mUSDC ke WBNB <InfoTooltip>Swap balik via Pancake dengan slippage tetap 2%. Setujui dulu bila izin kurang.</InfoTooltip></h2>
      </div>
      <div className="mt-3 flex min-w-0 items-end gap-2 max-[380px]:grid max-[380px]:grid-cols-1 max-[380px]:items-stretch">
        <AmountInput id="rswap-amount" label="Jumlah mUSDC" symbol="mUSDC" value={amt} onChange={setAmt} max={max} />
        {needsApprove ? (
          <Button type="button" className="gap-2 action-button" disabled={busy || empty} onClick={() => onApprove(amt)}>
            <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.8} />
            {appr.isPending ? "Memproses…" : "Approve mUSDC"}
          </Button>
        ) : (
          <Button type="button" className="gap-2 action-button" disabled={busy || empty || overMax || !router || out === undefined} onClick={() => minOut !== undefined && onSwap(amt, minOut)}>
            <ArrowLeftRight aria-hidden="true" size={16} strokeWidth={1.8} />
            {swap.isPending ? "Memproses…" : "Tukar ke WBNB"}
          </Button>
        )}
      </div>
      {overMax && (
        <p className="err">Nominal melebihi saldo mUSDC.</p>
      )}
      <div className="metric" aria-live="polite">
        <span className="label">Estimasi terima</span>
        <span className="value">{!router ? "…" : out === undefined ? (quote.isPending ? "Memuat…" : "—") : `${fmtToken(out)} WBNB (min. ${fmtToken(minOut!)})`}</span>
      </div>
      <div aria-live="polite">
        {busy && <WalletShortcuts />}
        {(appr.hash || swap.hash) && (
          <a className="tx" href={SCAN_TX((swap.hash ?? appr.hash)!)} target="_blank" rel="noreferrer">
            Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        )}
        {err && (
          <p ref={errRef} tabIndex={-1} className="err">
            Gagal tukar: {err.message.slice(0, 100)}. Cek saldo mUSDC lalu coba lagi.
          </p>
        )}
      </div>
    </section>
  );
}
