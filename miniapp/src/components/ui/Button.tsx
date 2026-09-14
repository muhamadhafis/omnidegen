import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center rounded-md border px-[13px] py-2.5 text-center text-[15px] font-semibold touch-manipulation transition-[transform,border-color,opacity,filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px", {
  variants: {
    variant: {
      default: "border-border bg-[#1a1a1a] text-foreground hover:border-accent",
      primary: "w-full border-accent bg-accent text-accent-foreground hover:brightness-95",
      ghost: "border-transparent bg-transparent text-foreground hover:border-border",
    },
  },
  defaultVariants: { variant: "default" },
});

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
} & VariantProps<typeof buttonVariants>;

export default function Button({ children, className = "", variant = "default", ...props }: Props) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}
