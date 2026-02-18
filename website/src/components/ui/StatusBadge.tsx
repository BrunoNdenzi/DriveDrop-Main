/**
 * StatusBadge — Enterprise Operations component (Web / Next.js)
 *
 * Renders a compact, state-driven badge for shipment or entity status.
 * Uses Tailwind CSS + CSS custom property status tokens.
 *
 * Usage:
 *   <StatusBadge status="in_transit" />
 *   <StatusBadge variant="success" label="Paid" />
 *   <StatusBadge status="cancelled" size="sm" />
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Shipment lifecycle status → variant mapping
const statusToVariant: Record<string, string> = {
  pending: "warning",
  quote_pending: "warning",
  accepted: "info",
  assigned: "info",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  completed: "success",
  cancelled: "error",
  failed: "error",
  draft: "neutral",
  expired: "neutral",
}

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 border text-xs font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "bg-[hsl(var(--status-success-bg))] text-[hsl(145,63%,30%)] border-[hsl(145,63%,42%/0.3)]",
        warning:
          "bg-[hsl(var(--status-warning-bg))] text-[hsl(28,80%,30%)] border-[hsl(28,97%,50%/0.3)]",
        error:
          "bg-[hsl(var(--status-error-bg))] text-[hsl(4,70%,30%)] border-[hsl(4,90%,58%/0.3)]",
        info:
          "bg-[hsl(var(--status-info-bg))] text-[hsl(198,80%,30%)] border-[hsl(198,93%,48%/0.3)]",
        neutral:
          "bg-[hsl(var(--status-neutral-bg))] text-[hsl(210,10%,40%)] border-[hsl(210,20%,80%)]",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px] rounded-sm",
        default: "px-2 py-1 rounded",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
)

// Dot color mapping per variant
const dotColors: Record<string, string> = {
  success: "bg-[hsl(145,63%,42%)]",
  warning: "bg-[hsl(28,97%,50%)]",
  error: "bg-[hsl(4,90%,58%)]",
  info: "bg-[hsl(198,93%,48%)]",
  neutral: "bg-[hsl(210,10%,55%)]",
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Shipment lifecycle status key — auto-maps to variant */
  status?: string
  /** Custom label text. Defaults to formatted status string. */
  label?: string
  /** Show colored dot indicator */
  dot?: boolean
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, variant, label, dot = true, size, ...props }, ref) => {
    // Resolve variant from status key if not explicitly provided
    const resolvedVariant =
      variant || (status ? (statusToVariant[status] as any) : undefined) || "neutral"

    const displayLabel = label || (status ? formatStatusLabel(status) : "Unknown")

    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant: resolvedVariant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              dotColors[resolvedVariant] || dotColors.neutral
            )}
          />
        )}
        {displayLabel}
      </span>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, badgeVariants }
