import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

type Props = ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabel?: string; // bubble persen menempel di atas thumb (aria-hidden; nilai dibacakan thumb)
};

export default function Slider({ className = "", thumbLabel, min = 0, max = 100, value, ...props }: Props) {
  const v = Array.isArray(value) ? value[0] ?? min : min;
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center pb-2 pt-7", className)}
      min={min}
      max={max}
      value={value}
      {...props}
    >
      {thumbLabel !== undefined && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 rounded-md border border-line bg-card px-2 py-0.5 font-sans text-gray-500 text-[11px]"
          style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}
        >
          {thumbLabel}
        </span>
      )}
      {/* antislop: range emas = satu aksen yang disengaja; nilai selalu ada sebagai teks % + input */}
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label="Persentase jumlah"
        className="relative block h-5 w-5 rounded-full border-2 border-amber-400 bg-card shadow before:absolute before:-inset-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
}
