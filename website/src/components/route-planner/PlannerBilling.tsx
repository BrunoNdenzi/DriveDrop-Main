'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { CheckCircle, CreditCard } from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

type PlanKey = 'free' | 'starter' | 'pro'

interface BillingStatus {
  plan: {
    key: PlanKey
    name: string
    monthlyRoutes: number | null
    maxStopsPerRoute: number
    recurringRoutes: boolean
    routeSharing: boolean
  }
  status: string
  isLocked: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  usage: { routesUsed: number; routesLimit: number | null }
}

const planOptions = [
  { key: 'free' as const, name: 'Free', price: '$0', detail: '5 routes / month', features: ['10 stops per route', 'Core optimization'] },
  { key: 'starter' as const, name: 'Starter', price: '$29', detail: '100 routes / month', features: ['50 stops per route', 'Recurring routes', 'Live route sharing'] },
  { key: 'pro' as const, name: 'Pro', price: '$79', detail: 'Unlimited routes', features: ['100 stops per route', 'Recurring routes', 'Live route sharing'] },
]

export default function PlannerBilling() {
  const supabase = getSupabaseBrowserClient()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const api = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
    const response = await fetch(`${API_BASE_URL}/payments${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init?.headers },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Billing request failed')
    return body.data as T
  }, [supabase])

  const refresh = useCallback(async () => {
    try {
      setBilling(await api<BillingStatus>('/planner-billing'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load billing')
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const redirect = async (path: string, body?: object) => {
    setBusy(true)
    setError('')
    try {
      const result = await api<{ url: string }>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
      window.location.assign(result.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open billing')
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    setError('')
    try {
      setBilling(await api<BillingStatus>('/planner-billing/cancel', { method: 'POST', body: '{}' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to cancel subscription')
    } finally {
      setBusy(false)
    }
  }

  if (!billing) return <div className="mt-5 border border-[#c6d4d2] bg-white p-8 text-sm text-[#667b79]">Loading billing...</div>

  const usagePercent = billing.usage.routesLimit === null ? 0 : Math.min(100, billing.usage.routesUsed / billing.usage.routesLimit * 100)

  return (
    <div className="mt-5 space-y-5">
      {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {billing.isLocked && <div className="border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">Route changes are locked because payment failed. Open billing to update your payment method.</div>}

      <section className="border border-[#c6d4d2] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase text-[#008c82]">Current plan</p><h2 className="mt-1 text-2xl font-semibold">{billing.plan.name}</h2><p className="mt-1 text-sm text-[#667b79]">{billing.status}{billing.cancelAtPeriodEnd ? ' · cancels at period end' : ''}</p></div>
          {billing.stripeCustomerId && <button onClick={() => void redirect('/planner-billing/portal')} disabled={busy} className="flex h-10 items-center gap-2 border border-[#008c82] px-3 text-sm font-semibold text-[#00756d] disabled:opacity-50"><CreditCard className="h-4 w-4" />Manage billing</button>}
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm"><span>Routes this month</span><strong>{billing.usage.routesUsed} / {billing.usage.routesLimit ?? 'Unlimited'}</strong></div>
          {billing.usage.routesLimit !== null && <div className="mt-2 h-2 bg-[#e1e9e7]"><div className="h-full bg-[#008c82]" style={{ width: `${usagePercent}%` }} /></div>}
          {billing.trialEndsAt && billing.status === 'trialing' && <p className="mt-3 text-xs text-[#667b79]">Starter trial ends {new Date(billing.trialEndsAt).toLocaleDateString()}.</p>}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {planOptions.map(plan => <article key={plan.key} className={`border bg-white p-5 ${billing.plan.key === plan.key ? 'border-[#008c82]' : 'border-[#c6d4d2]'}`}>
          <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{plan.name}</h3>{billing.plan.key === plan.key && <span className="text-xs font-bold uppercase text-[#00756d]">Current</span>}</div>
          <p className="mt-3 text-3xl font-semibold">{plan.price}<span className="text-sm font-normal text-[#667b79]"> / month</span></p>
          <p className="mt-1 text-sm text-[#667b79]">{plan.detail}</p>
          <div className="mt-4 space-y-2">{plan.features.map(feature => <p key={feature} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-[#008c82]" />{feature}</p>)}</div>
          {plan.key !== 'free' && billing.plan.key !== plan.key && <button onClick={() => void redirect('/planner-billing/checkout', { planKey: plan.key })} disabled={busy} className="mt-5 h-10 w-full bg-[#173f40] px-3 text-sm font-bold text-white disabled:opacity-50">Choose {plan.name}</button>}
        </article>)}
      </section>

      {billing.stripeSubscriptionId && !billing.cancelAtPeriodEnd && <button onClick={() => void cancel()} disabled={busy} className="text-sm font-semibold text-[#9f4740] disabled:opacity-50">Cancel at period end</button>}
    </div>
  )
}
