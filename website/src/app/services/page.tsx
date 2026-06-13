import Link from 'next/link'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import {
  ArrowRight, Phone, Layers, TreePine, Package,
  MapPin, Truck, Wrench, ShieldCheck, Clock, Briefcase, ScrollText
} from 'lucide-react'

const services = [
  {
    id: 'tiles',
    featured: true,
    icon: Layers,
    name: 'Premium Tiles',
    tag: 'Supply & Delivery',
    tagline: 'Taj Mahal 24×48 polished porcelain — direct supply, curbside delivery, and professional installation.',
    attrs: [
      { icon: Truck, label: 'Curbside delivery' },
      { icon: Wrench, label: 'Installation add-on' },
      { icon: MapPin, label: 'Charlotte area' },
      { icon: ShieldCheck, label: 'Insured transport' },
    ],
    cta: 'Tile pricing',
    href: '/services/tiles',
    accent: '#f59e0b',
  },
  {
    id: 'tree-removal',
    featured: false,
    icon: TreePine,
    name: 'Tree Removal',
    tag: 'Licensed Contractor',
    tagline: 'Full removal, stump grinding, debris hauled. Site left clean.',
    attrs: [
      { icon: ShieldCheck, label: 'Licensed & insured' },
      { icon: Clock, label: 'Emergency response' },
      { icon: MapPin, label: 'Charlotte area' },
    ],
    cta: 'Free assessment',
    href: '/services/tree-removal',
    accent: '#22c55e',
  },
  {
    id: 'delivery',
    featured: false,
    icon: Package,
    name: 'Van Delivery',
    tag: 'Local Freight',
    tagline: 'Furniture, business goods, contractor materials — if it fits in a van, we move it.',
    attrs: [
      { icon: Briefcase, label: 'Business & personal' },
      { icon: ScrollText, label: 'Freight licensed' },
      { icon: MapPin, label: 'Charlotte metro' },
    ],
    cta: 'Book delivery',
    href: '/services/delivery',
    accent: '#3b82f6',
  },
  {
    id: 'freight',
    featured: false,
    icon: Truck,
    name: 'Freight Forwarding',
    tag: 'FF Licensed',
    tagline: 'We move it in our own van — or broker it to trusted carriers. LTL, FTL, and local freight covered.',
    attrs: [
      { icon: ScrollText, label: 'FF Licensed' },
      { icon: Package, label: 'Move + Broker' },
      { icon: MapPin, label: 'Charlotte area' },
    ],
    cta: 'Get freight quote',
    href: '/services/freight',
    accent: '#14b8a6',
  },
]

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-background">
      <ServicesHeader />

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-[68px]">
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Amber glow */}
        <div className="pointer-events-none absolute -top-40 -left-20 w-[480px] h-[480px] rounded-full bg-amber-500/10 blur-[130px]" />

        <div className="container relative z-10 py-20 lg:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8">
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/60 tracking-[3px] uppercase">Charlotte, NC</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] tracking-tight mb-6">
            One team.<br />
            <span className="text-amber-400">Every project.</span>
          </h1>

          <p className="text-white/40 text-base md:text-lg max-w-md leading-relaxed mb-10">
            Licensed, locally operated contractors — tiles, tree work, and van delivery from one Charlotte team.
          </p>

          <a
            href="tel:+17042662317"
            className="inline-flex items-center gap-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" />
            +1 (704) 266-2317
            <span className="text-black/45 font-normal">— call or text</span>
          </a>
        </div>
      </section>

      {/* ── SERVICES — editorial rows ──────────────────────────── */}
      <section className="bg-background">
        <div className="container">
          <div className="divide-y divide-border">
            {services.map((svc) => {
              const Icon = svc.icon
              return (
                <Link
                  key={svc.id}
                  href={svc.href}
                  className="group flex items-center gap-5 py-8 md:py-9 -mx-4 px-4 rounded-xl transition-all duration-200 hover:bg-muted/40"
                >
                  {/* Service icon */}
                  <div
                    className={`shrink-0 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
                      svc.featured ? 'w-[62px] h-[62px]' : 'w-[56px] h-[56px]'
                    }`}
                    style={{
                      background: `${svc.accent}18`,
                      border: `1px solid ${svc.accent}35`,
                    }}
                  >
                    <Icon
                      className={svc.featured ? 'h-[28px] w-[28px]' : 'h-[26px] w-[26px]'}
                      style={{ color: svc.accent }}
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1">
                      <span className={`font-black text-foreground ${
                        svc.featured ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'
                      }`}>{svc.name}</span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide hidden sm:inline"
                        style={{ background: `${svc.accent}18`, color: svc.accent }}
                      >
                        {svc.tag}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-3">{svc.tagline}</p>

                    {/* Attributes — icon + label, semantically relevant */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {svc.attrs.map(({ icon: AttrIcon, label }) => (
                        <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <AttrIcon className="h-3.5 w-3.5 shrink-0" style={{ color: svc.accent }} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Arrow CTA */}
                  <div
                    className="shrink-0 flex items-center gap-2 text-sm font-bold whitespace-nowrap"
                    style={{ color: svc.accent }}
                  >
                    <span className="hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">{svc.cta}</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── BOTTOM PHONE BAR ───────────────────────────────────── */}
      <section className="bg-slate-950 py-16 mt-4">
        <div className="container text-center">
          <p className="text-white/30 text-xs tracking-widest uppercase mb-4">Three services, one number</p>
          <a
            href="tel:+17042662317"
            className="text-4xl md:text-5xl font-black text-white hover:text-amber-400 transition-colors tracking-tight"
          >
            +1 (704) 266-2317
          </a>
          <p className="text-white/25 text-sm mt-3">Call or text — we'll point you in the right direction</p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
