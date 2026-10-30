'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { AlertTriangle, CheckCircle, Loader2, Route } from '@/components/icons/streamline-lucide'

const SUPPORT_EMAIL = 'infos@drivedrop.us.com'
const CONFIRM_PHRASE = 'DELETE MY ACCOUNT'
const MAIL_LINK = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my Route Planner account')}`

export default function PlannerAccountDeletionPage() {
  const supabase = getSupabaseBrowserClient()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [supabase])

  const submit = async () => {
    setError('')
    if (confirmText !== CONFIRM_PHRASE) {
      setError(`Type ${CONFIRM_PHRASE} to confirm.`)
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Your session expired. Sign in again.')
      const response = await fetch('/api/account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reason, product: 'route-planner' }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) throw new Error(body.error?.message || 'Could not submit your request')
      await supabase.auth.signOut()
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="border-b border-[#bfd0cd] bg-[#123638] text-white">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-3 px-4">
          <Route className="h-6 w-6 text-[#66d3c8]" />
          <p className="font-semibold">DriveDrop Route Planner</p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Delete your account</h1>
        <p className="mt-2 text-sm text-[#526c6b]">Request permanent deletion of your Route Planner account and the data in it.</p>

        {done ? (
          <section className="mt-6 border border-[#a7d8c5] bg-[#edf9f3] p-5 text-[#17603f]" role="status">
            <p className="flex items-center gap-2 font-semibold"><CheckCircle className="h-5 w-5" />Request received</p>
            <p className="mt-2 text-sm">We will review it and delete your account within 7 business days. You are signed out and cannot sign in again while it is reviewed. We will email you when it is done.</p>
            <Link href="/login?redirect=/route-planner" className="mt-4 inline-block text-sm font-semibold underline">Back to sign in</Link>
          </section>
        ) : (
          <>
            <section className="mt-6 border border-[#c6d4d2] bg-white p-5">
              <h2 className="font-semibold">What happens</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#3c5655]">
                <li>Your account, saved routes, address book and run history are deleted.</li>
                <li>Delivery proof (photos, signatures, notes) is deleted.</li>
                <li>Any paid subscription is cancelled. We may keep payment records where the law requires it.</li>
                <li>It can&apos;t be undone. Your account is locked while we review the request, which takes up to 7 business days.</li>
              </ul>
            </section>

            {email === undefined && <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#008c82]" /></div>}

            {email === null && (
              <section className="mt-6 border border-[#c6d4d2] bg-white p-5">
                <h2 className="font-semibold">Sign in to request deletion</h2>
                <p className="mt-2 text-sm text-[#526c6b]">Sign in with the account you want to delete.</p>
                <Link href="/login?redirect=/route-planner/account-deletion" className="mt-4 grid h-11 place-items-center bg-[#008c82] px-4 text-sm font-bold text-white hover:bg-[#00756d]">Sign in</Link>
              </section>
            )}

            {email && (
              <section className="mt-6 border border-[#e5b8b4] bg-white p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#9f2f27]"><AlertTriangle className="h-5 w-5" />Deleting {email}</p>
                {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-semibold">Reason (optional)</span>
                  <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} className="w-full border border-[#b9c9c7] px-3 py-2 text-sm outline-none focus:border-[#008c82]" />
                </label>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-semibold">Type {CONFIRM_PHRASE} to confirm</span>
                  <input value={confirmText} onChange={event => setConfirmText(event.target.value)} autoComplete="off" className="h-11 w-full border border-[#b9c9c7] px-3 text-sm outline-none focus:border-[#008c82]" />
                </label>
                <button onClick={() => void submit()} disabled={busy || confirmText !== CONFIRM_PHRASE} className="mt-5 flex h-11 w-full items-center justify-center gap-2 bg-[#b3362d] px-4 text-sm font-bold text-white hover:bg-[#9f2f27] disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting</> : 'Request account deletion'}
                </button>
                <Link href="/route-planner" className="mt-3 block text-center text-sm font-semibold text-[#007b72] hover:underline">Keep my account</Link>
              </section>
            )}

            <p className="mt-6 text-sm text-[#526c6b]">Can&apos;t sign in? Email <a href={MAIL_LINK} className="font-semibold text-[#007b72] underline">{SUPPORT_EMAIL}</a> from the address on your account and we will delete it for you.</p>
          </>
        )}
      </div>
    </main>
  )
}
