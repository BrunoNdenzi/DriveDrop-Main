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
        "grid grid-cols-2 items-stretch border border-[#c7d4d2] bg-card md:grid-cols-4",
        className
      )}
    >
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.label}>
          <div className={cn("min-w-0 border-[#d7e1df] px-4 py-4", index > 0 && "border-l", index > 1 && "border-t md:border-t-0")}>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718482]">
              {metric.label}
            </span>
            <span
              className={cn(
                "mt-1 block text-xl font-semibold tabular-nums",
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
