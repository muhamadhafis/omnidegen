import { useEffect, useState } from "react";
import { API_URL, apiHeaders, SCAN_TX } from "../config";
import { inTelegram, shortAddr } from "../telegram";
import Button from "./ui/Button";
import Surface from "./ui/Surface";
import { X } from "lucide-react";

type Strategy = {
  id: number;
  intent_type: string;
  asset_to_monitor: string;
  action_asset: string;
  trigger_price: number;
  status: string;
  user_wallet: string;
  tx_hash?: string | null;
};

export default function StrategyCard({ initData }: { initData: string }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [history, setHistory] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    if (!API_URL || !initData) {
      setStrategies([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (!res.ok) throw new Error("Gagal memuat strategi");
      const data = await res.json();
      setStrategies(data.intents ?? []);
      const resH = await fetch(`${API_URL}/api/history`, {
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (resH.ok) {
        const dh = await resH.json();
        setHistory(((dh.items ?? []) as Strategy[]).filter((s) => s.status !== "active"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, [initData]);

  const cancelStrategy = async (id: number) => {
    if (!API_URL || !initData) return;
    try {
      const res = await fetch(`${API_URL}/api/intents/${id}/cancel`, {
        method: "POST",
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (!res.ok) throw new Error("Gagal membatalkan");
      await fetchStrategies();
    } catch (e) {
      console.error(e);
    }
  };

  if (!inTelegram()) return null;

  return (
    <Surface className="strategy-card" aria-label="Strategi aktif">
      <div className="flow-label">Strategi aktif</div>
      {loading && <p className="muted">Memuat…</p>}
      {error && <p className="err">{error}</p>}
      {!loading && !error && strategies.length === 0 && (
        <p className="muted">Belum ada strategi aktif. Kirim perintah via Telegram.</p>
      )}
      {!loading && !error && strategies.length > 0 && (
        <ul className="strategy-list">
          {strategies.map((s) => (
            <li key={s.id} className="strategy-item">
              <div className="strategy-info">
                <span className="strategy-type">{s.intent_type}</span>
                <span className="strategy-detail">
                  {s.asset_to_monitor} → {s.action_asset} @ ${s.trigger_price}
                </span>
                <span className="strategy-detail">Dompet {shortAddr(s.user_wallet)}</span>
                {s.tx_hash && /^0x[0-9a-fA-F]{64}$/.test(s.tx_hash) && (
                  <a className="tx" href={SCAN_TX(s.tx_hash)} target="_blank" rel="noreferrer">
                    Lihat Tx ↗
                  </a>
                )}
                <span className={`strategy-status ${s.status}`}>{s.status}</span>
              </div>
              {s.status === "active" && (
                <Button
                  variant="ghost"
                  onClick={() => cancelStrategy(s.id)}
                  aria-label={`Batalkan strategi ${s.id}`}
                >
                  <X size={14} strokeWidth={2} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && history.length > 0 && (
        <>
          <div className="flow-label">Riwayat</div>
          <ul className="strategy-list">
            {history.map((s) => (
              <li key={s.id} className="strategy-item">
                <div className="strategy-info">
                  <span className="strategy-type">{s.intent_type}</span>
                  <span className="strategy-detail">
                    {s.asset_to_monitor} → {s.action_asset} @ ${s.trigger_price}
                  </span>
                  <span className="strategy-detail">Dompet {shortAddr(s.user_wallet)}</span>
                  {s.tx_hash && /^0x[0-9a-fA-F]{64}$/.test(s.tx_hash) && (
                    <a className="tx" href={SCAN_TX(s.tx_hash)} target="_blank" rel="noreferrer">
                      Lihat Tx ↗
                    </a>
                  )}
                  <span className={`strategy-status ${s.status}`}>{s.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Surface>
  );
}