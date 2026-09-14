import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function Input({ id, label, className = "", ...props }: Props) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5" htmlFor={id}>
      <span className="text-xs text-muted">{label}</span>
      <input id={id} className={cn("min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent", className)} {...props} />
    </label>
  );
}
