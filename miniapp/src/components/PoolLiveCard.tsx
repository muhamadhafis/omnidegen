import { useEffect } from "react";
import { useBlockNumber, useReadContract } from "wagmi";
import { MUSDC, WBNB } from "../config";
import { pancakeFactoryAbi, pancakePairAbi, pancakeRouterAbi } from "../abi";
import { InfoTooltip } from "./ui/tooltip";
import Surface from "./ui/Surface";

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const ratio6 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

export default function PoolLiveCard({ router }: { router: `0x${string}` | undefined }) {
  const { data: blockNumber } = useBlockNumber({ watch: true, query: { enabled: !!router } });
  const factory = useReadContract({ address: router, abi: pancakeRouterAbi, functionName: "factory", query: { enabled: !!router } });
  const factoryAddr = factory.data as `0x${string}` | undefined;
  const pair = useReadContract({ address: factoryAddr, abi: pancakeFactoryAbi, functionName: "getPair", args: [WBNB, MUSDC], query: { enabled: !!factoryAddr } });
  const pairAddr = pair.data as `0x${string}` | undefined;
  const pairOk = !!pairAddr && pairAddr !== ZERO;
  const reserves = useReadContract({ address: pairAddr, abi: pancakePairAbi, functionName: "getReserves", query: { enabled: pairOk } });
  const t0 = useReadContract({ address: pairAddr, abi: pancakePairAbi, functionName: "token0", query: { enabled: pairOk } });

  useEffect(() => {
    if (blockNumber !== undefined) {
      factory.refetch();
      pair.refetch();
      reserves.refetch();
      t0.refetch();
    }
  }, [blockNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const t0Addr = t0.data as `0x${string}` | undefined;
  const r0 = reserves.data?.[0] as bigint | undefined;
  const r1 = reserves.data?.[1] as bigint | undefined;
  const ready = pairOk && r0 !== undefined && r1 !== undefined && t0Addr !== undefined;
  const rW = ready ? (t0Addr!.toLowerCase() === WBNB.toLowerCase() ? r0! : r1!) : 0n;
  const rM = ready ? (t0Addr!.toLowerCase() === WBNB.toLowerCase() ? r1! : r0!) : 0n;
  const spot = ready && rW > 0n ? Number(rM) / Number(rW) : 0;

  return (
    <Surface className="status-card" aria-label="Kurs pool live">
      <div className="wallet-header">
        <div>
          <span className="eyebrow">WBNB/MUSDC</span>
          <span className="value">{!ready || spot <= 0 ? "…" : usd.format(spot)}</span>
          <InfoTooltip>Kurs pool Pancake (mUSDC ≈ $1), diperbarui tiap blok. Bukan harga trigger strategi.</InfoTooltip>
        </div>
      </div>
      <div className="metric">
        <span className="label">MUSDC/WBNB</span>
        <span className="value">{!ready || spot <= 0 ? "…" : ratio6.format(1 / spot)}</span>
      </div>
      <div className="metric">
        <span className="label">Blok</span>
        <span className="value">{blockNumber === undefined ? "…" : `#${blockNumber.toString()}`}</span>
      </div>
      {!pairOk && pairAddr !== undefined && (
        <p className="err">Pool tak ditemukan.</p>
      )}
    </Surface>
  );
}
