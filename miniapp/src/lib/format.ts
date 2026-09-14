import { formatEther } from "viem";

const numFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

// ponytail: satu format angka untuk semua saldo, ganti maximumFractionDigits kalau perlu presisi
export const fmtToken = (v: bigint | undefined) =>
  v === undefined ? "…" : numFmt.format(Number(formatEther(v)));

export const fmtBnb = (v: bigint | undefined, decimals = 18) => {
  if (v === undefined) return "…";
  const raw = decimals === 18 ? Number(formatEther(v)) : Number(v) / 10 ** decimals;
  return numFmt.format(raw);
};
