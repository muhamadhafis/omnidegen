import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-center text-[15px] font-semibold touch-manipulation transition-[transform,border-color,opacity,filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px", {
  variants: {
    variant: {
      default: "border-line bg-card text-foreground hover:border-amberink",
      primary: "w-full border-accent bg-accent text-accent-foreground hover:brightness-95",
      ghost: "border-transparent bg-transparent text-foreground hover:border-line",
      destructive: "border-transparent bg-transparent text-danger",
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
