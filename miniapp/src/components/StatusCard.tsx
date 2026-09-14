import { shortAddr } from "../telegram";
import { fmtBnb, fmtToken } from "../lib/format";
import Icon from "./Icon";
import { InfoTooltip } from "./ui/tooltip";
import Surface from "./ui/Surface";
import StatusBadge from "./ui/StatusBadge";

type Props = {
  address: `0x${string}`;
  bnb: bigint | undefined;
  wbnb: bigint | undefined;
  musdc: bigint | undefined;
  allowance: bigint | undefined;
  onCopy: () => void;
  onLogout: () => void;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric mx-0.5">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}

export default function StatusCard({ address, bnb, wbnb, musdc, allowance, onCopy, onLogout }: Props) {
  const ready = (allowance ?? 0n) > 0n && (wbnb ?? 0n) > 0n;

  return (
    <Surface className="status-card" aria-label="Ringkasan dompet">
      <div className="wallet-header">
        <div>
          <span className="eyebrow">Dompet terhubung</span>
          <code translate="no">{shortAddr(address)}</code>
        </div>
        <span className="addr-actions">
          <button type="button" className="icon-button" onClick={onCopy} aria-label="Salin alamat wallet" title="Salin alamat wallet">
            <Icon name="copy" />
          </button>
          <button type="button" className="icon-button" onClick={onLogout} aria-label="Keluar dari wallet" title="Keluar dari wallet">
            <Icon name="logout" />
          </button>
        </span>
      </div>
      <div className="primary-balance">
        <span className="eyebrow">Saldo BNB</span>
        <strong>{fmtBnb(bnb)} <small>BNB</small></strong>
      </div>
      <div className="metric-grid">
        <Metric label="WBNB" value={fmtToken(wbnb)} />
        <Metric label="mUSDC" value={fmtToken(musdc)} />
      </div>
      <div className="metric metric-with-help">
        <span className="label">Izin ke vault <InfoTooltip>Allowance adalah batas maksimum WBNB yang boleh ditarik vault.</InfoTooltip></span>
        <span className="value">{fmtToken(allowance)} WBNB</span>
      </div>
      <div className={`readiness ${ready ? "is-ready" : "is-pending"}`} aria-live="polite">
        <StatusBadge ready={ready} />
        <InfoTooltip>{ready ? "Vault dapat bekerja sesuai izin yang kamu berikan." : "Wrap WBNB lalu beri izin ke vault untuk mengaktifkan rescue."}</InfoTooltip>
      </div>
    </Surface>
  );
}
