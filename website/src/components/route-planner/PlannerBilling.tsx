'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { CheckCircle, CreditCard } from '@/components/icons/streamline-lucide'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

type PlanKey = 'free' | 'solo' | 'team' | 'business' | 'starter' | 'pro'

interface BillingStatus {
  plan: {
    key: PlanKey
    name: string
    monthlyRoutes: number | null
    maxStopsPerRoute: number
    maxDrivers: number | null
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
  usage: { routesUsed: number; routesLimit: number | null; activeRuns: number; driversLimit: number | null }
}

type PurchasablePlan = 'solo' | 'team' | 'business'

const planOptions: Array<{ key: 'free' | PurchasablePlan; name: string; price: string; detail: string; features: string[] }> = [
  { key: 'free', name: 'Free', price: '$0', detail: '5 route plans / month', features: ['1 driver on the road at a time', 'Up to 10 stops per route plan', 'Core optimization', 'Best for trying it out'] },
  { key: 'solo', name: 'Solo', price: '$19', detail: 'Unlimited route plans', features: ['1 driver on the road at a time', 'Up to 50 stops per route plan', 'Recurring routes', 'Live route sharing'] },
  { key: 'team', name: 'Team', price: '$49', detail: 'Unlimited route plans', features: ['Up to 3 drivers on the road at a time', 'Up to 100 stops per route plan', 'Recurring routes', 'Live route sharing'] },
  { key: 'business', name: 'Business', price: '$99', detail: 'Unlimited route plans', features: ['Up to 10 drivers on the road at a time', 'Up to 100 stops per route plan', 'Recurring routes', 'Live route sharing'] },
]

const enterpriseMail = 'mailto:infos@drivedrop.us.com?subject=Route%20Planner%20Enterprise'

const statusLabels: Record<string, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Payment past due',
  unpaid: 'Payment failed',
  incomplete: 'Payment incomplete',
  incomplete_expired: 'Payment expired',
  paused: 'Paused',
  canceled: 'Canceled',
}

const statusLabel = (status: string) => statusLabels[status] ?? status.replace(/_/g, ' ')

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
  const isLegacyPlan = billing.plan.key === 'starter' || billing.plan.key === 'pro'
  const hasSubscription = Boolean(billing.stripeSubscriptionId) && ['active', 'trialing', 'past_due'].includes(billing.status)

  return (
    <div className="mt-5 space-y-5">
      {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {billing.isLocked && <div className="border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">Route changes are locked because payment failed. Open billing to update your payment method.</div>}

      <section className="border border-[#c6d4d2] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase text-[#008c82]">Current plan</p><h2 className="mt-1 text-2xl font-semibold">{billing.plan.name}</h2><p className="mt-1 text-sm text-[#667b79]">{statusLabel(billing.status)}{billing.cancelAtPeriodEnd ? ' · cancels at period end' : ''}</p></div>
          {billing.stripeCustomerId && <button onClick={() => void redirect('/planner-billing/portal')} disabled={busy} className="flex h-10 items-center gap-2 border border-[#008c82] px-3 text-sm font-semibold text-[#00756d] disabled:opacity-50"><CreditCard className="h-4 w-4" />Manage billing</button>}
        </div>
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-sm"><span>Route plans this month</span><strong>{billing.usage.routesLimit === null ? `${billing.usage.routesUsed} (unlimited)` : `${billing.usage.routesUsed} / ${billing.usage.routesLimit}`}</strong></div>
            {billing.usage.routesLimit !== null && <div className="mt-2 h-2 bg-[#e1e9e7]"><div className="h-full bg-[#008c82]" style={{ width: `${usagePercent}%` }} /></div>}
          </div>
          <div className="flex justify-between text-sm"><span>Drivers on the road now</span><strong>{billing.usage.driversLimit === null ? `${billing.usage.activeRuns} (no limit)` : `${billing.usage.activeRuns} / ${billing.usage.driversLimit}`}</strong></div>
          {billing.trialEndsAt && billing.status === 'trialing' && <p className="text-xs text-[#667b79]">{billing.plan.name} trial ends {new Date(billing.trialEndsAt).toLocaleDateString()}.</p>}
          {isLegacyPlan && <p className="text-xs text-[#667b79]">{billing.plan.name} is a legacy plan. It stays as it is while you are subscribed. New plans are Solo, Team and Business.</p>}
        </div>
      </section>

      <p className="text-sm text-[#667b79]">A route plan is one saved sequence of stops for one vehicle. Free includes 5 a month; paid plans have no limit, and re-optimizing, dispatching, or repeating a saved route never uses another one. A driver is one route running at the same time.</p>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {planOptions.map(plan => <article key={plan.key} className={`border bg-white p-5 ${billing.plan.key === plan.key ? 'border-[#008c82]' : 'border-[#c6d4d2]'}`}>
          <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{plan.name}</h3>{billing.plan.key === plan.key && <span className="text-xs font-bold uppercase text-[#00756d]">Current</span>}</div>
          <p className="mt-3 text-3xl font-semibold">{plan.price}<span className="text-sm font-normal text-[#667b79]"> / month</span></p>
          <p className="mt-1 text-sm text-[#667b79]">{plan.detail}</p>
          <div className="mt-4 space-y-2">{plan.features.map(feature => <p key={feature} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-[#008c82]" />{feature}</p>)}</div>
          {plan.key !== 'free' && billing.plan.key !== plan.key && (hasSubscription
            ? <button onClick={() => void redirect('/planner-billing/portal')} disabled={busy} className="mt-5 h-10 w-full border border-[#173f40] px-3 text-sm font-bold text-[#173f40] disabled:opacity-50">Change plan</button>
            : <button onClick={() => void redirect('/planner-billing/checkout', { planKey: plan.key })} disabled={busy} className="mt-5 h-10 w-full bg-[#173f40] px-3 text-sm font-bold text-white disabled:opacity-50">Choose {plan.name}</button>)}
        </article>)}
        <article className="border border-[#c6d4d2] bg-white p-5">
          <h3 className="text-lg font-semibold">Enterprise</h3>
          <p className="mt-3 text-3xl font-semibold">Custom</p>
          <p className="mt-1 text-sm text-[#667b79]">For more than 10 drivers</p>
          <div className="mt-4 space-y-2">{['Driver and stop limits set for your fleet', 'Direct support from our team'].map(feature => <p key={feature} className="flex items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-[#008c82]" />{feature}</p>)}</div>
          <a href={enterpriseMail} className="mt-5 grid h-10 w-full place-items-center border border-[#173f40] px-3 text-sm font-bold text-[#173f40]">Contact us</a>
        </article>
      </section>

      {billing.stripeSubscriptionId && !billing.cancelAtPeriodEnd && <button onClick={() => void cancel()} disabled={busy} className="text-sm font-semibold text-[#9f4740] disabled:opacity-50">Cancel at period end</button>}
    </div>
  )
}
