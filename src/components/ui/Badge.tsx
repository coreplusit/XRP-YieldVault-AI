import { cn } from "@/lib/utils/cn";

/** Visual variants for the Badge component. */
export type BadgeVariant = "default" | "success" | "warning" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-xrpl-navy text-xrpl-muted border border-white/10",
  success: "bg-xrpl-teal/15 text-xrpl-teal border border-xrpl-teal/30",
  warning: "bg-xrpl-gold/15 text-xrpl-gold border border-xrpl-gold/30",
  outline: "bg-transparent text-xrpl-muted border border-white/20",
};

/**
 * Compact label primitive for status indicators and metadata tags.
 */
export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
