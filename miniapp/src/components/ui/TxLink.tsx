import { SCAN_TX } from "../../config";
import { ExternalLink } from "lucide-react";

export default function TxLink({ hash }: { hash?: string | null }) {
  // Guard di sini (bukan di pemanggil): hanya hash real 64-hex yang boleh
  // jadi link explorer. Mock/tx-hash kosong me-render null.
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return null;
  return (
    <a className="tx" href={SCAN_TX(hash)} target="_blank" rel="noreferrer">
      Lihat Tx <ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
    </a>
  );
}
