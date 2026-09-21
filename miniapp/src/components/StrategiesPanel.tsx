import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { API_URL, apiHeaders } from "../config";
import { inTelegram, shortAddr } from "../telegram";
import { flushTxOutbox } from "../lib/txlog";
import Button from "./ui/Button";
import Surface from "./ui/Surface";
import TxLink from "./ui/TxLink";
import { Activity, History, Receipt, X } from "lucide-react";

type Strategy = {
  id: number;
  intent_type: string;
  asset_to_monitor: string;
  action_asset: string;
  trigger_price: number;
  status: string;
  user_wallet: string;
  tx_hash?: string | null;
  created_at?: string;
};

type TxItem = {
  id: number;
  kind: string;
  amount: string;
  token: string;
  tx_hash: string;
  status: string;
  created_at: string;
};

type PanelTab = "active" | "history" | "txs";

const KIND_LABEL: Record<string, string> = {
  wrap: "Wrap BNB",
  unwrap: "Unwrap WBNB",
  approve: "Approve",
  revoke: "Cabut izin",
  swap: "Tukar mUSDC→WBNB",
};

const STATUS_CLASS: Record<string, string> = {
  submitted: "tx-submitted",
  success: "tx-success",
  failed: "tx-failed",
};

function StrategyItem({ s, onCancel }: { s: Strategy; onCancel?: (id: number) => void }) {
  return (
    <li className="strategy-item">
      <div className="strategy-info">
        <span className="strategy-type">{s.intent_type}</span>
        <span className="strategy-detail">
          {s.asset_to_monitor} → {s.action_asset} @ ${s.trigger_price}
        </span>
        <span className="strategy-detail">Dompet {shortAddr(s.user_wallet)}</span>
        <span className="strategy-detail">{(s.created_at ?? "").slice(0, 16)}</span>
        <TxLink hash={s.tx_hash} />
        <span className={`strategy-status ${s.status}`}>{s.status}</span>
      </div>
      {s.status === "active" && onCancel && (
        <Button
          variant="destructive"
          onClick={() => onCancel(s.id)}
          aria-label={`Batalkan strategi ${s.id}`}
        >
          <X size={14} strokeWidth={2} />
        </Button>
      )}
    </li>
  );
}

function TxRow({ t }: { t: TxItem }) {
  return (
    <li className="strategy-item">
      <div className="strategy-info">
        <span className="strategy-type">{KIND_LABEL[t.kind] ?? t.kind}</span>
        <span className="strategy-detail">
          {t.amount} {t.token}
        </span>
        <span className="strategy-detail">{(t.created_at ?? "").slice(0, 16)}</span>
        <TxLink hash={t.tx_hash} />
        <span className={STATUS_CLASS[t.status] ?? "tx-submitted"}>{t.status}</span>
      </div>
    </li>
  );
}

export default function StrategiesPanel({ initData }: { initData: string }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [history, setHistory] = useState<Strategy[]>([]);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("active");

  const fetchAll = async () => {
    if (!API_URL || !initData) {
      setStrategies([]);
      setHistory([]);
      setTxs([]);
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
      const resH = await fetch(`${API_URL}/api/history?limit=100`, {
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (resH.ok) {
        const dh = await resH.json();
        setHistory(((dh.items ?? []) as Strategy[]).filter((s) => s.status !== "active"));
      }
      const resT = await fetch(`${API_URL}/api/txs?limit=20`, {
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (resT.ok) {
        const dt = await resT.json();
        setTxs(dt.items ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    void flushTxOutbox(); // kirim ulang laporan Tx yang sempat gagal jaringan
  }, [initData]); // eslint-disable-line react-hooks/exhaustive-deps

  // refresh otomatis saat Tx dompet baru dilaporkan (tokenTabs → txlog):
  // langsung (status submitted terlihat seketika) + sekali lagi 15 dtk kemudian
  // (menangkap konfirmasi success/failed tanpa aksi user).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onTx = () => {
      fetchAll();
      if (t) clearTimeout(t);
      t = setTimeout(fetchAll, 15_000);
    };
    window.addEventListener("Omnidegen:tx", onTx);
    return () => {
      window.removeEventListener("Omnidegen:tx", onTx);
      if (t) clearTimeout(t);
    };
  }, [initData]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelStrategy = async (id: number) => {
    if (!API_URL || !initData) return;
    try {
      const res = await fetch(`${API_URL}/api/intents/${id}/cancel`, {
        method: "POST",
        headers: apiHeaders({ "x-telegram-init-data": initData }),
      });
      if (!res.ok) throw new Error("Gagal membatalkan");
      await fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  if (!inTelegram()) return null;

  return (
    <Surface className="strategy-card" aria-label="Strategi dan riwayat">
      {loading && <p className="muted">Memuat…</p>}
      {error && <p className="err">{error}</p>}
      {!loading && !error && (
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as PanelTab)}>
          <Tabs.List className="panel-tabs" aria-label="Strategi dan riwayat">
            <Tabs.Trigger value="active" className="tab-trigger" aria-label={`Aktif (${strategies.length})`} title="Aktif">
              <Activity aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className="tab-count">({strategies.length})</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="history" className="tab-trigger" aria-label={`Riwayat (${history.length})`} title="Riwayat">
              <History aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className="tab-count">({history.length})</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="txs" className="tab-trigger" aria-label={`Transaksi (${txs.length})`} title="Transaksi">
              <Receipt aria-hidden="true" size={18} strokeWidth={1.8} />
              <span className="tab-count">({txs.length})</span>
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="active">
            {strategies.length === 0 ? (
              <p className="muted">Belum ada strategi aktif. Kirim perintah via Telegram.</p>
            ) : (
              <ul className="strategy-list">
                {strategies.map((s) => (
                  <StrategyItem key={s.id} s={s} onCancel={cancelStrategy} />
                ))}
              </ul>
            )}
          </Tabs.Content>
          <Tabs.Content value="history">
            {history.length === 0 ? (
              <p className="muted">Belum ada riwayat strategi.</p>
            ) : (
              <ul className="strategy-list">
                {history.map((s) => (
                  <StrategyItem key={s.id} s={s} />
                ))}
              </ul>
            )}
          </Tabs.Content>
          <Tabs.Content value="txs">
            {txs.length === 0 ? (
              <p className="muted">Belum ada transaksi dompet tercatat.</p>
            ) : (
              <ul className="strategy-list">
                {txs.map((t) => (
                  <TxRow key={t.id} t={t} />
                ))}
              </ul>
            )}
          </Tabs.Content>
        </Tabs.Root>
      )}
    </Surface>
  );
}
