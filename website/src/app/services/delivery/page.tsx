'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import {
  Package, Phone, ArrowRight, CheckCircle,
  ArrowLeft, MapPin, XCircle, Sofa, Box, Building2,
  ShoppingBag, Wrench, ScrollText, Paperclip
} from 'lucide-react'

// ── WHAT WE CARRY ────────────────────────────────────────
const CAN_CARRY = [
  { icon: Sofa, label: 'Furniture', note: 'Sofas, tables, desks, bed frames' },
  { icon: Box, label: 'Business goods', note: 'Office supplies, equipment, inventory' },
  { icon: Building2, label: 'Contractor materials', note: 'Tools, supplies, job site delivery' },
  { icon: ShoppingBag, label: 'Retail / e-commerce', note: 'Overflow, marketplace pickups' },
  { icon: Wrench, label: 'Appliances', note: 'Washers, dryers, small equipment' },
  { icon: Package, label: 'Oversized parcels', note: 'Anything a van can fit' },
]

// ── LEAD FORM ─────────────────────────────────────────────
function QuoteForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', itemType: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [files, setFiles] = useState<File[]>([])

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
      let attachmentUrls: string[] = []
      if (files.length > 0) {
        const uploads = await Promise.all(files.map(async (file) => {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('service', 'delivery')
          const r = await fetch('/api/services/upload', { method: 'POST', body: fd })
          if (r.ok) { const d = await r.json(); return d.url as string }
          return null
        }))
        attachmentUrls = uploads.filter((u): u is string => u !== null)
      }
      const res = await fetch('/api/services/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: 'delivery',
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          message: form.message || undefined,
          extras: {
            ...(form.itemType ? { item_type: form.itemType } : {}),
            ...(attachmentUrls.length > 0 ? { attachments: attachmentUrls.join(', ') } : {}),
          },
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
      <div className="rounded-2xl bg-blue-950/40 border border-blue-500/20 p-10 text-center">
        <CheckCircle className="h-12 w-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-2xl font-black text-white mb-2">Request sent!</h3>
        <p className="text-white/50">We'll call you back to confirm details and pricing.</p>
        <a href="tel:+17042662317" className="text-blue-400 font-bold mt-3 inline-block text-lg">+1 (704) 266-2317</a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Full Name *</label>
          <input
            required
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Jane Smith"
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-colors"
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
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-colors"
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
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">What are you shipping?</label>
          <input
            value={form.itemType}
            onChange={e => update('itemType', e.target.value)}
            placeholder="e.g. couch, office supplies..."
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Pickup & delivery details</label>
        <textarea
          rows={4}
          value={form.message}
          onChange={e => update('message', e.target.value)}
          placeholder="Pickup address, drop-off address, item dimensions, preferred time..."
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Photos or documents (optional)</label>
        <label className="flex items-center gap-3 w-full bg-slate-800 border border-dashed border-white/10 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-500/40 transition-colors">
          <Paperclip className="h-4 w-4 text-white/40 shrink-0" />
          <span className="text-white/25 text-sm truncate">
            {files.length === 0 ? 'Add photos or docs — max 10MB each' : files.map(f => f.name).join(', ')}
          </span>
          <input type="file" multiple accept="image/*,.pdf" className="sr-only" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </label>
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">Something went wrong. Call us: +1 (704) 266-2317.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
      >
        {status === 'sending' ? 'Sending...' : (
          <>Book Delivery <ArrowRight className="h-4 w-4" /></>
        )}
      </button>

      <p className="text-center text-white/30 text-xs">
        Or call/text: <a href="tel:+17042662317" className="text-blue-400">+1 (704) 266-2317</a>
      </p>
    </form>
  )
}

// ── PAGE ─────────────────────────────────────────────────
export default function DeliveryPage() {
  return (
    <main className="min-h-screen bg-background">
      <ServicesHeader />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-[68px]">

        {/* Real photo background */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1558803116-b443d28fa878?w=1600&q=80"
            alt="Van delivery service"
            fill
            className="object-cover object-center"
            unoptimized
            priority
          />
          <div className="absolute inset-0 bg-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
        </div>

        {/* Blue glow */}
        <div className="pointer-events-none absolute top-0 left-1/3 w-[600px] h-[500px] rounded-full bg-blue-500/8 blur-[140px]" />

        {/* Grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Background word */}
        <div className="pointer-events-none absolute inset-0 flex items-end overflow-hidden select-none pb-4">
          <span className="text-[22vw] font-black text-white/[0.02] leading-none tracking-tighter whitespace-nowrap pl-4" aria-hidden>
            DELIVERY
          </span>
        </div>

        <div className="container relative z-10 pb-16 lg:pb-24">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-8 mt-8 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All services
          </Link>

          <div className="grid lg:grid-cols-5 gap-12 items-center">
            {/* Left 3/5 */}
            <div className="lg:col-span-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 mb-6">
                <MapPin className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Charlotte Metro · Same-City</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-black text-white leading-[0.92] tracking-tight mb-5">
                If it fits<br />
                <span className="text-blue-400">in a van</span>,<br />
                we deliver it.
              </h1>

              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Charlotte-based van delivery for businesses and individuals. Furniture, goods, equipment, contractor materials — point A to point B, same day or scheduled.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="tel:+17042662317"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-4 rounded-xl transition-all hover:scale-[1.02] text-sm"
                >
                  <Phone className="h-4 w-4" />
                  +1 (704) 266-2317
                </a>
                <a
                  href="#quote"
                  className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-4 rounded-xl transition-all text-sm hover:bg-white/5"
                >
                  Book a delivery
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Right 2/5 — stat cards */}
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-2xl bg-blue-950/30 border border-blue-500/20 p-5">
                <MapPin className="h-6 w-6 text-blue-400 mb-2" />
                <p className="text-2xl font-black text-white">Charlotte, NC</p>
                <p className="text-white/40 text-sm mt-0.5">and surrounding areas</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <ScrollText className="h-6 w-6 text-amber-400 mb-2" />
                <p className="text-lg font-black text-white">Freight Forwarder</p>
                <p className="text-white/40 text-sm mt-0.5">Licensed for commercial moves</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="text-xl font-black text-white">Quoted per load</p>
                <p className="text-white/40 text-sm mt-0.5">Call for a rate — no long-term contract</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE CARRY ────────────────────────────────── */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left: CAN carry */}
            <div>
              <p className="text-blue-500 text-xs font-bold tracking-widest uppercase mb-3">We carry</p>
              <h2 className="text-2xl font-black text-foreground mb-6">What fits, we move</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAN_CARRY.map(item => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border hover:border-blue-500/20 p-4 transition-all">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">{item.label}</p>
                        <p className="text-muted-foreground text-xs mt-0.5">{item.note}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: CAN'T carry + notes */}
            <div className="space-y-4">
              <div>
                <p className="text-red-500 text-xs font-bold tracking-widest uppercase mb-3">We don't carry</p>
                <h2 className="text-2xl font-black text-foreground mb-4">What we won't take</h2>
                <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground text-sm">Food &amp; perishables</p>
                      <p className="text-muted-foreground text-xs">No food delivery license — not a restriction we can work around.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <p className="font-bold text-foreground text-sm">Hazardous materials</p>
                      <p className="text-muted-foreground text-xs">Chemicals, flammables, HAZMAT — not equipped for it.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 p-5">
                <ScrollText className="h-6 w-6 text-blue-500 mb-2" />
                <h3 className="font-black text-foreground mb-1">Freight Forwarder Licensed</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We hold a freight forwarder license — which means we can move commercial goods across the city on behalf of businesses. That's a layer of accountability most van delivery services don't have.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUOTE FORM ───────────────────────────────────── */}
      <section id="quote" className="py-20 bg-slate-950">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-3 text-center">Schedule a pickup</p>
            <h2 className="text-4xl font-black text-white mb-3 text-center">Request a delivery</h2>
            <p className="text-white/40 text-center mb-10">Tell us what, where, and when. We'll confirm pricing and schedule on the call.</p>

            <div className="bg-slate-900 rounded-2xl border border-white/10 p-8">
              <QuoteForm />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
