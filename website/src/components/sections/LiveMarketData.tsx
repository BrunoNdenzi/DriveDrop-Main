import { ArrowUpRight, Clock3, Map, Route } from '@/components/icons/streamline-lucide'

const marketData = [
  { route: 'Charlotte to Raleigh', loads: 12, avgRate: '$385' },
  { route: 'Charlotte to Atlanta', loads: 8, avgRate: '$520' },
  { route: 'Raleigh to Richmond', loads: 5, avgRate: '$310' },
  { route: 'Charlotte to Nashville', loads: 4, avgRate: '$610' },
]

const metrics = [
  { icon: Route, label: 'Active corridors', value: '4' },
  { icon: Map, label: 'Available loads', value: '29' },
  { icon: Clock3, label: 'Typical response', value: '< 2 hrs' },
]

export default function LiveMarketData() {
  return (
    <section className="border-b border-[#cbd8d6] bg-[#173436] text-white">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(280px,.72fr)_minmax(0,1.28fr)]">
        <div className="border-b border-white/10 px-5 py-14 sm:px-10 lg:border-b-0 lg:border-r lg:px-16 lg:py-20">
          <div className="inline-flex items-center gap-2 border border-[#4c6b69] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#a9cbc7]">
            <span className="h-2 w-2 bg-[#45c59c]" />
            Live market view
          </div>
          <h2 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">Carolina capacity, at a glance.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#b8cecb]">Current operating signals across DriveDrop&apos;s core vehicle transport corridors.</p>

          <dl className="mt-9 grid grid-cols-3 border-y border-white/15 lg:grid-cols-1">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div key={label} className="border-l border-white/15 px-3 py-4 first:border-l-0 lg:flex lg:items-center lg:gap-4 lg:border-l-0 lg:border-t lg:px-0 lg:first:border-t-0">
                <Icon className="hidden h-5 w-5 text-[#5cd6ca] sm:block" />
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8fb5b1]">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="px-5 py-10 sm:px-10 lg:px-12 lg:py-16">
          <div className="flex items-end justify-between gap-4 border-b border-white/15 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8fb5b1]">Open lanes</p>
              <h3 className="mt-1 text-lg font-semibold">Charlotte and regional routes</h3>
            </div>
            <span className="text-xs text-[#8fb5b1]">Operational sample</span>
          </div>

          <div className="divide-y divide-white/10">
            {marketData.map(market => (
              <div key={market.route} className="grid grid-cols-[minmax(0,1fr)_70px_86px] items-center gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_100px_110px]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white sm:text-base">{market.route}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#8fb5b1]"><ArrowUpRight className="h-3 w-3" /> Active corridor</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8fb5b1]">Loads</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">{market.loads}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8fb5b1]">Avg rate</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-[#f5bd4d]">{market.avgRate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}