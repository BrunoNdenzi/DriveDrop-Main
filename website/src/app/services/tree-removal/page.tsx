'use client'

import { useState } from 'react'
import Link from 'next/link'
import ServicesHeader from '@/components/layout/ServicesHeader'
import Footer from '@/components/layout/Footer'
import {
  TreePine, Phone, ArrowRight, CheckCircle,
  ArrowLeft, ShieldCheck, Axe, Leaf, AlertTriangle
} from 'lucide-react'

// ── SERVICES LIST ────────────────────────────────────────
const SERVICES = [
  { icon: TreePine, label: 'Full Tree Removal', desc: 'Complete removal including trunk, branches, and hauling away all debris.' },
  { icon: Axe, label: 'Stump Grinding', desc: 'Grind stumps below grade so you can sod, plant, or build over the area.' },
  { icon: Leaf, label: 'Tree Trimming & Pruning', desc: 'Shape, lighten, and maintain your trees for health and curb appeal.' },
  { icon: AlertTriangle, label: 'Emergency Removal', desc: 'Storm damage, fallen trees, immediate hazard — we respond fast.' },
]

// ── LEAD FORM ─────────────────────────────────────────────
function QuoteForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', treeCount: '', message: '' })
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
          service: 'tree-removal',
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          message: form.message || undefined,
          extras: form.treeCount ? { trees_approx: form.treeCount } : undefined,
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
      <div className="rounded-2xl bg-green-950/40 border border-green-500/20 p-10 text-center">
        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-2xl font-black text-white mb-2">We've got your request!</h3>
        <p className="text-white/50">We'll call you back to schedule a free assessment.</p>
        <a href="tel:+17042662317" className="text-green-400 font-bold mt-3 inline-block text-lg">+1 (704) 266-2317</a>
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
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/60 transition-colors"
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
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/60 transition-colors"
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
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Approx. # of Trees</label>
          <input
            type="number"
            min="1"
            value={form.treeCount}
            onChange={e => update('treeCount', e.target.value)}
            placeholder="e.g. 3"
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Describe your situation</label>
        <textarea
          rows={4}
          value={form.message}
          onChange={e => update('message', e.target.value)}
          placeholder="Tree sizes, location, hazards, access, timeframe..."
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/60 transition-colors resize-none"
        />
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">Something went wrong. Call us: +1 (704) 266-2317.</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
      >
        {status === 'sending' ? 'Sending...' : (
          <>Request Free Assessment <ArrowRight className="h-4 w-4" /></>
        )}
      </button>

      <p className="text-center text-white/30 text-xs">
        Or call/text: <a href="tel:+17042662317" className="text-green-400">+1 (704) 266-2317</a>
      </p>
    </form>
  )
}

// ── PAGE ─────────────────────────────────────────────────
export default function TreeRemovalPage() {
  return (
    <main className="min-h-screen bg-background">
      <ServicesHeader />

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 pt-[68px]">

        {/* Green glow */}
        <div className="pointer-events-none absolute top-0 right-0 w-[600px] h-[500px] rounded-full bg-green-500/8 blur-[140px]" />

        {/* Texture grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Background word */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden select-none pr-4">
          <span className="text-[18vw] font-black text-white/[0.02] leading-none tracking-tighter whitespace-nowrap" aria-hidden>
            TREES
          </span>
        </div>

        <div className="container relative z-10">
          <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-8 mt-8 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            All services
          </Link>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1.5 mb-6">
              <ShieldCheck className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs font-bold text-green-400 tracking-widest uppercase">Licensed Contractor · Charlotte, NC</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[0.92] tracking-tight mb-6">
              We cut it.<br />
              <span className="text-green-400">We haul it.</span><br />
              <span className="text-white/30 text-4xl lg:text-5xl">Done.</span>
            </h1>

            <p className="text-white/50 text-lg leading-relaxed mb-8 max-w-xl">
              Full tree removal, stump grinding, trimming, and emergency service. Licensed, insured, and local. Serving Charlotte and surrounding areas.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="tel:+17042662317"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-4 rounded-xl transition-all hover:scale-[1.02] text-sm"
              >
                <Phone className="h-4 w-4" />
                +1 (704) 266-2317
              </a>
              <a
                href="#quote"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-6 py-4 rounded-xl transition-all text-sm hover:bg-white/5"
              >
                Free assessment
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ───────────────────────────────────── */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="mb-10">
            <p className="text-green-500 text-xs font-bold tracking-widest uppercase mb-2">Services</p>
            <h2 className="text-3xl font-black text-foreground">What we handle</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map(svc => {
              const Icon = svc.icon
              return (
                <div key={svc.label} className="group rounded-2xl bg-slate-50 dark:bg-slate-900 border border-border hover:border-green-500/30 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                    <Icon className="h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{svc.label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{svc.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Credentials bar */}
          <div className="mt-10 rounded-2xl bg-green-950/30 border border-green-500/20 px-8 py-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-green-400 shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">Licensed &amp; Insured</p>
                <p className="text-white/40 text-xs">Charlotte, North Carolina</p>
              </div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div>
              <p className="font-bold text-white text-sm">All debris removed</p>
              <p className="text-white/40 text-xs">Clean site every time</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/10" />
            <div>
              <p className="font-bold text-white text-sm">Pricing</p>
              <p className="text-white/40 text-xs">Per job — call for estimate</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUOTE FORM ───────────────────────────────────── */}
      <section id="quote" className="py-20 bg-slate-950">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <p className="text-green-400 text-xs font-bold tracking-widest uppercase mb-3 text-center">Free assessment</p>
            <h2 className="text-4xl font-black text-white mb-3 text-center">Get a quote</h2>
            <p className="text-white/40 text-center mb-10">Tell us about your trees. We'll schedule a quick look and give you a real number — no obligation.</p>

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
