import { Check, Shield } from "lucide-react";

export default function StatusBadge({ ready, label }: { ready: boolean; label?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${ready ? "bg-success text-white" : "bg-muted text-white"}`}>
      {ready ? <Check aria-hidden="true" size={14} strokeWidth={1.8} /> : <Shield aria-hidden="true" size={14} strokeWidth={1.8} />}
      {label ?? (ready ? "Siap rescue" : "Belum siap, wrap + approve dulu")}
    </span>
  );
}
