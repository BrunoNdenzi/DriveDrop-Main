/**
 * PageHeader — Enterprise Operations layout component (Web / Next.js)
 *
 * Consistent page-level header with title, optional subtitle, and action slots.
 * Replaces ad-hoc header patterns across admin and dashboard pages.
 *
 * Usage:
 *   <PageHeader title="Shipments" subtitle="12 active" />
 *   <PageHeader
 *     title="Admin Dashboard"
 *     actions={<Button size="sm">Export</Button>}
 *   />
 */
import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional subtitle (count, date, breadcrumb) */
  subtitle?: string
  /** Right-aligned action slot */
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-4 border-b border-border bg-card",
        className
      )}
    >
      <div className="flex-1 min-w-0 mr-4">
        <h1 className="text-xl font-semibold text-foreground tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  )
}

export default PageHeader
