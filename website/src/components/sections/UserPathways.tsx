import Link from 'next/link'
import { ArrowRight, Building2, Package, Truck } from '@/components/icons/streamline-lucide'

const roles = [
  {
    icon: Package,
    number: '01',
    label: 'Vehicle owners',
    summary: 'Request transport, approve the details, and follow your vehicle through delivery.',
    capabilities: ['Fast quote requests', 'Live shipment tracking', 'Pickup and delivery records'],
    cta: 'Ship a vehicle',
    href: '/signup?role=client',
  },
  {
    icon: Truck,
    number: '02',
    label: 'Carriers',
    summary: 'Find qualified loads, build efficient routes, and keep every handoff documented.',
    capabilities: ['Available load board', 'Route optimization', 'Earnings and documents'],
    cta: 'Join the carrier network',
    href: '/drivers/register',
  },
  {
    icon: Building2,
    number: '03',
    label: 'Brokers',
    summary: 'Coordinate shipments and trusted carriers from one accountable operating view.',
    capabilities: ['Carrier assignments', 'Network-wide tracking', 'Payout management'],
    cta: 'Connect your network',
    href: '/auth/broker-signup',
  },
]

export default function UserPathways() {
  return (
    <section className="border-b border-[#cbd8d6] bg-[#f2f6f5]">
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-10 sm:py-20 lg:px-16">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">One transport network</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#132c2d] sm:text-4xl">Built around every side of the move.</h2>
          <p className="mt-4 text-base leading-7 text-[#607675]">Each workspace is focused on the decisions its operator needs to make, while every shipment stays connected.</p>
        </div>

        <div className="mt-10 grid border border-[#c7d4d2] bg-[#c7d4d2] lg:grid-cols-3 lg:gap-px">
          {roles.map(role => (
            <article key={role.label} className="group flex min-h-[330px] flex-col border-b border-[#c7d4d2] bg-white p-6 last:border-b-0 sm:p-8 lg:border-b-0">
              <div className="flex items-start justify-between">
                <div className="grid h-11 w-11 place-items-center bg-[#e7f3f1] text-[#007b72]">
                  <role.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold tabular-nums text-[#92a3a1]">{role.number}</span>
              </div>
              <h3 className="mt-7 text-xl font-semibold text-[#193638]">{role.label}</h3>
              <p className="mt-3 text-sm leading-6 text-[#667b79]">{role.summary}</p>
              <ul className="mt-6 space-y-2 border-t border-[#dce5e3] pt-5">
                {role.capabilities.map(capability => (
                  <li key={capability} className="flex items-center gap-3 text-sm text-[#405958]">
                    <span className="h-1.5 w-1.5 bg-[#f3a712]" />
                    {capability}
                  </li>
                ))}
              </ul>
              <Link href={role.href} className="mt-auto flex items-center gap-2 pt-7 text-sm font-bold text-[#007b72] hover:underline">
                {role.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}