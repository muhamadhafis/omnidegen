import { useEffect } from "react";
import { useAccount, useBalance, useReadContract, useSwitchChain } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { parseEther } from "viem";
import { CHAIN, FAUCET, MUSDC, PRIVY_APP_ID, VAULT, WBNB } from "./config";
import { erc20Abi, wbnbAbi } from "./abi";
import { inTelegram, initTelegram, tg } from "./telegram";
import { useTx } from "./hooks/useTx";
import StatusCard from "./components/StatusCard";
import WrapCard from "./components/WrapCard";
import ApproveCard from "./components/ApproveCard";
import AlarmCard from "./components/AlarmCard";
import { InfoTooltip, TooltipProvider } from "./components/ui/tooltip";
import Button from "./components/ui/Button";
import Notice from "./components/ui/Notice";

export default function App() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { address, chainId } = useAccount();
  const connected = authenticated && !!address;
  const embedded = wallets.some((w) => w.walletClientType === "privy");
  const tele = inTelegram();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  const wrongNet = connected && chainId !== CHAIN.id;

  useEffect(() => {
    if (wrongNet) switchChain({ chainId: CHAIN.id });
  }, [wrongNet]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <TooltipProvider>
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

        {!ready ? (
          <Notice aria-live="polite">
            <p>Siapkan dompet…</p>
          </Notice>
        ) : !connected ? (
          <Notice aria-label="Hubungkan dompet">
            <h2>Mulai</h2>
            <p>Hubungkan dompet untuk mulai. Private key tidak pernah keluar dari HP kamu.</p>
            <Button variant="primary" type="button" onClick={() => login()}>
              Hubungkan Dompet
            </Button>
            <span className="connect-note">
              <InfoTooltip>{tele ? "Ketuk dompetmu, approve di aplikasinya, lalu kembali ke sini." : "Di HP, gunakan MetaMask, Trust Wallet, atau OKX."}</InfoTooltip>
            </span>
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
            <div className="setup-flow" aria-label="Setup rescue">
              <div className="flow-label">Rescue setup</div>
              <WrapCard tx={wrap} embedded={embedded} onWrap={doWrap} complete={(wbnb.data ?? 0n) > 0n} />
              <ApproveCard tx={appr} embedded={embedded} onApprove={doApprove} onRevoke={doRevoke} complete={(allow.data ?? 0n) > 0n} />
              <AlarmCard ready={readyTx} />
            </div>
          </>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}
