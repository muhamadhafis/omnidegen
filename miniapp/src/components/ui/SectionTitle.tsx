import type { ReactNode } from "react";
import { InfoTooltip } from "./tooltip";

export default function SectionTitle({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <h2 className="text-foreground">{children} <InfoTooltip>{tip}</InfoTooltip></h2>
  );
}
