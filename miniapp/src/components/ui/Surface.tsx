import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export default function Surface({ children, className = "", ...props }: Props) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-card p-3 ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
