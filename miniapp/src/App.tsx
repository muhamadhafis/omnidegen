import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useReadContract, useSwitchChain } from "wagmi";
import { useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { parseEther } from "viem";
import { API_URL, CHAIN, FAUCET, MUSDC, PRIVY_APP_ID, VAULT, WBNB } from "./config";
import { erc20Abi, wbnbAbi } from "./abi";
import { inTelegram, initTelegram, telegramInitData, tg } from "./telegram";
import { dlog, getLogs, subscribeLogs, type LogEntry } from "./debug-log";
import { openWalletApp } from "./wallets";
import { useTx } from "./hooks/useTx";
import StatusCard from "./components/StatusCard";
import StrategyCard from "./components/StrategyCard";
import WrapCard from "./components/WrapCard";
import ApproveCard from "./components/ApproveCard";
import AlarmCard from "./components/AlarmCard";
import Button from "./components/ui/Button";
import Notice from "./components/ui/Notice";

export default function App() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { address, chainId } = useAccount();
  const connected = authenticated && !!address;
  const embedded = wallets.some((w) => w.walletClientType === "privy");
  const tele = inTelegram();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const wrongNet = connected && chainId !== CHAIN.id;

  const [linkStatus, setLinkStatus] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { connectWallet } = useConnectWallet({
    onSuccess: () => {
      if (connectTimer.current) clearTimeout(connectTimer.current);
      setConnecting(false);
      dlog("connect: onSuccess (lanjut SIWE/address)");
    },
    onError: (error) => {
      if (connectTimer.current) clearTimeout(connectTimer.current);
      setConnecting(false);
      dlog(`connect: onError: ${error || "?"}`);
      setConnectError(error || "Koneksi dibatalkan atau gagal.");
    },
  });

  const startConnect = () => {
    dlog("connect: tap Hubungkan Dompet → connectWallet()");
    setConnecting(true);
    setConnectError(null);
    if (connectTimer.current) clearTimeout(connectTimer.current);
    connectTimer.current = setTimeout(() => {
      setConnecting((c) => {
        if (c) {
          dlog("connect: timeout 60 dtk, belum connected");
          setConnectError("Koneksi tidak selesai dalam 60 detik. Buka MetaMask/Rabby manual, setujui permintaan koneksi di sana, lalu kembali ke sini.");
        }
        return false;
      });
    }, 60_000);
    connectWallet();
  };

  useEffect(() => () => {
    if (connectTimer.current) clearTimeout(connectTimer.current);
  }, []);

  // Transisi wallet (address/chain) — tanpa setState di effect, hanya catat.
  const prevWallet = useRef("");
  useEffect(() => {
    const cur = `${address ?? "-"}#${chainId ?? "?"}`;
    if (cur !== prevWallet.current) {
      prevWallet.current = cur;
      dlog(`wallet: address=${address ?? "-"} chainId=${chainId ?? "?"} auth=${authenticated}`);
    }
  }, [address, chainId, authenticated]);

  // ponytail: debug sementara (?debug=1); hapus setelah diagnosa connect selesai
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const debugMode = (() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1";
    } catch {
      return false;
    }
  })();
  useEffect(() => {
    if (!debugMode) return;
    setLogs(getLogs());
    return subscribeLogs(() => setLogs(getLogs()));
  }, [debugMode]);

  const copyLogs = () => {
    const text = getLogs().map((l) => `[${l.t}] ${l.msg}`).join("\n") || "(log kosong)";
    try {
      navigator.clipboard?.writeText(text).then(
        () => tg()?.showAlert?.("Log tersalin — tempel ke chat."),
        () => tg()?.showAlert?.("Gagal menyalin log."),
      );
    } catch {
      try {
        tg()?.showAlert?.("Gagal menyalin log.");
      } catch { /* abaikan */ }
    }
  };

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

  const readyTx = (allow.data ?? 0n) > 0n && (wbnb.data ?? 0n) > 0n;

  useEffect(() => {
    const initData = telegramInitData();
    if (!API_URL || !address || !initData) return;
    setLinkStatus("linking");
    setLinkError(null);
    dlog(`link-wallet: POST ${API_URL}/api/link-wallet wallet=${address}`);
    fetch(`${API_URL}/api/link-wallet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData, wallet: address }),
    })
      .then(async (res) => {
        dlog(`link-wallet: HTTP ${res.status}`);
        if (!res.ok) throw new Error(`Linking gagal (HTTP ${res.status})`);
        setLinkStatus("linked");
        dlog("link-wallet: OK tersinkron");
      })
      .catch((e) => {
        const m = e instanceof Error ? e.message : "Linking gagal";
        dlog(`link-wallet: ERROR ${m}`);
        setLinkStatus("error");
        setLinkError(m);
      });
  }, [address]);

  const doWrap = (amt: string) => {
    try {
      wrap.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "deposit", value: parseEther(amt) });
    } catch {
      tg()?.showAlert("Nominal salah. Contoh: 0.001");
    }
  };
  const doApprove = (cap: string) => {
    try {
      appr.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "approve", args: [VAULT, parseEther(cap)] });
    } catch {
      tg()?.showAlert("Nominal salah. Contoh: 0.001");
    }
  };
  const doRevoke = () => appr.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "approve", args: [VAULT, 0n] });

  const copyAddress = () => {
    try {
      if (address) navigator.clipboard?.writeText(address).catch(() => {});
    } catch { /* abaikan */ }
    try {
      tg()?.showAlert("Alamat tersalin — tempel di faucet untuk isi tBNB.");
    } catch { /* abaikan */ }
  };

  if (!PRIVY_APP_ID) {
    return (
      <div className="mx-auto w-full max-w-[440px] px-4 py-4 pb-[calc(32px+env(safe-area-inset-bottom))]">
        <a className="skip" href="#main">Lewati ke konten</a>
        <header className="mb-3 flex items-center justify-between">
          <h1>OmniDegen</h1>
          <span className="badge">Testnet</span>
        </header>
        <main id="main" className="mb-[var(--space)] min-w-0 rounded-lg border border-border bg-card p-3">
          <p>VITE_PRIVY_APP_ID belum diisi. Buat app di dashboard Privy lalu isi di file .env miniapp.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-4 pb-[calc(32px+env(safe-area-inset-bottom))]">
      <a className="skip" href="#main">Lewati ke konten</a>
      <header className="mb-3 flex items-center justify-between">
        <h1>OmniDegen</h1>
        <span className="badge">Testnet</span>
      </header>

      <main id="main">
        {wrongNet && (
          <Notice tone="warning" aria-live="polite" aria-label="Jaringan salah">
            <p>Jaringan salah — pindah ke BSC Testnet untuk lanjut.</p>
            <Button variant="primary" type="button" disabled={switching} onClick={() => switchChain({ chainId: CHAIN.id })}>
              {switching ? "Memindahkan…" : "Pindah ke BSC Testnet"}
            </Button>
            {switchError && (
              <p className="err">Dompet tidak merespons. Buka aplikasi dompetmu manual, pindah ke BSC Testnet (chain 97), lalu kembali.</p>
            )}
          </Notice>
        )}

        {debugMode && (
          <Notice aria-label="Log debug">
            <div className="flow-label">Log debug ({logs.length})</div>
            <pre className="debug-log" aria-live="polite">
              {logs.map((l) => `[${l.t}] ${l.msg}`).join("\n") || "(kosong — tap Hubungkan Dompet dulu)"}
            </pre>
            <Button type="button" onClick={copyLogs}>
              Salin Log
            </Button>
          </Notice>
        )}

        {!ready ? (
          <Notice aria-live="polite">
            <p>Siapkan dompet…</p>
          </Notice>
        ) : !connected ? (
          <Notice aria-label="Hubungkan dompet" className="gap-2">
            <Button variant="primary" type="button" disabled={connecting} onClick={startConnect}>
              {connecting ? "Menghubungkan…" : "Hubungkan Dompet"}
            </Button>
            {connecting && (
              <>
                <p className="muted">Buka aplikasi dompetmu dan setujui permintaan koneksi di sana, lalu kembali ke sini.</p>
                <Button type="button" onClick={() => openWalletApp("metamask://")}>
                  Buka MetaMask
                </Button>
                <Button type="button" onClick={() => openWalletApp("rabby://")}>
                  Buka Rabby
                </Button>
              </>
            )}
            {connectError && (
              <>
                <p className="err">{connectError}</p>
                <Button type="button" onClick={startConnect}>
                  Coba Lagi
                </Button>
              </>
            )}
          </Notice>
        ) : wrongNet ? null : (
          <>
            <StatusCard
              address={address!}
              bnb={bnb.data?.value}
              wbnb={wbnb.data as bigint | undefined}
              musdc={musdc.data as bigint | undefined}
              allowance={allow.data as bigint | undefined}
              onCopy={copyAddress}
              onLogout={() => logout()}
            />
            {tele && embedded && (
              <Notice aria-label="Isi saldo testnet">
                <a className="utility-link" href={FAUCET} target="_blank" rel="noreferrer">
                  Isi tBNB di faucet <span aria-hidden="true">→</span>
                </a>
              </Notice>
            )}
            {tele && (
              <Notice
                className={`link-status ${linkStatus}`}
                aria-label="Status sinkronisasi wallet"
                aria-live="polite"
              >
                <div className="status-row">
                  <span className="status-icon">
                    {linkStatus === "linking" && <span className="spinner" />}
                    {linkStatus === "linked" && "✓"}
                    {linkStatus === "error" && "✕"}
                    {linkStatus === "idle" && "○"}
                  </span>
                  <span className="status-text">
                    {linkStatus === "linking" && "Menghubungkan wallet ke bot…"}
                    {linkStatus === "linked" && "Wallet tersinkron dengan bot"}
                    {linkStatus === "error" && `Gagal sinkron: ${linkError}`}
                    {linkStatus === "idle" && "Belum disinkronkan"}
                  </span>
                </div>
              </Notice>
            )}
            <div className="setup-flow" aria-label="Setup rescue">
              <div className="flow-label">Rescue setup</div>
              <WrapCard tx={wrap} embedded={embedded} onWrap={doWrap} complete={(wbnb.data ?? 0n) > 0n} />
              <ApproveCard tx={appr} embedded={embedded} onApprove={doApprove} onRevoke={doRevoke} complete={(allow.data ?? 0n) > 0n} />
              <AlarmCard ready={readyTx} />
            </div>
            {tele && address && telegramInitData() && (
              <StrategyCard initData={telegramInitData()} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
