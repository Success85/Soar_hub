import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0 min-h-10",
  {
    variants: {
      variant: {
        primary: "bg-navy-900 text-ivory hover:bg-navy-800 shadow-sm",
        gold: "bg-gold-500 text-navy-950 hover:bg-gold-400 shadow-sm",
        secondary: "bg-white text-navy-900 border border-line hover:bg-ivory-200",
        ghost: "text-navy-900 hover:bg-ivory-200",
        danger: "bg-danger-700 text-white hover:bg-red-800",
        link: "text-royal-700 underline-offset-4 hover:underline px-0 min-h-0",
        outlineLight: "border border-ivory/40 text-ivory hover:bg-white/10",
      },
      size: {
        sm: "h-9 px-3 text-[13px] min-h-9",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
