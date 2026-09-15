import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";

export function InfoTooltip({ children }: { children: string }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" aria-label="Lihat informasi">
          <Info aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content sideOffset={8} collisionPadding={12} className={cn("z-50 w-[min(280px,calc(100vw-24px))] rounded-md border border-border bg-[#1a1a1a] p-3 text-xs leading-snug text-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95")}>
          {children}
          <PopoverPrimitive.Arrow className="fill-[#1a1a1a]" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
