import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const gaps = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4" } as const;

export default function Stack({ direction = "column", gap = 2, className = "", children }: {
  direction?: "row" | "column";
  gap?: keyof typeof gaps;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(direction === "row" ? "flex flex-row" : "flex flex-col", gaps[gap], "min-w-0", className)}>
      {children}
    </div>
  );
}
