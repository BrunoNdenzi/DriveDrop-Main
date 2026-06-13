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
  Globe, Route, FileText, Clock
} from 'lucide-react'

// ── LEAD FORM ─────────────────────────────────────────────
function QuoteForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', freightType: '', weight: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    try {
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
          placeholder="e.g. Charlotte, NC → Atlanta, GA — 5 pallets of flooring, needs liftgate"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-teal-500/60 transition-colors resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">Something went wrong. Call us at (704) 266-2317.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm"
      >
        {status === 'sending' ? 'Sending…' : (
          <>
            Request freight quote
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
              <span className="text-xs font-bold text-teal-400 tracking-widest uppercase">FF Licensed · Charlotte, NC</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[0.92] tracking-tight mb-6">
              We move it.<br />
              <span className="text-teal-400">We broker it.</span><br />
              <span className="text-white/30 text-4xl lg:text-5xl">You choose.</span>
            </h1>

            <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-xl">
              Freight Forwarder licensed. We haul in our own van for local loads — and connect you to trusted carriers for LTL and FTL shipments nationwide.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:+17042662317"
                className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-black font-bold px-7 py-4 rounded-xl transition-all hover:scale-[1.02] text-sm"
              >
                <Phone className="h-4 w-4" />
                +1 (704) 266-2317
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

            {/* Own Van */}
            <div className="rounded-2xl bg-white/4 border border-teal-500/20 p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-500/15 mb-5">
                <Truck className="h-6 w-6 text-teal-400" />
              </div>
              <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-2">We Move It</p>
              <h2 className="text-2xl font-black text-white mb-3">Our own van</h2>
              <p className="text-white/50 mb-6 text-sm leading-relaxed">
                For local and regional loads, we handle pickup and delivery ourselves. No middlemen, no handoffs — one point of contact from door to door.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'Charlotte metro + regional hauls',
                  'Furniture, pallets, oversized items',
                  'Same-day and next-day available',
                  'Liftgate available on request',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-teal-500/8 border border-teal-500/15 px-4 py-3 flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-teal-400 shrink-0" />
                <span className="text-teal-300/80 text-xs font-semibold">Charlotte, NC and surrounding areas</span>
              </div>
            </div>

            {/* Broker */}
            <div className="rounded-2xl bg-white/4 border border-blue-500/20 p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/15 mb-5">
                <Globe className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-2">We Broker It</p>
              <h2 className="text-2xl font-black text-white mb-3">Carrier network</h2>
              <p className="text-white/50 mb-6 text-sm leading-relaxed">
                For long-haul, LTL, or FTL needs, we source the right carrier from our vetted network. You get one quote, one invoice, and we manage the logistics.
              </p>
              <ul className="space-y-2.5 mb-6">
                {[
                  'LTL and FTL nationwide',
                  'Vetted, insured carrier partners',
                  'Single point of contact',
                  'Real-time shipment updates',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 px-4 py-3 flex items-center gap-2.5">
                <Route className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-blue-300/80 text-xs font-semibold">Nationwide coverage · LTL &amp; FTL</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── WHO WE SERVE ──────────────────────────────────── */}
      <section className="py-14 bg-slate-950">
        <div className="container">
          <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-3">Who we serve</p>
          <h2 className="text-3xl font-black text-white mb-10 max-w-lg">Built for businesses and individuals moving real cargo.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Building2, label: 'Businesses', note: 'Inventory, equipment, B2B shipments' },
              { icon: Briefcase, label: 'Contractors', note: 'Job-site deliveries, materials, tools' },
              { icon: Package, label: 'E-commerce sellers', note: 'Overflow stock, marketplace pickups' },
              { icon: Users, label: 'Individuals', note: 'Moving large items, estate goods' },
              { icon: ShieldCheck, label: 'Importers', note: 'Domestic leg after port arrival' },
              { icon: FileText, label: 'Brokers & 3PLs', note: 'Capacity overflow, spot loads' },
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
              { icon: ScrollText, label: 'FF Licensed', note: 'Freight Forwarder license — verifiable' },
              { icon: ShieldCheck, label: 'Fully Insured', note: 'Cargo + liability coverage' },
              { icon: Clock, label: 'Fast Quotes', note: 'Response within a few hours' },
              { icon: Truck, label: 'Own Asset', note: 'We drive, no subcontract on local' },
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
            <p className="text-teal-400 text-xs font-bold tracking-widest uppercase mb-3">Get started</p>
            <h2 className="text-3xl font-black text-white mb-2">Request a freight quote</h2>
            <p className="text-white/40 text-sm mb-8">No commitment — just tell us what you need to move and we&apos;ll get back to you fast.</p>
            <QuoteForm />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
