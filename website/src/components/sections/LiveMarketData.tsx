'use client'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { MetricStrip } from '@/components/ui/MetricStrip'

const marketData = [
  { route: 'Charlotte → Raleigh', loads: 12, avgRate: '$385', trend: 'up' as const, change: 'Active' },
  { route: 'Charlotte → Atlanta', loads: 8, avgRate: '$520', trend: 'up' as const, change: 'Active' },
  { route: 'Raleigh → Richmond', loads: 5, avgRate: '$310', trend: 'up' as const, change: 'Active' },
  { route: 'Charlotte → Nashville', loads: 4, avgRate: '$610', trend: 'up' as const, change: 'Active' },
]

export default function LiveMarketData() {
  return (
    <section className="border-b border-border bg-white">
      {/* Section Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          Charlotte/Carolina Routes
        </h2>
        <StatusBadge variant="success" label="Live" size="sm" />
      </div>

      {/* Market Metrics */}
      <MetricStrip
        metrics={[
          { label: 'Active Routes', value: 4 },
          { label: 'Avg Load Rate', value: '$456' },
          { label: 'Avg Response', value: '< 2 hrs', variant: 'info' },
        ]}
      />

      {/* Market Routes Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-6 py-2.5">
                Route
              </th>
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-6 py-2.5">
                Available
              </th>
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-6 py-2.5">
                Avg Rate
              </th>
              <th className="text-left text-xs font-semibold text-foreground uppercase tracking-wider px-6 py-2.5">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {marketData.map((market, i) => (
              <tr
                key={market.route}
                className={`border-b border-border last:border-0 ${
                  market.trend === 'down'
                    ? 'bg-[hsl(var(--status-warning-bg))]'
                    : i % 2 !== 0
                      ? 'bg-muted/20'
                      : ''
                }`}
              >
                <td className="px-6 py-2.5 font-medium text-foreground">
                  {market.route}
                </td>
                <td className="px-6 py-2.5 tabular-nums text-foreground">
                  {market.loads}
                </td>
                <td className="px-6 py-2.5 font-semibold text-foreground tabular-nums">
                  {market.avgRate}
                </td>
                <td className="px-6 py-2.5">
                  <StatusBadge
                    variant={market.trend === 'up' ? 'success' : 'warning'}
                    label={market.change}
                    size="sm"
                    dot={false}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
