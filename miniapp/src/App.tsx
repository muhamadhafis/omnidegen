import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useDisconnect, useReadContract, useSwitchChain } from "wagmi";
import { useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { parseEther } from "viem";
import { API_URL, apiHeaders, CHAIN, FAUCET, MUSDC, PRIVY_APP_ID, VAULT, WBNB } from "./config";
import { erc20Abi, pancakeRouterAbi, vaultRouterAbi, wbnbAbi } from "./abi";
import { inTelegram, initTelegram, telegramInitData, tg } from "./telegram";
import { dlog, getLogs, subscribeLogs, type LogEntry } from "./debug-log";
import { openWalletApp } from "./wallets";
import { useTx } from "./hooks/useTx";
import StatusCard from "./components/StatusCard";
import StrategyCard from "./components/StrategyCard";
import WrapCard from "./components/WrapCard";
import ApproveCard from "./components/ApproveCard";
import UnwrapCard from "./components/UnwrapCard";
import ReverseSwapCard from "./components/ReverseSwapCard";
import AlarmCard from "./components/AlarmCard";
import Button from "./components/ui/Button";
import Notice from "./components/ui/Notice";

export default function App() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const { address, chainId } = useAccount();
  const connected = !!address;
  const tele = inTelegram();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const wrongNet = connected && chainId !== CHAIN.id;

  const [linkStatus, setLinkStatus] = useState<"idle" | "linking" | "linked" | "error">("idle");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setActiveWallet } = useSetActiveWallet();
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (connectTimer.current) clearTimeout(connectTimer.current);
      setConnecting(false);
      dlog(`connect: onSuccess wallet=${wallet.address} type=${wallet.walletClientType}`);
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
  useEffect(() => {
    if (wallets.length > 1) dlog(`wallets: ${wallets.length} terhubung (${wallets.map((w) => w.walletClientType).join(",")})`);
  }, [wallets]);
  // Satu dompet eksternal sebagai aktif — sembuhkan ambiguitas bila user lama
  // masih punya embedded ter-link. Sekali per address (ref guard, anti-loop).
  const activatedRef = useRef("");
  useEffect(() => {
    const ext = wallets.find((w) => w.walletClientType !== "privy");
    if (connected && ext && activatedRef.current !== ext.address) {
      activatedRef.current = ext.address;
      dlog(`active-wallet: set ${ext.address}`);
      setActiveWallet(ext).catch((e) => dlog(`active-wallet: gagal (${e instanceof Error ? e.message : "?"})`));
    }
  }, [wallets, connected, setActiveWallet]);

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
  const unwrap = useTx();
  const rAppr = useTx();
  const rSwap = useTx();

  useEffect(initTelegram, []);

  const bnb = useBalance({ address });
  const wbnb = useReadContract({ address: WBNB, abi: wbnbAbi, functionName: "balanceOf", args: [address!], query: { enabled: !!address } });
  const musdc = useReadContract({ address: MUSDC, abi: erc20Abi, functionName: "balanceOf", args: [address!], query: { enabled: !!address } });
  const allow = useReadContract({ address: WBNB, abi: wbnbAbi, functionName: "allowance", args: [address!, VAULT], query: { enabled: !!address } });
  const router = useReadContract({ address: VAULT, abi: vaultRouterAbi, functionName: "router", query: { enabled: !!address } });
  const routerAddr = router.data as `0x${string}` | undefined;
  const musdcAllow = useReadContract({ address: MUSDC, abi: erc20Abi, functionName: "allowance", args: [address!, routerAddr!], query: { enabled: !!address && !!routerAddr } });

  useEffect(() => {
    if (wrap.isSuccess || appr.isSuccess) {
      wbnb.refetch();
      musdc.refetch();
      allow.refetch();
      bnb.refetch();
    }
    if (unwrap.isSuccess || rAppr.isSuccess || rSwap.isSuccess) {
      wbnb.refetch();
      musdc.refetch();
      musdcAllow.refetch();
      bnb.refetch();
    }
  }, [wrap.isSuccess, appr.isSuccess, unwrap.isSuccess, rAppr.isSuccess, rSwap.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const readyTx = (allow.data ?? 0n) > 0n && (wbnb.data ?? 0n) > 0n;

  useEffect(() => {
    const initData = telegramInitData();
    if (!API_URL || !address || !initData) return;
    setLinkStatus("linking");
    setLinkError(null);
    dlog(`link-wallet: POST ${API_URL}/api/link-wallet wallet=${address}`);
    fetch(`${API_URL}/api/link-wallet`, {
      method: "POST",
      headers: apiHeaders({ "content-type": "application/json" }),
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
  const doUnwrap = (amt: string) => {
    try {
      unwrap.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "withdraw", args: [parseEther(amt)] });
    } catch {
      tg()?.showAlert("Nominal salah. Contoh: 0.001");
    }
  };
  const doApproveMusdc = (amt: string) => {
    if (!routerAddr) return;
    try {
      rAppr.writeContract({ address: MUSDC, abi: erc20Abi, functionName: "approve", args: [routerAddr, parseEther(amt)] });
    } catch {
      tg()?.showAlert("Nominal salah. Contoh: 0.05");
    }
  };
  const doReverseSwap = (amt: string, minOut: bigint) => {
    if (!routerAddr || !address) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);
    rSwap.writeContract({ address: routerAddr, abi: pancakeRouterAbi, functionName: "swapExactTokensForTokens", args: [parseEther(amt), minOut, [MUSDC, WBNB], address, deadline] });
  };
  const doRevoke = () => appr.writeContract({ address: WBNB, abi: wbnbAbi, functionName: "approve", args: [VAULT, 0n] });

  // Logout harus memutus DUA sesi: konektor wagmi (yang menggerakkan `address`
  // dan seluruh UI) + sesi Privy. Tanpa disconnect, address bertahan dan UI
  // terlihat tidak berubah ("logout tidak berfungsi").
  const handleLogout = () => {
    dlog("logout: tap Keluar");
    try {
      disconnect();
    } catch (e) {
      dlog(`logout: disconnect gagal (${e instanceof Error ? e.message : "?"})`);
    }
    logout().catch((e) => dlog(`logout: privy gagal (${e instanceof Error ? e.message : "?"})`));
    if (connectTimer.current) clearTimeout(connectTimer.current);
    setConnecting(false);
    setConnectError(null);
    setLinkStatus("idle");
    setLinkError(null);
    activatedRef.current = "";
    prevWallet.current = "";
    dlog("logout: state lokal direset");
  };

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
            {!tele && (
              <p className="muted">Aktifkan satu extension dompet (MetaMask ATAU Rabby) agar tidak konflik.</p>
            )}
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
              onLogout={handleLogout}
            />
            {tele && (
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
              <WrapCard tx={wrap} onWrap={doWrap} max={bnb.data?.value} complete={(wbnb.data ?? 0n) > 0n} />
              <ApproveCard tx={appr} onApprove={doApprove} onRevoke={doRevoke} max={wbnb.data as bigint | undefined} complete={(allow.data ?? 0n) > 0n} />
              <AlarmCard ready={readyTx} />
            </div>
            <div className="setup-flow" aria-label="Tukar balik">
              <div className="flow-label">Tukar balik</div>
              <UnwrapCard tx={unwrap} onUnwrap={doUnwrap} max={wbnb.data as bigint | undefined} complete={false} />
              <ReverseSwapCard appr={rAppr} swap={rSwap} router={routerAddr} allowance={musdcAllow.data as bigint | undefined} max={musdc.data as bigint | undefined} onApprove={doApproveMusdc} onSwap={doReverseSwap} />
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
