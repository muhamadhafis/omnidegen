import { fmtToken, formatAmt, parseAmtSafe, pctOf } from "../lib/format";
import Input from "./ui/Input";
import Slider from "./ui/slider";
import Stack from "./ui/Stack";

type Props = {
  id: string;
  label: string;
  symbol: string;
  value: string;
  onChange: (v: string) => void;
  max: bigint | undefined; // saldo acuan persen; undefined = slider/chips nonaktif
};

export default function AmountInput({ id, label, symbol, value, onChange, max }: Props) {
  const parsed = parseAmtSafe(value);
  const pct =
    max === undefined || max <= 0n
      ? 0
      : Math.min(100, Math.max(0, (Number(parsed) / Number(max)) * 100));
  const setPct = (p: number) => {
    if (max === undefined) return;
    onChange(p <= 0 ? "0" : formatAmt(pctOf(max, p)));
  };
  return (
    <Stack className="flex-1" gap={2}>
      <Input
        id={id}
        label={label}
        name={id}
        autoComplete="off"
        spellCheck={false}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
      <div className="amount-meta">
        <span>Saldo: {fmtToken(max)} {symbol}</span>
      </div>
      <Slider
        value={[pct]}
        onValueChange={([p]) => setPct(p)}
        min={0}
        max={100}
        step={1}
        disabled={max === undefined}
        aria-label={`${label} dalam persen`}
        thumbLabel={`${Math.round(pct)}%`}
      />
    </Stack>
  );
}
