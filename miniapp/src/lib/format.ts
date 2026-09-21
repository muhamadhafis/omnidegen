import { formatEther, parseEther } from "viem";

const numFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

// ponytail: satu format angka untuk semua saldo, ganti maximumFractionDigits kalau perlu presisi
export const fmtToken = (v: bigint | undefined) =>
  v === undefined ? "…" : numFmt.format(Number(formatEther(v)));

const numFmt8 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8 });

// presisi tinggi untuk estimasi quote kecil (fmtToken membulatkan <0,00005 jadi "0").
export const fmtToken8 = (v: bigint | undefined) =>
  v === undefined ? "…" : numFmt8.format(Number(formatEther(v)));

export const fmtBnb = (v: bigint | undefined, decimals = 18) => {
  if (v === undefined) return "…";
  const raw = decimals === 18 ? Number(formatEther(v)) : Number(v) / 10 ** decimals;
  return numFmt.format(raw);
};

// string kompatibel parseEther: titik desimal, tanpa grouping, tanpa trailing nol,
// tanpa pembulatan (nilai presisi penuh).
export function formatAmt(v: bigint): string {
  const [i, f = ""] = formatEther(v).split(".");
  const frac = f.replace(/0+$/, "");
  return frac ? `${i}.${frac}` : i;
}

// parse aman untuk input ketikan (kosong/invalid → 0n, tak pernah throw).
// Koma desimal ala id-ID diterima dan dinormalisasi ke titik.
export function parseAmtSafe(s: string): bigint {
  try {
    const t = s.trim().replace(",", ".");
    if (!t) return 0n;
    return parseEther(t);
  } catch {
    return 0n;
  }
}

export const pctOf = (balance: bigint, pct: number): bigint =>
  (balance * BigInt(Math.max(0, Math.min(100, Math.round(pct))))) / 100n;
