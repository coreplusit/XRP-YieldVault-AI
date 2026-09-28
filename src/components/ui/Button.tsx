import { forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

/** Visual variants for the Button component. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

/** Size presets for the Button component. */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-xrpl-teal text-xrpl-black hover:bg-xrpl-cyan focus-visible:ring-xrpl-teal",
  secondary:
    "bg-xrpl-navy text-white hover:bg-xrpl-black focus-visible:ring-xrpl-cyan",
  outline:
    "border border-xrpl-teal/40 bg-transparent text-xrpl-teal hover:bg-xrpl-teal/10",
  ghost: "bg-transparent text-xrpl-muted hover:text-white hover:bg-white/5",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * Primary interactive button primitive used across the application.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-xrpl-black",
          "disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);
