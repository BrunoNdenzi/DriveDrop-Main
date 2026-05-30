'use client'

import { useState } from 'react'
import Link from 'next/link'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import {
  Layers, Ruler, Phone, Truck, AlertTriangle, CheckCircle,
  ArrowRight, Banknote, Smartphone, ChevronDown, ArrowLeft, MapPin
} from 'lucide-react'

// ── DELIVERY TIERS ──────────────────────────────────────
const TIERS = [
  { range: '0 – 15 mi', label: 'Tier 1', price: '$75', note: 'Flat rate' },
  { range: '16 – 30 mi', label: 'Tier 2', price: '$120', note: 'Flat rate' },
  { range: '31+ mi', label: 'Tier 3', price: '$120 + $2.50/mi', note: 'From Charlotte' },
]

// ── TIER CALCULATOR ─────────────────────────────────────
function useTierCalc() {
  const [miles, setMiles] = useState<number | ''>('')
  const [sqft, setSqft] = useState<number | ''>('')

  let tier = ''
  let deliveryCost = 0
  let deliveryLabel = ''

  if (typeof miles === 'number' && miles > 0) {
    if (miles <= 15) {
      tier = 'Tier 1'
      deliveryCost = 75
      deliveryLabel = '$75 flat'
    } else if (miles <= 30) {
      tier = 'Tier 2'
      deliveryCost = 120
      deliveryLabel = '$120 flat'
    } else {
      deliveryCost = 120 + (miles - 0) * 2.5
      tier = 'Tier 3'
      deliveryLabel = `$${deliveryCost.toFixed(0)} ($120 + $2.50 × ${miles} mi)`
    }
  }

  return { miles, setMiles, sqft, setSqft, tier, deliveryCost, deliveryLabel }
}

// ── LEAD FORM ─────────────────────────────────────────────
function QuoteForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', sqft: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [open, setOpen] = useState(false)

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/services/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'tiles',
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          message: form.message || undefined,
          extras: form.sqft ? { square_feet: form.sqft } : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-green-950/40 border border-green-500/20 p-8 text-center">
        <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-white mb-1">Request received!</h3>
        <p className="text-white/50 text-sm">We'll call you back shortly. You can also reach us at</p>
        <a href="tel:+17042662317" className="text-amber-400 font-bold mt-2 inline-block">+1 (704) 266-2317</a>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-6 text-left group"
      >
        <div>
          <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-0.5">Place an order</p>
          <h3 className="text-xl font-black text-white">Request a tile quote</h3>
        </div>
        <ChevronDown className={`h-5 w-5 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={submit} className="px-6 pb-6 space-y-4 border-t border-white/10 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Full Name *</label>
              <input
                required
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Phone *</label>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+1 704 000 0000"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="optional"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Sq. Footage (approx.)</label>
              <input
                type="number"
                min="0"
                value={form.sqft}
                onChange={e => update('sqft', e.target.value)}
                placeholder="e.g. 400"
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Message / Project details</label>
            <textarea
              rows={3}
              value={form.message}
              onChange={e => update('message', e.target.value)}
              placeholder="Tell us about your project, address, need installation?"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors resize-none"
            />
          </div>

          {status === 'error' && (
            <p className="text-red-400 text-sm">Something went wrong. Call us directly at +1 (704) 266-2317.</p>
          )}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            {status === 'sending' ? 'Sending...' : (
              <>Send Quote Request <ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          <p className="text-center text-white/30 text-xs">Or call us directly: <a href="tel:+17042662317" className="text-amber-400">+1 (704) 266-2317</a></p>
        </form>
      )}
    </div>
  )
}

// ── DELIVERY CALCULATOR ─────────────────────────────────
function DeliveryCalc() {
  const { miles, setMiles, tier, deliveryLabel } = useTierCalc()

  return (
    <div className="rounded-2xl bg-amber-950/20 border border-amber-500/20 p-6">
      <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-4">Delivery cost estimator</p>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Distance from Charlotte (miles)</label>
        <input
          type="number"
          min="0"
          value={miles}
          onChange={e => setMiles(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="e.g. 20"
          className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-amber-500/60 transition-colors"
        />
      </div>

      {tier && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-center justify-between">
          <span className="text-amber-400 text-xs font-bold">{tier}</span>
          <span className="text-white font-black text-lg">{deliveryLabel}</span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {TIERS.map(t => (
          <div key={t.label} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0">
            <div>
              <span className="text-white/60 font-medium">{t.range}</span>
              <span className="ml-2 text-white/30 text-xs">{t.note}</span>
            </div>
            <span className="text-white font-bold">{t.price}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-white/25">Re-delivery: original fee + $50 (no-show, payment issues, inaccessible site). Curbside only — no interior carry-in.</p>
    </div>
  )
}

// ── PAGE ────────────────────────────────────────────────
export default function TilesPage() {
  return (
    <main className="min-h-screen bg-background">
      <ServicesHeader />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-[68px]">

        {/* Diagonal amber stripe */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 hidden lg:block"
          style={{
            background: 'linear-gradient(135deg, transparent 0%, rgba(245,158,11,0.05) 50%, rgba(245,158,11,0.12) 100%)',
          }}
        />

        {/* Grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="container relative z-10">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-8 mt-8 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All services
          </Link>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 mb-6">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Tile Supply · Charlotte, NC</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-5">
                Taj Mahal<br />
                <span className="text-amber-400">24×48</span><br />
                Porcelain Tiles
              </h1>

              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Large-format polished porcelain in a Taj Mahal stone finish. Available for direct supply and scheduled curbside delivery across Charlotte and surrounding areas.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="tel:+17042662317"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3.5 rounded-xl transition-all hover:scale-[1.02] text-sm"
                >
                  <Phone className="h-4 w-4" />
                  +1 (704) 266-2317
                </a>
                <a
                  href="#quote"
                  className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-3.5 rounded-xl transition-all text-sm hover:bg-white/5"
                >
                  Request quote
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Product card */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/20 p-8">
                {/* Placeholder for tile product image */}
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 h-56 flex flex-col items-center justify-center mb-6">
                  <Layers className="h-16 w-16 text-amber-500/30 mb-2" />
                  <p className="text-white/20 text-xs tracking-widest uppercase">Product Photo</p>
                  <p className="text-white/15 text-xs">Taj Mahal Polished Porcelain</p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-amber-400 text-xl font-black">24×48</p>
                    <p className="text-white/40 text-xs mt-0.5">Format</p>
                  </div>
                  <div>
                    <p className="text-amber-400 text-xl font-black">Polished</p>
                    <p className="text-white/40 text-xs mt-0.5">Finish</p>
                  </div>
                  <div>
                    <p className="text-amber-400 text-xl font-black">Porcelain</p>
                    <p className="text-white/40 text-xs mt-0.5">Material</p>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs mb-0.5">Price per sq ft</p>
                    <p className="text-white font-black text-3xl">TBD</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-emerald-400" />
                      <span className="text-white/70 text-xs font-semibold">Zelle</span>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-400" />
                      <span className="text-white/70 text-xs font-semibold">Cash</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INSTALLATION ADD-ON ────────────────────────────── */}
      <section className="py-14 border-b border-border">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 p-6">
              <Ruler className="h-8 w-8 text-amber-600 dark:text-amber-400 mb-3" />
              <h3 className="font-black text-lg text-foreground mb-2">Installation Available</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Professional installation as an add-on service. Our experienced installer handles the full job — extra cost, perfect results.
              </p>
            </div>
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 p-6">
              <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
              <h3 className="font-black text-lg text-foreground mb-2">Curbside Delivery</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We deliver to your address, curbside. Pallets or bundles left at your door — no carry-in or interior placement included.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border p-6">
              <AlertTriangle className="h-8 w-8 text-orange-500 mb-3" />
              <h3 className="font-black text-lg text-foreground mb-2">Re-Delivery Policy</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                No-show, insufficient funds, or inaccessible site: re-delivery charged at original fee + $50.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DELIVERY TIERS + QUOTE ─────────────────────────── */}
      <section id="quote" className="py-20 bg-slate-950">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left: Tiers */}
            <div>
              <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-3">
                <MapPin className="h-3.5 w-3.5 inline mr-1" />
                From Charlotte, NC
              </p>
              <h2 className="text-3xl font-black text-white mb-2">Delivery pricing</h2>
              <p className="text-white/40 text-sm mb-8">Flat rates for local, mileage-based for longer hauls.</p>

              <DeliveryCalc />
            </div>

            {/* Right: Quote form */}
            <div>
              <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-3">Get in touch</p>
              <h2 className="text-3xl font-black text-white mb-2">Request your quote</h2>
              <p className="text-white/40 text-sm mb-8">We'll call you back with pricing and availability.</p>

              <QuoteForm />
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
