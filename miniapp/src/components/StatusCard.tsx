import type { ReactNode } from "react";
import { shortAddr } from "../telegram";
import { fmtBnb, fmtToken } from "../lib/format";
import { InfoTooltip } from "./ui/tooltip";
import { Clipboard, LogOut } from "lucide-react";
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

function UsdcMark({ size = 16 }: { size?: number }) {
  // Mark USDC resmi (sumber: bnb-chain/wallet-assets; mUSDC adalah tiruannya):
  // busur + $ putih dijadikan currentColor, lingkaran biru dibuang.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="currentColor" aria-hidden="true">
      <path d="M39.4469 81.608C39.4469 82.7206 38.5462 83.3564 37.4866 83.0385C22.97 78.4292 12.48 64.8133 12.48 48.7604C12.48 32.7074 23.023 19.0915 37.4866 14.4822C38.5992 14.1643 39.4469 14.8001 39.4469 15.9127V18.7206C39.4469 19.4624 38.8641 20.363 38.1224 20.6279C26.6787 24.7604 18.4667 35.7802 18.4667 48.7074C18.4667 61.6345 26.6787 72.6544 38.1753 76.8928C38.8641 77.1577 39.4998 78.0054 39.4998 78.8001V81.608H39.4469Z" />
      <path d="M51.1128 70.5166C51.1128 71.3642 50.424 72 49.6293 72H46.6624C45.8147 72 45.179 71.3113 45.179 70.5166V65.7483C38.6094 64.8477 35.4306 61.1921 34.583 56.2119C34.424 55.3642 35.1128 54.5695 35.9604 54.5695H39.3512C40.0399 54.5695 40.6757 55.0993 40.8346 55.7881C41.4704 58.755 43.1657 61.0331 48.4637 61.0331C52.3313 61.0331 55.0863 58.8609 55.0863 55.6291C55.0863 52.3974 53.4439 51.1788 47.775 50.2252C39.3512 49.1656 35.3777 46.6225 35.3777 40C35.3777 34.9139 39.1922 30.9934 45.179 30.1457V25.4834C45.179 24.6358 45.8677 24 46.6624 24H49.6293C50.477 24 51.1128 24.6887 51.1128 25.4834V30.2517C55.9339 31.0993 59.0068 33.8543 60.0134 38.4106C60.2253 39.2583 59.5366 40.106 58.6359 40.106H55.4571C54.7684 40.106 54.2386 39.6291 54.0267 38.9934C53.179 36.0795 51.1128 34.8609 47.5101 34.8609C43.5366 34.8609 41.4704 36.7682 41.4704 39.4702C41.4704 42.3311 42.6359 43.7616 48.7286 44.6093C56.9935 45.7219 61.232 48.106 61.232 55.0993C61.232 60.4503 57.2584 64.7417 51.1128 65.7483V70.5166Z" />
      <path d="M58.6533 83.1107C57.5407 83.4286 56.693 82.7928 56.693 81.6803V78.8723C56.693 78.0246 57.2228 77.2829 58.0175 76.965C69.5142 72.7266 77.7261 61.7067 77.7261 48.7796C77.7261 35.8524 69.4612 24.8855 57.9645 20.6471C57.2758 20.3822 56.64 19.5346 56.64 18.7399V15.9319C56.64 14.8193 57.5407 14.1306 58.6003 14.5014C73.1168 19.1107 83.6069 32.7266 83.6069 48.7796C83.6599 64.8326 73.1698 78.4485 58.6533 83.1107Z" />
    </svg>
  );
}

function BnbMark({ size = 16 }: { size?: number }) {
  // Mark BNB resmi (sumber: bnb-chain/wallet-assets), currentColor = abu muted.
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="currentColor" aria-hidden="true">
      <path d="M34.5355 42.4676L48.0002 29.0032L61.4717 42.4747L69.3063 34.6397L48.0002 13.3333L26.7007 34.6328L34.5355 42.4676ZM21.1683 40.1646L29.003 47.9993L21.1679 55.8344L13.3333 47.9997L21.1683 40.1646ZM34.5355 53.5322L48.0002 66.9962L61.4714 53.5254L69.3105 61.3562L69.3063 61.3602L48.0002 82.6666L26.7004 61.3672L26.6895 61.3564L34.5355 53.5322ZM82.6674 48.0007L74.8327 55.8353L66.9981 48.0007L74.8327 40.166L82.6674 48.0007Z" />
      <path d="M55.9466 47.996H55.9502L47.9999 40.0456L40.0457 47.9998L40.0565 48.0109L47.9999 55.9543L55.9539 47.9998L55.9466 47.996Z" />
    </svg>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="metric metric-tight mx-0.5">
      <span className="label token-label">{icon}{label}</span>
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
          <code translate="no">{shortAddr(address)}</code>
        </div>
        <span className="addr-actions">
          <button type="button" className="icon-button" onClick={onCopy} aria-label="Salin alamat wallet" title="Salin alamat wallet">
            <Clipboard aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
          <button type="button" className="icon-button" onClick={onLogout} aria-label="Keluar dari wallet" title="Keluar dari wallet">
            <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </span>
      </div>
      <div className="primary-balance">
        <strong>{fmtBnb(bnb)} <small>BNB</small></strong>
      </div>
      <div className="">
        <Metric label="WBNB" value={fmtToken(wbnb)} icon={<BnbMark />} />
        <Metric label="mUSDC" value={fmtToken(musdc)} icon={<UsdcMark />} />
      </div>
      <div className="metric">
        <span className="label flex items-center">Izin ke vault <InfoTooltip>Allowance adalah batas maksimum WBNB yang boleh ditarik vault.</InfoTooltip></span>
        <span className="value">{fmtToken(allowance)} WBNB</span>
      </div>
      <div className={`${ready ? "is-ready" : "is-pending"}`} aria-live="polite">
        <StatusBadge ready={ready} />
        <InfoTooltip>{ready ? "Vault dapat bekerja sesuai izin yang kamu berikan." : "Wrap WBNB lalu beri izin ke vault untuk mengaktifkan rescue."}</InfoTooltip>
      </div>
    </Surface>
  );
}
