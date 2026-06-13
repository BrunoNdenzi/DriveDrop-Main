'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import {
  ShieldCheck, Lock, CheckCircle, Layers, TreePine, Package, Truck, ArrowLeft
} from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const SERVICE_LABELS: Record<string, string> = {
  tiles: 'Tile Supply & Delivery',
  'tree-removal': 'Tree Removal',
  delivery: 'Local Van Delivery',
  freight: 'Freight Forwarding',
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  tiles: Layers,
  'tree-removal': TreePine,
  delivery: Package,
  freight: Truck,
}

const SERVICE_COLORS: Record<string, string> = {
  tiles: '#f59e0b',
  'tree-removal': '#22c55e',
  delivery: '#3b82f6',
  freight: '#14b8a6',
}

// ── CHECKOUT FORM ────────────────────────────────────────
function CheckoutForm({
  amount,
  service,
  ref: bookingRef,
}: {
  amount: number
  service: string
  ref: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setStatus('processing')
    setErrorMsg('')

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message ?? 'Payment failed. Please try again.')
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      // Send confirmation email (non-fatal)
      try {
        await fetch('/api/services/payment-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            email,
            name,
            ref: bookingRef,
            service: SERVICE_LABELS[service] ?? service,
            amount: (amount / 100).toFixed(2),
          }),
        })
      } catch {
        // ignore
      }
      // Redirect to success state via URL
      window.location.href = `/services/pay?paid=1&ref=${encodeURIComponent(bookingRef)}&service=${encodeURIComponent(service)}`
    }
  }

  const accent = SERVICE_COLORS[service] ?? '#3b82f6'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Full name *</label>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Smith"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Email *</label>
          <input
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2">Card details</label>
        <div className="bg-white/5 border border-white/15 rounded-xl px-4 py-4">
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: { billingDetails: { name: 'never', email: 'never' } },
            }}
          />
        </div>
      </div>

      {status === 'error' && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || status === 'processing'}
        className="w-full font-bold py-4 rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-sm disabled:opacity-60 text-black"
        style={{ backgroundColor: accent }}
      >
        {status === 'processing' ? (
          'Processing…'
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Pay ${(amount / 100).toFixed(2)} now
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Secured by Stripe · PCI compliant</span>
      </div>
    </form>
  )
}

// ── INNER PAGE (uses useSearchParams) ────────────────────
function PayPageInner() {
  const searchParams = useSearchParams()

  const amountParam = searchParams.get('amount')   // cents e.g. 25000
  const ref = searchParams.get('ref') ?? ''
  const service = searchParams.get('service') ?? 'tiles'
  const isPaid = searchParams.get('paid') === '1'

  const amount = Number(amountParam)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const ServiceIcon = SERVICE_ICONS[service] ?? Layers
  const accentColor = SERVICE_COLORS[service] ?? '#f59e0b'
  const serviceLabel = SERVICE_LABELS[service] ?? service

  useEffect(() => {
    if (isPaid || !amount || !ref || !service) return
    fetch('/api/services/payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, ref, service }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.clientSecret) setClientSecret(data.clientSecret)
        else setLoadError(true)
      })
      .catch(() => setLoadError(true))
  }, [amount, ref, service, isPaid])

  // ── PAID SUCCESS ─────────────────────────────────────
  if (isPaid) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3">Payment confirmed!</h1>
          <p className="text-white/50 mb-2">Booking reference: <span className="text-white font-mono font-bold">{ref}</span></p>
          <p className="text-white/40 text-sm mb-8">A confirmation has been sent to your email. We&apos;ll be in touch to coordinate.</p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to services
          </Link>
        </div>
      </div>
    )
  }

  // ── MISSING PARAMS ───────────────────────────────────
  if (!amount || !ref) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-white/50 mb-4">Invalid payment link. Please contact us to get a valid payment URL.</p>
          <a
            href="tel:+17042662317"
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm"
          >
            Call (704) 266-2317
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/services">
            <Image src="/logo-primary.png" alt="DriveDrop" width={140} height={35} className="h-8 w-auto brightness-0 invert" />
          </Link>
        </div>

        {/* Order summary */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
            >
              <ServiceIcon className="h-5 w-5" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Service</p>
              <p className="text-white font-bold">{serviceLabel}</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-0.5">Reference</p>
              <p className="text-white font-mono text-sm">{ref}</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-0.5">Total due</p>
              <p className="text-3xl font-black" style={{ color: accentColor }}>
                ${(amount / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Stripe checkout */}
        {loadError ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 text-red-400 text-sm text-center">
            Failed to load checkout. Please call us at (704) 266-2317.
          </div>
        ) : clientSecret ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: accentColor,
                    colorBackground: '#0f172a',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <CheckoutForm amount={amount} service={service} ref={ref} />
            </Elements>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/40 text-sm">Loading secure checkout…</p>
          </div>
        )}

      </div>
    </div>
  )
}

// ── PAGE EXPORT (Suspense boundary required for useSearchParams) ──
export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      }
    >
      <PayPageInner />
    </Suspense>
  )
}
