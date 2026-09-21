import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useReadContract } from "wagmi";
import { MUSDC, SCAN_TX, WBNB } from "../config";
import { pancakeRouterAbi } from "../abi";
import type { TxHandle } from "../hooks/useTx";
import { fmtToken8, parseAmtSafe } from "../lib/format";
import { reportWalletTx } from "../lib/txlog";
import { dlog } from "../debug-log";
import AmountInput from "./AmountInput";
import WalletShortcuts from "./WalletShortcuts";
import { InfoTooltip } from "./ui/tooltip";
import Button from "./ui/Button";
import { ExternalLink, ShieldOff } from "lucide-react";

type TabId = "wrap" | "approve" | "unwrap" | "swap";

const TABS: { id: TabId; label: string; tip: string }[] = [
  { id: "wrap", label: "Wrap BNB", tip: "Wrap mengubah BNB menjadi WBNB agar vault dapat menjalankan rescue." },
  { id: "approve", label: "Approve Vault", tip: "Approve memberi vault izin terbatas untuk menarik WBNB saat alarm aktif. Izin dapat dicabut kapan saja." },
  { id: "unwrap", label: "Unwrap WBNB", tip: "Unwrap mengubah WBNB kembali menjadi BNB native." },
  { id: "swap", label: "Tukar mUSDC", tip: "Swap balik via Pancake dengan slippage tetap 2%. Setujui dulu bila izin kurang." },
];

const SLIPPAGE_BPS = 200; // tetap 2%, konsisten dengan backend

type Props = {
  bnb: bigint | undefined;
  wbnb: bigint | undefined;
  musdc: bigint | undefined;
  allowVault: bigint | undefined;
  allowRouter: bigint | undefined;
  router: `0x${string}` | undefined;
  address: `0x${string}` | undefined;
  wrap: TxHandle;
  appr: TxHandle;
  unwrap: TxHandle;
  rAppr: TxHandle;
  rSwap: TxHandle;
  revoke: TxHandle;
  onWrap: (amt: string) => void;
  onApproveVault: (cap: string) => void;
  onRevoke: () => void;
  onUnwrap: (amt: string) => void;
  onApproveMusdc: (amt: string) => void;
  onReverseSwap: (amt: string, minOut: bigint) => void;
};

export default function TokenTabs(p: Props) {
  const [tab, setTab] = useState<TabId>("wrap");
  const [amt, setAmt] = useState("0");
  const [asking, setAsking] = useState(false);
  const errRef = useRef<HTMLParagraphElement>(null);

  const parsed = parseAmtSafe(amt);
  const max = tab === "wrap" ? p.bnb : tab === "swap" ? p.musdc : p.wbnb;
  const symbol = tab === "wrap" ? "BNB" : tab === "swap" ? "mUSDC" : "WBNB";
  const inputLabel = tab === "approve" ? "Batas WBNB" : tab === "swap" ? "Jumlah mUSDC" : tab === "unwrap" ? "Jumlah WBNB" : "Jumlah BNB";
  const overMax = max !== undefined && parsed > max;
  const empty = parsed <= 0n;

  // reset nominal tiap transaksi sukses + tiap ganti tab. Pengecualian sadar:
  // approve mUSDC sukses TIDAK me-reset agar user lanjut tap swap.
  const watchTx = tab === "wrap" ? p.wrap : tab === "approve" ? p.appr : tab === "unwrap" ? p.unwrap : p.rSwap;
  useEffect(() => {
    if (watchTx.isSuccess) setAmt("0");
  }, [watchTx.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAmt("0");
  }, [tab]);

  // quote khusus tab swap (pindahan ReverseSwapCard)
  const quote = useReadContract({
    address: p.router,
    abi: pancakeRouterAbi,
    functionName: "getAmountsOut",
    args: [parsed, [MUSDC, WBNB]],
    query: { enabled: tab === "swap" && !!p.router && parsed > 0n },
  });
  const out = quote.data?.[1] as bigint | undefined;
  const minOut = out !== undefined ? (out * BigInt(10_000 - SLIPPAGE_BPS)) / 10_000n : undefined;
  useEffect(() => {
    if (p.rSwap.isSuccess) quote.refetch();
  }, [p.rSwap.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (quote.error) dlog(`quote gagal: ${(quote.error as Error).message.slice(0, 120)}`);
  }, [quote.error]);

  const needsApprove = (p.allowRouter ?? 0n) < parsed;
  const busy = p.wrap.isPending || p.appr.isPending || p.unwrap.isPending || p.rAppr.isPending || p.rSwap.isPending || p.revoke.isPending;
  const activeHash =
    tab === "wrap" ? p.wrap.hash : tab === "approve" ? (p.revoke.hash ?? p.appr.hash) : tab === "unwrap" ? p.unwrap.hash : (p.rSwap.hash ?? p.rAppr.hash);
  const activeErr =
    tab === "wrap" ? p.wrap.error : tab === "approve" ? (p.revoke.error ?? p.appr.error) : tab === "unwrap" ? p.unwrap.error : (p.rSwap.error ?? p.rAppr.error);
  const activeBusy =
    tab === "wrap" ? p.wrap.isPending : tab === "approve" ? (p.revoke.isPending || p.appr.isPending) : tab === "unwrap" ? p.unwrap.isPending : busy;
  const wrapped = (p.wbnb ?? 0n) > 0n;
  const approved = (p.allowVault ?? 0n) > 0n;

  useEffect(() => {
    if (activeErr) errRef.current?.focus();
  }, [activeErr]);

  // lapor tiap Tx dompet ke backend SEKALI (dedup di helper): status ikut
  // kondisi handle saat hash muncul; backend mengesahkan via receipt.
  useEffect(() => {
    if (!p.address) return;
    const jobs = [
      { h: p.wrap, kind: "wrap", token: "BNB" },
      { h: p.appr, kind: "approve", token: "WBNB" },
      { h: p.unwrap, kind: "unwrap", token: "WBNB" },
      { h: p.rAppr, kind: "approve", token: "mUSDC" },
      { h: p.rSwap, kind: "swap", token: "mUSDC" },
      { h: p.revoke, kind: "revoke", token: "WBNB" },
    ];
    for (const j of jobs) {
      if (!j.h.hash) continue;
      reportWalletTx({ wallet: p.address, kind: j.kind, amt, token: j.token, hash: j.h.hash, status: j.h.isSuccess ? "success" : j.h.error ? "failed" : "submitted" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.wrap.hash, p.appr.hash, p.unwrap.hash, p.rAppr.hash, p.rSwap.hash, p.revoke.hash, p.address]);

  const confirmRevoke = async () => {
    setAsking(true);
    try {
      if (window.confirm("Cabut izin vault? Rescue berhenti sampai approve lagi.")) p.onRevoke();
    } finally {
      setAsking(false);
    }
  };

  const primary = (() => {
    const common = "gap-2 action-button";
    if (tab === "wrap")
      return (
        <Button type="button" className={common} disabled={p.wrap.isPending || empty || overMax} onClick={() => p.onWrap(amt)}>
          {p.wrap.isPending ? "Memproses…" : wrapped ? "Sudah di-wrap" : "Wrap BNB"}
        </Button>
      );
    if (tab === "approve")
      return (
        <Button type="button" className={common} disabled={p.appr.isPending || empty || overMax} onClick={() => p.onApproveVault(amt)}>
          {p.appr.isPending ? "Memproses…" : approved ? "Sudah di-approve" : "Approve Vault"}
        </Button>
      );
    if (tab === "unwrap")
      return (
        <Button type="button" className={common} disabled={p.unwrap.isPending || empty || overMax} onClick={() => p.onUnwrap(amt)}>
          {p.unwrap.isPending ? "Memproses…" : "Unwrap WBNB"}
        </Button>
      );
    if (needsApprove)
      return (
        <Button type="button" className={common} disabled={busy || empty} onClick={() => p.onApproveMusdc(amt)}>
          {p.rAppr.isPending ? "Memproses…" : "Approve mUSDC"}
        </Button>
      );
    return (
      <Button type="button" className={common} disabled={busy || empty || overMax || !p.router || out === undefined} onClick={() => minOut !== undefined && p.onReverseSwap(amt, minOut)}>
        {p.rSwap.isPending ? "Memproses…" : "Tukar ke WBNB"}
      </Button>
    );
  })();

  const tip = TABS.find((t) => t.id === tab)?.tip ?? "";
  const title = tab === "swap" ? "Tukar mUSDC ke WBNB" : tab === "approve" ? "Approve Vault" : tab === "unwrap" ? "Unwrap WBNB" : "Wrap BNB";

  return (
    <div className="min-w-0">
      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <Tabs.List className="token-tabs" aria-label="Fitur token">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.id} value={t.id} className="tab-trigger">
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="mt-3 flex min-w-0 items-center gap-2.5">
          <h2 className="text-foreground">{title} <InfoTooltip>{tip}</InfoTooltip></h2>
        </div>
        <div className="mt-3">
          <AmountInput id={`token-${tab}-amount`} label={inputLabel} symbol={symbol} value={amt} onChange={setAmt} max={max} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {primary}
          {tab === "approve" && (
            <Button type="button" variant="ghost" className="gap-2 action-button" disabled={p.revoke.isPending || asking} onClick={confirmRevoke}>
              <ShieldOff aria-hidden="true" size={16} strokeWidth={1.8} />
              {asking ? "…" : "Cabut Izin"}
            </Button>
          )}
        </div>
      </Tabs.Root>
      <div aria-live="polite">
        {overMax && (
          <p className="err">Nominal melebihi saldo {symbol}.</p>
        )}
        {tab === "wrap" && !overMax && max !== undefined && max > 0n && parsed >= max && !empty && (
          <p className="warn">Hati-hati: wrap 100% menghabiskan BNB untuk gas transaksi berikutnya.</p>
        )}
        {tab === "swap" && (
          <div className="metric">
            <span className="label">Estimasi terima</span>
            <span className="value">{!p.router ? "…" : out === undefined ? (quote.isPending ? "Memuat…" : "—") : `${fmtToken8(out)} WBNB (min. ${fmtToken8(minOut!)})`}</span>
          </div>
        )}
        {tab === "swap" && quote.error && !quote.isPending && out === undefined && (
          <p className="err">Quote gagal dimuat. Cek koneksi lalu coba lagi.</p>
        )}
        {activeBusy && <WalletShortcuts />}
        {activeHash && (
          <a className="tx" href={SCAN_TX(activeHash)} target="_blank" rel="noreferrer">
            Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
          </a>
        )}
        {activeErr && (
          <p ref={errRef} tabIndex={-1} className="err">
            Gagal: {activeErr.message.slice(0, 100)}. Cek saldo lalu coba lagi.
          </p>
        )}
      </div>
    </div>
  );
}
