import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { ArrowRight, Phone, Layers, TreePine, Package, MapPin, CheckCircle } from 'lucide-react'

const services = [
  {
    id: 'tiles',
    icon: Layers,
    tag: 'Supply & Delivery',
    name: 'Premium Tiles',
    desc: 'Taj Mahal polished porcelain. 24×48 large format. Supply, delivery, and professional installation available — for homeowners and contractors.',
    features: ['Direct pricing — no middlemen', 'Delivery to your door', 'Professional installation add-on', 'Bulk contractor orders welcome'],
    cta: 'Get tile pricing',
    href: '/services/tiles',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.08)',
    accentBorder: 'rgba(245,158,11,0.2)',
    num: '01',
  },
  {
    id: 'tree-removal',
    icon: TreePine,
    tag: 'Licensed Contractor',
    name: 'Tree Removal',
    desc: 'Licensed tree removal, trimming, and stump grinding for Charlotte homeowners and property managers. Clean, safe, done right.',
    features: ['Licensed & insured', 'Residential & commercial', 'Full cleanup included', 'Charlotte & surrounding areas'],
    cta: 'Request a quote',
    href: '/services/tree-removal',
    accent: '#22c55e',
    accentBg: 'rgba(34,197,94,0.08)',
    accentBorder: 'rgba(34,197,94,0.2)',
    num: '02',
  },
  {
    id: 'delivery',
    icon: Package,
    tag: 'Charlotte Local',
    name: 'Van Delivery',
    desc: 'Same-city delivery for anything that fits in a van. Furniture, equipment, supplies, business inventory — Charlotte to Charlotte.',
    features: ['Charlotte metro coverage', 'Business & personal', 'Furniture, goods, equipment', 'Freight forwarder licensed'],
    cta: 'Book a delivery',
    href: '/services/delivery',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.08)',
    accentBorder: 'rgba(59,130,246,0.2)',
    num: '03',
  },
]

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-background pt-20">
      <Header />

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-20 pb-24">

        {/* Background text texture */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
          <span
            className="text-[22vw] font-black text-white/[0.025] leading-none tracking-tighter whitespace-nowrap"
            aria-hidden
          >
            SERVICES
          </span>
        </div>

        {/* Grid lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Amber glow top-left */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="container relative z-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-white/70 tracking-widest uppercase">Charlotte, NC</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white leading-[0.95] tracking-tight mb-6">
              More than<br />
              <span className="text-amber-400">moving cars.</span>
            </h1>

            <p className="text-lg text-white/50 max-w-xl leading-relaxed mb-10">
              Three local services. One number. All operated by the same team behind DriveDrop — licensed, reliable, Charlotte-based.
            </p>

            <a
              href="tel:+17042662317"
              className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-black font-bold px-7 py-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Phone className="h-5 w-5" />
              <span>+1 (704) 266-2317</span>
              <span className="text-black/50 font-normal">— call or text</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── SERVICES ───────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="container">

          {/* Section label */}
          <div className="flex items-center gap-4 mb-14">
            <div className="h-px flex-1 bg-border max-w-[40px]" />
            <span className="text-xs font-bold text-muted-foreground tracking-[3px] uppercase">What we do</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-8">
            {services.map((svc, i) => {
              const Icon = svc.icon
              return (
                <div
                  key={svc.id}
                  className="group relative rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ borderColor: svc.accentBorder, background: svc.accentBg }}
                >
                  {/* Large number */}
                  <div
                    className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[120px] font-black leading-none select-none hidden lg:block"
                    style={{ color: svc.accent, opacity: 0.07 }}
                  >
                    {svc.num}
                  </div>

                  <div className="relative p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">

                    {/* Left: icon + content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ background: svc.accent }}
                        >
                          <Icon className="h-5 w-5 text-black" />
                        </div>
                        <span
                          className="text-xs font-bold tracking-widest uppercase"
                          style={{ color: svc.accent }}
                        >
                          {svc.tag}
                        </span>
                      </div>

                      <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3 tracking-tight">
                        {svc.name}
                      </h2>

                      <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-xl">
                        {svc.desc}
                      </p>

                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {svc.features.map(f => (
                          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 shrink-0" style={{ color: svc.accent }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Right: CTA */}
                    <div className="shrink-0">
                      <Link
                        href={svc.href}
                        className="inline-flex items-center gap-2 font-bold px-7 py-4 rounded-xl text-sm transition-all duration-200 hover:gap-3 group/btn"
                        style={{ background: svc.accent, color: '#000' }}
                      >
                        {svc.cta}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </section>

      {/* ── ALSO DO VEHICLE SHIPPING ───────────────────────────── */}
      <section className="bg-slate-950 py-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">Also by us</p>
              <h3 className="text-2xl font-black text-white">Need to ship a vehicle?</h3>
              <p className="text-white/50 mt-1 text-sm">That's where DriveDrop started — nationwide vehicle transport.</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm hover:bg-white/5"
            >
              DriveDrop Vehicle Shipping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
