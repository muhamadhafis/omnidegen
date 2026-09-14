import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: "default" | "warning";
};

export default function Notice({ children, className = "", tone = "default", ...props }: Props) {
  return (
    <section className={`mb-[var(--space)] min-w-0 rounded-lg border bg-card p-3 ${tone === "warning" ? "border-accent/55" : "border-border"} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
