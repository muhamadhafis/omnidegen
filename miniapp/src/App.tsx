import { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { formatEther, parseEther } from "viem";
import { BOT_URL, CHAIN, MUSDC, SCAN_TX, VAULT, WBNB } from "./config";
import { WALLETS } from "./wallets";
import { erc20Abi, wbnbAbi } from "./abi";
import { initTelegram, shortAddr, tg } from "./telegram";

function useTx() {
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  return { hash, error, isPending, isSuccess, writeContract };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

// Saat tx pending di HP: webview tidak auto-buka dompet, jadi sediakan
// shortcut tap-to-open per dompet agar request tanda tangan terlihat.
function WalletShortcuts() {
  return (
    <div aria-live="polite">
      <p>Ketuk dompetmu untuk tanda tangan:</p>
      <div className="chips">
        {WALLETS.map((w) => (
          <a key={w.id} className="chip" href={w.scheme}>
            {w.label} →
          </a>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const wrongNet = isConnected && chainId !== CHAIN.id;

  // otomatis pindah ke BSC testnet (dompet yang belum punya chain akan diminta menambahkannya)
  useEffect(() => {
    if (wrongNet) switchChain({ chainId: CHAIN.id });
  }, [wrongNet]); // eslint-disable-line react-hooks/exhaustive-deps
  const [wrapAmt, setWrapAmt] = useState("0.001");
  const [capAmt, setCapAmt] = useState("0.001");
  const wrap = useTx();
  const appr = useTx();

  useEffect(initTelegram, []);

  const bnb = useBalance({ address });
  const wbnb = useReadContract({ address: WBNB, abi: wbnbAbi, functionName: "balanceOf", args: [address!], query: { enabled: !!address } });
  const musdc = useReadContract({ address: MUSDC, abi: erc20Abi, functionName: "balanceOf", args: [address!], query: { enabled: !!address } });
  const allow = useReadContract({ address: WBNB, abi: wbnbAbi, functionName: "allowance", args: [address!, VAULT], query: { enabled: !!address } });

  useEffect(() => {
    if (wrap.isSuccess || appr.isSuccess) {
      wbnb.refetch();
      musdc.refetch();
      allow.refetch();
      bnb.refetch();
    }
  }, [wrap.isSuccess, appr.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v: bigint | undefined) => (v === undefined ? "…" : formatEther(v));
  const ready = (allow.data ?? 0n) > 0n && (wbnb.data ?? 0n) > 0n;

  const doWrap = () => {
    try {
      wrap.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "deposit", value: parseEther(wrapAmt) });
    } catch {
      tg()?.showAlert("Nominal salah");
    }
  };
  const doApprove = (amount: bigint) =>
    appr.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "approve", args: [VAULT, amount] });

  return (
    <div className="wrap">
      <header>
        <h1>🛡️ OmniDegen</h1>
        <span className="badge">BSC Testnet</span>
      </header>

      {wrongNet && (
        <div className="card warn-card" aria-live="polite">
          <p>Jaringan salah — pindah ke BSC Testnet untuk lanjut.</p>
          <button className="btn primary" disabled={switching} onClick={() => switchChain({ chainId: CHAIN.id })}>
            {switching ? "…" : "Pindah ke BSC Testnet"}
          </button>
          {switchError && (
            <p className="err" aria-live="polite">
              Dompet tidak merespons. Buka aplikasi dompetmu manual, pindah ke BSC Testnet (chain 97), lalu kembali.
            </p>
          )}
        </div>
      )}

      {!isConnected ? (
        <div className="card">
          <p>Hubungkan dompet untuk mulai. Private key tidak pernah keluar dari HP kamu.</p>
          <button className="btn primary" onClick={() => open()}>
            Connect Wallet
          </button>
        </div>
      ) : wrongNet ? null : (
        <>
          <div className="card">
            <div className="addr">
              <code>{shortAddr(address)}</code>
              <button className="link" onClick={() => disconnect()}>putus</button>
            </div>
            <Field label="BNB dompet" value={bnb.data ? formatEther(bnb.data.value) : "…"} />
            <Field label="WBNB" value={fmt(wbnb.data as bigint | undefined)} />
            <Field label="mUSDC" value={fmt(musdc.data as bigint | undefined)} />
            <Field label="Izin ke vault" value={`${fmt(allow.data as bigint | undefined)} WBNB`} />
          </div>

          <div className="card">
            <h2>1 · Wrap BNB → WBNB</h2>
            <div className="inline">
              <input aria-label="Jumlah BNB untuk wrap" name="wrap-amount" autoComplete="off" value={wrapAmt} onChange={(e) => setWrapAmt(e.target.value)} inputMode="decimal" />
              <button className="btn" disabled={wrap.isPending} onClick={doWrap}>
                {wrap.isPending ? "…" : "Wrap"}
              </button>
            </div>
            <div aria-live="polite">
              {wrap.isPending && <WalletShortcuts />}
              {wrap.hash && <a className="tx" href={SCAN_TX(wrap.hash)} target="_blank" rel="noreferrer">lihat tx →</a>}
              {wrap.error && <p className="err">gagal: {wrap.error.message.slice(0, 100)}</p>}
            </div>
          </div>

          <div className="card">
            <h2>2 · Approve vault (batas tarik)</h2>
            <div className="inline">
              <input aria-label="Batas approve WBNB" name="approve-cap" autoComplete="off" value={capAmt} onChange={(e) => setCapAmt(e.target.value)} inputMode="decimal" />
              <button
                className="btn"
                disabled={appr.isPending}
                onClick={() => {
                  try {
                    doApprove(parseEther(capAmt));
                  } catch {
                    tg()?.showAlert("Nominal salah");
                  }
                }}
              >
                {appr.isPending ? "…" : "Approve"}
              </button>
              <button className="btn ghost" disabled={appr.isPending} onClick={() => doApprove(0n)}>
                Revoke
              </button>
            </div>
            {appr.isPending && <WalletShortcuts />}
            {appr.hash && <a className="tx" href={SCAN_TX(appr.hash)} target="_blank" rel="noreferrer">lihat tx →</a>}
            {appr.error && <p className="err" aria-live="polite">gagal: {appr.error.message.slice(0, 100)}</p>}
          </div>

          <div className="card">
            <h2>3 · Pasang alarm di chat</h2>
            <p className={ready ? "ok" : "warn"}>
              {ready ? "✅ Siap rescue. Ketik strategi di chat bot." : "⚠️ Wrap + approve dulu agar rescue bisa jalan."}
            </p>
            <a className="btn primary" href={BOT_URL}>Buka chat bot →</a>
          </div>
        </>
      )}
    </div>
  );
}
