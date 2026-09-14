import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import Icon from "../Icon";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={120}>{children}</TooltipPrimitive.Provider>;
}

export function InfoTooltip({ children }: { children: string }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label="Lihat informasi">
          <Icon name="info" size={15} />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content sideOffset={8} collisionPadding={12} className={cn("z-50 max-w-[min(240px,calc(100vw-24px))] rounded-md border border-border bg-[#1a1a1a] px-2.5 py-2 text-xs leading-snug text-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95")}>
          {children}
          <TooltipPrimitive.Arrow className="fill-[#1a1a1a]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
