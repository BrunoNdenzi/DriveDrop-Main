'use client'

import Image from 'next/image'
import { type ComponentType, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Fuel,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Map,
  MapPin,
  Menu,
  PackageCheck,
  Route,
  Search,
  ShieldCheck,
  Truck,
} from '@/components/icons/streamline-lucide'

type PreviewView = 'access' | 'operations' | 'hero'

const heroPhotos = [
  {
    label: 'En route carrier',
    detail: 'Directly communicates nationwide vehicle transport.',
    url: 'https://images.unsplash.com/photo-1761917904658-2a9ecb84a169?auto=format&fit=crop&w=2200&q=88',
    source: 'https://unsplash.com/photos/car-carrier-truck-transporting-vehicles-on-a-road-q36Yp9RpHa0',
    position: 'center 58%',
  },
  {
    label: 'Loading moment',
    detail: 'Puts care, handling, and the actual service in view.',
    url: 'https://images.unsplash.com/photo-1767554557087-c51166d54023?auto=format&fit=crop&w=2200&q=88',
    source: 'https://unsplash.com/photos/red-vintage-car-being-loaded-onto-a-car-carrier-wIc9pIY2WSE',
    position: 'center 55%',
  },
  {
    label: 'Logistics scale',
    detail: 'Signals inventory, network capacity, and operations.',
    url: 'https://images.unsplash.com/photo-1727893294198-e85137574f5b?auto=format&fit=crop&w=2200&q=88',
    source: 'https://unsplash.com/photos/a-warehouse-filled-with-lots-of-cars-and-trucks-5M-72czGFl4',
    position: 'center 52%',
  },
]

const shipments = [
  { id: 'DD-4821', vehicle: '2022 Nissan Altima', route: 'Charlotte, NC to Raleigh, NC', status: 'In transit', eta: '3:40 PM', payout: '$97.35' },
  { id: 'DD-4817', vehicle: '2024 Hyundai Tucson', route: 'Concord, NC to Charlotte, NC', status: 'Pickup due', eta: '11:20 AM', payout: '$142.00' },
  { id: 'DD-4809', vehicle: '2023 Honda CR-V', route: 'Charlotte, NC to Greensboro, NC', status: 'Assigned', eta: 'Tomorrow', payout: '$118.50' },
]

export default function DesignPreviewPage() {
  const [view, setView] = useState<PreviewView>('access')

  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="sticky top-0 z-20 border-b border-[#ccd9d7] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo-primary.png" alt="DriveDrop" width={132} height={36} className="h-8 w-auto" priority />
            <span className="hidden border-l border-[#d7e1df] pl-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#607675] sm:block">
              Product system
            </span>
          </div>
          <div className="inline-flex h-10 items-center border border-[#c8d5d3] bg-[#eef3f2] p-1">
            <button
              type="button"
              onClick={() => setView('access')}
              className={`h-8 px-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${view === 'access' ? 'bg-white text-[#006f67] shadow-sm' : 'text-[#5f7372] hover:text-[#132c2d]'}`}
            >
              Access
            </button>
            <button
              type="button"
              onClick={() => setView('operations')}
              className={`h-8 px-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${view === 'operations' ? 'bg-white text-[#006f67] shadow-sm' : 'text-[#5f7372] hover:text-[#132c2d]'}`}
            >
              Operations
            </button>
            <button
              type="button"
              onClick={() => setView('hero')}
              className={`h-8 px-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${view === 'hero' ? 'bg-white text-[#006f67] shadow-sm' : 'text-[#5f7372] hover:text-[#132c2d]'}`}
            >
              Hero
            </button>
          </div>
        </div>
      </header>

      {view === 'access' ? <AccessPreview /> : view === 'operations' ? <OperationsPreview /> : <HeroPreview />}
    </main>
  )
}

function AccessPreview() {
  const [role, setRole] = useState<'shipper' | 'driver' | 'broker'>('driver')

  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <div className="relative flex min-h-[330px] flex-col justify-between overflow-hidden bg-[#123638] px-6 py-8 text-white sm:px-10 sm:py-12 lg:min-h-full lg:px-16 lg:py-16">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative max-w-xl">
          <div className="mb-8 inline-flex items-center gap-2 border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c7f3ed]">
            <ShieldCheck className="h-4 w-4" />
            Verified vehicle logistics
          </div>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            Every move, accounted for.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#c8d9d8] sm:text-lg">
            One operational network for vehicle owners, drivers, and freight partners.
          </p>
        </div>

        <div className="relative mt-10 grid grid-cols-3 border-y border-white/20">
          <AccessMetric label="Tracked" value="Real time" />
          <AccessMetric label="Coverage" value="Nationwide" />
          <AccessMetric label="Support" value="Human" />
        </div>
      </div>

      <div className="flex items-center bg-white px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008c82]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#132c2d]">Sign in to DriveDrop</h2>
          <p className="mt-2 text-sm leading-6 text-[#667b79]">Use the workspace assigned to your account.</p>

          <div className="mt-7 grid grid-cols-3 border border-[#cbd8d6] bg-[#f2f6f5] p-1">
            {(['shipper', 'driver', 'broker'] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setRole(item)}
                className={`h-10 text-sm font-semibold capitalize transition-colors ${role === item ? 'bg-white text-[#007b72] shadow-sm' : 'text-[#647977] hover:text-[#132c2d]'}`}
              >
                {item}
              </button>
            ))}
          </div>

          <form className="mt-7 space-y-5" onSubmit={event => event.preventDefault()}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#263f40]">Email address</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-[#708482]" />
                <input type="email" placeholder="name@company.com" className="h-11 w-full border border-[#b9c9c7] bg-white pl-11 pr-3 text-sm outline-none transition-colors placeholder:text-[#8ea09e] focus:border-[#008c82] focus:ring-2 focus:ring-[#008c82]/15" />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-sm font-semibold text-[#263f40]">
                Password
                <button type="button" className="font-medium text-[#007b72] hover:underline">Forgot password?</button>
              </span>
              <span className="relative block">
                <LockKeyhole className="absolute left-3 top-3 h-5 w-5 text-[#708482]" />
                <input type="password" placeholder="Enter your password" className="h-11 w-full border border-[#b9c9c7] bg-white pl-11 pr-3 text-sm outline-none transition-colors placeholder:text-[#8ea09e] focus:border-[#008c82] focus:ring-2 focus:ring-[#008c82]/15" />
              </span>
            </label>
            <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white transition-colors hover:bg-[#00756d] focus:outline-none focus:ring-2 focus:ring-[#008c82] focus:ring-offset-2">
              Continue as {role}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-7 flex items-center gap-2 border-t border-[#dce5e3] pt-5 text-xs text-[#718482]">
            <ShieldCheck className="h-4 w-4 text-[#008c82]" />
            Secure account access with encrypted sessions
          </div>
        </div>
      </div>
    </section>
  )
}

function AccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-white/20 px-3 py-4 first:border-l-0 first:pl-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9db8b6]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  )
}

function OperationsPreview() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] bg-[#f2f6f5]">
      <aside className="hidden w-64 shrink-0 border-r border-[#cbd8d6] bg-[#173436] text-white lg:block">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8fb5b1]">Driver workspace</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#f3a712] font-bold text-[#173436]">BT</div>
            <div>
              <p className="text-sm font-semibold">B Trading</p>
              <p className="text-xs text-[#9fbcba]">Online in Charlotte</p>
            </div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          <NavItem icon={LayoutDashboard} label="Overview" />
          <NavItem icon={PackageCheck} label="Shipments" badge="7" />
          <NavItem icon={Route} label="Route planner" active />
          <NavItem icon={Map} label="Live navigation" />
          <NavItem icon={CircleDollarSign} label="Earnings" />
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between border-b border-[#cbd8d6] bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center border border-[#c8d5d3] text-[#304b4c] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-semibold text-[#173436]">Route operations</p>
              <p className="hidden text-xs text-[#6d807f] sm:block">Saturday, August 23</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Search" className="flex h-9 w-9 items-center justify-center border border-[#c8d5d3] bg-white text-[#4f6665]"><Search className="h-4 w-4" /></button>
            <button type="button" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center border border-[#c8d5d3] bg-white text-[#4f6665]">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 bg-[#e68a00]" />
            </button>
          </div>
        </div>

        <div className="border-b border-[#cbd8d6] bg-white px-4 py-5 sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#008c82]">Today&apos;s plan</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#132c2d] sm:text-3xl">Charlotte dispatch route</h1>
              <p className="mt-1 text-sm text-[#667b79]">Seven assigned shipments across fifteen validated stops.</p>
            </div>
            <button type="button" className="flex h-10 items-center justify-center gap-2 bg-[#008c82] px-4 text-sm font-bold text-white hover:bg-[#00756d]">
              <Route className="h-4 w-4" />
              Optimize route
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-b border-[#cbd8d6] bg-white md:grid-cols-4">
          <OpsMetric icon={Truck} label="Shipments" value="7" detail="15 stops" />
          <OpsMetric icon={Route} label="Distance" value="147.5 mi" detail="40.5 mi reduced" />
          <OpsMetric icon={Fuel} label="Diesel" value="$5.454" detail="EIA weekly" />
          <OpsMetric icon={Clock3} label="Route time" value="7.1 hr" detail="Includes dwell" />
        </div>

        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 border border-[#c7d4d2] bg-white">
            <div className="flex items-center justify-between border-b border-[#d7e1df] px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#193638]">Active shipments</h2>
                <p className="mt-0.5 text-xs text-[#6b7f7d]">Ordered by next route action</p>
              </div>
              <button type="button" className="text-xs font-bold text-[#007b72] hover:underline">View all</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[#f4f7f6] text-[11px] font-bold uppercase tracking-[0.1em] text-[#657977]">
                  <tr>
                    <th className="px-4 py-2.5">Shipment</th>
                    <th className="px-4 py-2.5">Vehicle</th>
                    <th className="px-4 py-2.5">Route</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">ETA</th>
                    <th className="px-4 py-2.5 text-right">Payout</th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(shipment => (
                    <tr key={shipment.id} className="border-t border-[#e0e8e6] hover:bg-[#f7faf9]">
                      <td className="px-4 py-3 font-semibold text-[#007b72]">{shipment.id}</td>
                      <td className="px-4 py-3 font-medium text-[#263f40]">{shipment.vehicle}</td>
                      <td className="max-w-[220px] px-4 py-3 text-[#667b79]">{shipment.route}</td>
                      <td className="px-4 py-3"><Status label={shipment.status} /></td>
                      <td className="px-4 py-3 tabular-nums text-[#405958]">{shipment.eta}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#263f40]">{shipment.payout}</td>
                      <td className="px-2 py-3"><ChevronRight className="h-4 w-4 text-[#859795]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-[#c7d4d2] bg-white">
              <div className="border-b border-[#d7e1df] px-4 py-3">
                <h2 className="text-sm font-bold text-[#193638]">Next stop</h2>
              </div>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#fff1d3] text-[#9b6200]"><MapPin className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#9b6200]">Pickup</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#263f40]">201 E Trade St, Charlotte, NC</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 border-t border-[#dce5e3] pt-4 text-sm">
                  <div><dt className="text-xs text-[#718482]">Arrival</dt><dd className="mt-1 font-semibold">10:25 AM</dd></div>
                  <div><dt className="text-xs text-[#718482]">Vehicle</dt><dd className="mt-1 font-semibold">Altima</dd></div>
                </dl>
              </div>
            </div>

            <div className="border border-[#e4c984] bg-[#fff8e8] p-4">
              <div className="flex gap-3">
                <CircleDollarSign className="h-5 w-5 shrink-0 text-[#a66b00]" />
                <div>
                  <p className="text-sm font-bold text-[#674700]">Payout check required</p>
                  <p className="mt-1 text-xs leading-5 text-[#806126]">Six selected shipments need accepted payouts before profit can be calculated.</p>
                  <button type="button" className="mt-3 text-xs font-bold text-[#875900] hover:underline">Review shipments</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}

function NavItem({ icon: Icon, label, active, badge }: { icon: ComponentType<{ className?: string }>; label: string; active?: boolean; badge?: string }) {
  return (
    <button type="button" className={`flex h-10 w-full items-center gap-3 px-3 text-sm font-medium ${active ? 'bg-white text-[#173436]' : 'text-[#bfd0ce] hover:bg-white/10 hover:text-white'}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge && <span className="ml-auto text-xs tabular-nums">{badge}</span>}
    </button>
  )
}

function OpsMetric({ icon: Icon, label, value, detail }: { icon: ComponentType<{ className?: string }>; label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-r border-t border-[#d7e1df] px-4 py-4 first:border-l-0 md:border-t-0 sm:px-5">
      <div className="hidden h-9 w-9 shrink-0 items-center justify-center bg-[#e7f3f1] text-[#007b72] sm:flex"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718482]">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-[#193638]">{value}</p>
        <p className="truncate text-xs text-[#718482]">{detail}</p>
      </div>
    </div>
  )
}

function Status({ label }: { label: string }) {
  const isTransit = label === 'In transit'
  const isDue = label === 'Pickup due'
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-semibold ${isTransit ? 'border-[#a8d8cc] bg-[#eaf7f3] text-[#176c59]' : isDue ? 'border-[#e8ce8d] bg-[#fff7e4] text-[#8b5d00]' : 'border-[#cbd7dc] bg-[#f1f5f6] text-[#536970]'}`}>
      {isTransit && <Check className="h-3 w-3" />}
      {label}
    </span>
  )
}

function HeroPreview() {
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const photo = heroPhotos[selectedPhoto]!

  return (
    <section className="bg-white">
      <div
        className="relative flex min-h-[calc(100vh-13rem)] items-end overflow-hidden bg-[#173436] bg-cover sm:min-h-[calc(100vh-12rem)]"
        style={{ backgroundImage: `url(${photo.url})`, backgroundPosition: photo.position }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,32,34,.92)_0%,rgba(10,32,34,.72)_42%,rgba(10,32,34,.12)_78%)]" />
        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-10 pt-24 sm:px-10 sm:pb-14 lg:px-16">
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 border border-white/30 bg-[#173436]/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">
              <Truck className="h-4 w-4 text-[#5cd6ca]" />
              Nationwide vehicle transport
            </div>
            <h1 className="text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">DriveDrop</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#e0ecea] sm:text-xl">
              Ship vehicles with verified drivers, live tracking, and one accountable team from pickup to delivery.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="flex h-11 items-center justify-center gap-2 bg-[#00a99d] px-5 text-sm font-bold text-white hover:bg-[#008c82]">
                Get a shipping quote
                <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" className="h-11 border border-white/55 bg-[#173436]/55 px-5 text-sm font-bold text-white hover:bg-[#173436]/75">
                Track a shipment
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-px bg-[#cbd8d6] border-x border-b border-[#cbd8d6] sm:grid-cols-3">
        {heroPhotos.map((candidate, index) => (
          <button
            key={candidate.label}
            type="button"
            onClick={() => setSelectedPhoto(index)}
            className={`bg-white p-4 text-left transition-colors hover:bg-[#f4f8f7] ${selectedPhoto === index ? 'shadow-[inset_0_3px_0_#008c82]' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#193638]">{String.fromCharCode(65 + index)}. {candidate.label}</span>
              {selectedPhoto === index && <Check className="h-4 w-4 text-[#008c82]" />}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#667b79]">{candidate.detail}</p>
            <a href={candidate.source} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="mt-2 inline-block text-xs font-semibold text-[#007b72] hover:underline">
              View source
            </a>
          </button>
        ))}
      </div>
    </section>
  )
}