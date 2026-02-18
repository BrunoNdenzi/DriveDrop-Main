/**
 * DataTable — Enterprise Operations component (Web / Next.js)
 *
 * Dense, scannable table for operational data.
 * Supports sortable columns, row click handlers, and custom cell renderers.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'id', title: 'ID', width: '80px' },
 *       { key: 'status', title: 'Status', render: (row) => <StatusBadge status={row.status} /> },
 *       { key: 'origin', title: 'Origin' },
 *     ]}
 *     data={shipments}
 *     keyExtractor={(row) => row.id}
 *     onRowClick={(row) => router.push(`/shipments/${row.id}`)}
 *   />
 */
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  /** Unique key matching a property on the data item */
  key: string
  /** Column header text */
  title: string
  /** CSS width (e.g. '80px', '20%') */
  width?: string
  /** Text alignment */
  align?: "left" | "center" | "right"
  /** Custom cell renderer */
  render?: (item: T, index: number) => React.ReactNode
  /** Whether this column is sortable */
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyExtractor: (item: T, index: number) => string
  onRowClick?: (item: T, index: number) => void
  /** Highlight predicate */
  isRowHighlighted?: (item: T) => boolean
  emptyMessage?: string
  className?: string
  /** Show row index */
  showIndex?: boolean
  /** Current sort state */
  sortKey?: string
  sortDirection?: "asc" | "desc"
  onSort?: (key: string) => void
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  isRowHighlighted,
  emptyMessage = "No data",
  className,
  showIndex = false,
  sortKey,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  const alignClass = (align?: string) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

  return (
    <div
      className={cn(
        "w-full overflow-auto rounded border border-border bg-card",
        className
      )}
    >
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {showIndex && (
              <th className="w-10 px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                #
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                  alignClass(col.align),
                  col.sortable && "cursor-pointer select-none hover:text-foreground"
                )}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.title}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-foreground">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showIndex ? 1 : 0)}
                className="px-3 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item, index)}
                className={cn(
                  "border-b border-border transition-colors",
                  index % 2 === 0 ? "bg-card" : "bg-muted/20",
                  onRowClick && "cursor-pointer hover:bg-muted/40",
                  isRowHighlighted?.(item) && "bg-blue-50 dark:bg-blue-950/20"
                )}
                onClick={onRowClick ? () => onRowClick(item, index) : undefined}
              >
                {showIndex && (
                  <td className="w-10 px-3 py-2 text-center text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-2", alignClass(col.align))}
                  >
                    {col.render
                      ? col.render(item, index)
                      : (
                        <span className="text-sm text-foreground">
                          {item[col.key] != null ? String(item[col.key]) : "—"}
                        </span>
                      )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
