/**
 * MetricStrip — Enterprise Operations component (Web / Next.js)
 *
 * Horizontal strip of key operational metrics for dashboards and section headers.
 * Answers: "What is the system state right now?"
 *
 * Usage:
 *   <MetricStrip
 *     metrics={[
 *       { label: 'Active Shipments', value: 42 },
 *       { label: 'Pending Pickup', value: 8, variant: 'warning' },
 *       { label: 'Delivered Today', value: 15, variant: 'success' },
 *     ]}
 *   />
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export type MetricVariant = "default" | "success" | "warning" | "error" | "info"

export interface MetricItem {
  /** Short label */
  label: string
  /** Numeric or string value */
  value: string | number
  /** Color variant for the value */
  variant?: MetricVariant
  /** Unit suffix (e.g. "mi", "%") */
  suffix?: string
}

interface MetricStripProps {
  metrics: MetricItem[]
  className?: string
}

const valueColorMap: Record<MetricVariant, string> = {
  default: "text-foreground",
  success: "text-[hsl(145,63%,35%)]",
  warning: "text-[hsl(28,80%,40%)]",
  error: "text-[hsl(4,70%,40%)]",
  info: "text-[hsl(198,80%,35%)]",
}

export function MetricStrip({ metrics, className }: MetricStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch border-b border-border bg-card",
        className
      )}
    >
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.label}>
          {index > 0 && (
            <div className="w-px self-stretch bg-border my-2" />
          )}
          <div className="flex-1 min-w-[120px] flex flex-col items-center justify-center px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {metric.label}
            </span>
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                valueColorMap[metric.variant || "default"]
              )}
            >
              {metric.value}
              {metric.suffix && (
                <span className="text-sm font-normal text-muted-foreground ml-0.5">
                  {metric.suffix}
                </span>
              )}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default MetricStrip
