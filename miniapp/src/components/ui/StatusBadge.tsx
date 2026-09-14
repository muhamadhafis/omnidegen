import Icon from "../Icon";

export default function StatusBadge({ ready, label }: { ready: boolean; label?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold ${ready ? "text-success" : "text-accent"}`}>
      <Icon name={ready ? "check" : "shield"} size={14} />
      {label ?? (ready ? "Siap rescue" : "Belum siap")}
    </span>
  );
}
