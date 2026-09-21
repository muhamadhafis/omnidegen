import type { ReactNode } from "react";

export default function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setup-flow" aria-label={label}>
      {children}
    </div>
  );
}
