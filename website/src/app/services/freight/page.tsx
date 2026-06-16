'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import {
  Truck, Phone, ArrowRight, CheckCircle,
  ArrowLeft, MapPin, Package, ScrollText,
  Building2, Users, ShieldCheck, Briefcase,
  Globe, Route, FileText, Clock, Paperclip
} from 'lucide-react'

// ── LEAD FORM ─────────────────────────────────────────────
function QuoteForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', freightType: '', weight: '', message: '' })
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
          fd.append('service', 'freight')
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
          service: 'freight',
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          message: form.message || undefined,
          extras: {
            ...(form.freightType ? { freight_type: form.freightType } : {}),
            ...(form.weight ? { approx_weight: form.weight } : {}),
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
      <div className="rounded-2xl bg-teal-500/10 border border-teal-500/30 p-10 text-center">
        <CheckCircle className="h-10 w-10 text-teal-400 mx-auto mb-4" />
        <p className="text-white font-bold text-xl mb-2">Request received!</p>
        <p className="text-white/50">We&apos;ll reach out within a few hours with a quote.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white/5 border border-white/10 p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Full name *</label>
          <input
            required
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="John Smith"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Phone *</label>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
            placeholder="(704) 000-0000"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Freight type</label>
          <select
            value={form.freightType}
            onChange={e => update('freightType', e.target.value)}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/60 transition-colors"
          >
            <option value="" className="bg-slate-900">Select type…</option>
            <option value="ltl" className="bg-slate-900">LTL (Less Than Truckload)</option>
            <option value="ftl" className="bg-slate-900">FTL (Full Truckload)</option>
            <option value="local-van" className="bg-slate-900">Local van delivery</option>
            <option value="other" className="bg-slate-900">Other / not sure</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Approx. weight / pieces</label>
          <input
            value={form.weight}
            onChange={e => update('weight', e.target.value)}
            placeholder="e.g. 500 lbs, 10 pallets"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Origin → Destination + details</label>
        <textarea
          value={form.message}
          onChange={e => update('message', e.target.value)}
          rows={3}
          placeholder="e.g. 8 pallets of tile, Charlotte NC to Raleigh NC, pickup Tuesday — or just describe what you've got"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Photos / documents (optional)</label>
        <label className="flex items-center gap-3 w-full bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-3 cursor-pointer hover:border-teal-500/40 transition-colors">
          <Paperclip className="h-4 w-4 text-white/40 shrink-0" />
          <span className="text-white/30 text-sm truncate">
            {files.length === 0 ? 'Add photos or docs — max 10MB each' : files.map(f => f.name).join(', ')}
          </span>
          <input type="file" multiple accept="image/*,.pdf" className="sr-only" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </label>
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">Something went wrong. Call us at (704) 524-7921.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm"
      >
        {status === 'sending' ? 'Sending…' : (
          <>
            Send my freight details
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  )
}

// ── PAGE ──────────────────────────────────────────────────
export default function FreightPage() {
  return (
    <main className="min-h-screen bg-background">
      <ServicesHeader />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-[68px]">

        {/* Real photo background */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80"
            alt="Freight truck on highway"
            fill
            className="object-cover object-center"
            unoptimized
            priority
          />
          <div className="absolute inset-0 bg-slate-950/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent" />
        </div>

        {/* Teal glow */}
        <div className="pointer-events-none absolute top-0 right-0 w-[600px] h-[500px] rounded-full bg-teal-500/8 blur-[140px]" />

        {/* Texture grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="container relative z-10">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-8 mt-8 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All services
          </Link>

          <div className="max-w-3xl pb-16">
            {/* FF License badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 mb-6">
              <ScrollText className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs font-bold text-teal-400 tracking-widest uppercase">FMCSA Freight Forwarder · Charlotte, NC</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[0.92] tracking-tight mb-6">
              Freight coordinated.<br />
              <span className="text-teal-400">Licensed and local.</span><br />
              <span className="text-white/30 text-4xl lg:text-5xl">Charlotte, NC</span>
            </h1>

            <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-xl">
              We&apos;re a Freight Forwarder licensed by the FMCSA. We coordinate domestic shipments — LTL, construction materials, warehouse freight — and handle the paperwork. You focus on your business.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:+17045247921"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-black font-bold px-7 py-4 rounded-xl transition-all hover:scale-[1.02] text-sm"
              >
                <Phone className="h-4 w-4" />
                +1 (704) 524-7921
              </a>
              <a
                href="#quote"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-4 rounded-xl transition-all text-sm hover:bg-white/5"
              >
                Get a quote
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── TWO-PATH SECTION ──────────────────────────────── */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-6">

            {/* LTL Card */}
            <div className="rounded-2xl bg-white/4 border border-teal-500/20 p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-500/15 mb-5">
                <Truck className="h-6 w-6 text-teal-400" />
              </div>
              <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-2">LTL &amp; Pallet Freight</p>
              <h2 className="text-2xl font-black text-white mb-3">Less than a full truck? We&apos;ve got it.</h2>
              <p className="text-white/50 mb-6 text-sm leading-relaxed">
                Most of our customers don&apos;t fill a whole trailer. We coordinate LTL shipments through vetted carriers — you pay for the space you use, nothing more.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Pallets, crates, and oversized boxes',
                  'Origin to destination in the Southeast and beyond',
                  'Carrier sourced, BOL issued, delivery confirmed',
                  'No broker markup surprise fees',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-teal-500/8 border border-teal-500/15 px-4 py-3 flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-teal-400 shrink-0" />
                <span className="text-teal-300/80 text-xs font-semibold">LTL specialists · Southeast &amp; Nationwide</span>
              </div>
            </div>

            {/* Construction Card */}
            <div className="rounded-2xl bg-white/4 border border-blue-500/20 p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/15 mb-5">
                <Globe className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-2">Construction &amp; Contractor Freight</p>
              <h2 className="text-2xl font-black text-white mb-3">Job site deliveries done right.</h2>
              <p className="text-white/50 mb-6 text-sm leading-relaxed">
                Contractors and GCs have tight timelines. We coordinate material freight to your job site — tile, flooring, lumber, equipment — and make sure it actually shows up when it&apos;s supposed to.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Warehouse-to-site and supplier-to-site moves',
                  'Charlotte, NC and surrounding counties',
                  'We work around your crew schedule',
                  'Bills of lading handled, no paperwork on your end',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 px-4 py-3 flex items-center gap-2.5">
                <Route className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-blue-300/80 text-xs font-semibold">Charlotte area · NC, SC, VA, GA, TN</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── WHO WE SERVE ──────────────────────────────────── */}
      <section className="py-14 bg-slate-950">
        <div className="container">
          <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-3">Who we serve</p>
          <h2 className="text-3xl font-black text-white mb-10 max-w-lg">We work with people who have real freight to move.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Building2, label: 'Contractors', note: 'Tile, flooring, lumber to job sites' },
              { icon: Briefcase, label: 'GCs & Builders', note: 'Material coordination across multiple sites' },
              { icon: Package, label: 'Warehouse Owners', note: 'Pickup, transfer, and delivery runs' },
              { icon: Users, label: 'Small Businesses', note: 'LTL shipments without the headache' },
              { icon: ShieldCheck, label: 'Importers', note: 'Domestic leg once freight clears port' },
              { icon: FileText, label: 'Material Suppliers', note: 'Coordinated deliveries to your customers' },
            ].map(({ icon: Icon, label, note }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/8">
                <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST SIGNALS ─────────────────────────────────── */}
      <section className="py-12 bg-background border-y border-white/8">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {[
              { icon: ScrollText, label: 'FMCSA Licensed', note: 'Freight Forwarder authority, verifiable on fmcsa.dot.gov' },
              { icon: ShieldCheck, label: 'Insured', note: 'Cargo and liability coverage on every shipment' },
              { icon: Clock, label: '24hr Response', note: 'You hear back from us the same day, every time' },
              { icon: MapPin, label: 'Charlotte Based', note: "We're local — not a call center, not a portal" },
            ].map(({ icon: Icon, label, note }) => (
              <div key={label} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-teal-400" />
                </div>
                <p className="text-white font-bold text-sm">{label}</p>
                <p className="text-white/40 text-xs">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE FORM ────────────────────────────────────── */}
      <section id="quote" className="py-16 bg-slate-950">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-3">Tell us what you need to move</p>
            <h2 className="text-3xl font-black text-white mb-2">Get a freight quote from a real person</h2>
            <p className="text-white/40 text-sm mb-8">Fill this out and someone from our team calls or texts you back — usually same day. No automated emails.</p>
            <QuoteForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
