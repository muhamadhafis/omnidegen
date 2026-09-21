import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Popover({ children }: { children: ReactNode }) {
  return <PopoverPrimitive.Root>{children}</PopoverPrimitive.Root>;
}

export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content sideOffset={8} collisionPadding={12} className={cn("z-50 w-[min(280px,calc(100vw-24px))] rounded-md border border-border bg-card p-3 text-sm text-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95", className)}>
          {children}
          <PopoverPrimitive.Arrow className="fill-card" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
