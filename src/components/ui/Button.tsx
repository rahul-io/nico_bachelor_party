import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary font-semibold",
  secondary: "bg-raised text-ink border border-line font-medium",
  ghost: "text-muted font-medium",
  danger: "bg-raised text-danger border border-line font-medium",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = "secondary", block, className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-tap items-center justify-center gap-2 rounded-control px-4 text-base",
        "transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
