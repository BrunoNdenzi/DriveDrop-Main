'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Link2, Loader2, Mail, Send, Unlink } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createQuickSendBatch,
  disconnectQuickSendGmail,
  getGmailAuthorizationUrl,
  getQuickSendConnection,
  listQuickSendBatches,
  listQuickSendRecipients,
  type QuickSendBatch,
  type QuickSendRecipient,
  type QuickSendRecipientInput,
} from '@/lib/api/quick-send'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseRecipients(value: string): { recipients: QuickSendRecipientInput[]; invalid: string[] } {
  const recipients = new Map<string, QuickSendRecipientInput>()
  const invalid: string[] = []

  for (const rawEntry of value.split(/[\n,;]+/)) {
    const entry = rawEntry.trim()
    if (!entry) continue
    const namedMatch = entry.match(/^(.+?)\s*<([^<>]+)>$/)
    const email = (namedMatch?.[2] || entry).trim().toLowerCase()
    const name = namedMatch?.[1].trim().replace(/^['"]|['"]$/g, '')
    if (!emailPattern.test(email)) {
      invalid.push(entry)
      continue
    }
    if (!recipients.has(email)) recipients.set(email, { email, ...(name && { name }) })
  }

  return { recipients: [...recipients.values()], invalid }
}

function statusClass(status: QuickSendBatch['status'] | QuickSendRecipient['status']) {
  if (status === 'completed' || status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'failed' || status === 'partial_failed') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'suppressed') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

export default function QuickSendPage() {
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState(false)
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [category, setCategory] = useState('General outreach')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [recipientText, setRecipientText] = useState('')
  const [pacingSeconds, setPacingSeconds] = useState(3)
  const [batches, setBatches] = useState<QuickSendBatch[]>([])
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [recipientHistory, setRecipientHistory] = useState<Record<string, QuickSendRecipient[]>>({})
  const parsed = parseRecipients(recipientText)

  async function refresh() {
    const [connection, history] = await Promise.all([
      getQuickSendConnection(),
      listQuickSendBatches(),
    ])
    setConnected(connection.connected)
    setBatches(history.batches)
    setConnectionLoading(false)
  }

  useEffect(() => {
    refresh().catch(error => {
      setConnectionLoading(false)
      toast.error(error instanceof Error ? error.message : 'Unable to load Quick Send')
    })
  }, [])

  useEffect(() => {
    const gmailStatus = searchParams.get('gmail')
    if (gmailStatus === 'connected') toast.success('infos@calkons.com connected')
    if (gmailStatus === 'error') toast.error('Gmail authorization failed. Sign in with infos@calkons.com.')
  }, [searchParams])

  useEffect(() => {
    if (!batches.some(batch => batch.status === 'queued' || batch.status === 'sending')) return
    const timer = window.setInterval(() => {
      listQuickSendBatches().then(result => setBatches(result.batches)).catch(() => undefined)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [batches])

  async function connectGmail() {
    try {
      const { url } = await getGmailAuthorizationUrl()
      window.location.assign(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to start Gmail authorization')
    }
  }

  async function disconnectGmail() {
    if (!window.confirm('Disconnect infos@calkons.com from Quick Send?')) return
    await disconnectQuickSendGmail()
    setConnected(false)
    toast.success('Gmail disconnected')
  }

  async function sendBatch(event: React.FormEvent) {
    event.preventDefault()
    if (!connected) return toast.error('Connect infos@calkons.com first')
    if (parsed.invalid.length) return toast.error(`Fix ${parsed.invalid.length} invalid recipient entr${parsed.invalid.length === 1 ? 'y' : 'ies'}`)
    if (!parsed.recipients.length) return toast.error('Add at least one recipient')
    if (!window.confirm(`Queue ${parsed.recipients.length} email${parsed.recipients.length === 1 ? '' : 's'} from infos@calkons.com?`)) return

    setSending(true)
    try {
      const batch = await createQuickSendBatch({ category, subject, message, recipients: parsed.recipients, pacingSeconds })
      toast.success(`${batch.totalCount - batch.suppressedCount} emails queued${batch.suppressedCount ? `; ${batch.suppressedCount} suppressed` : ''}`)
      setSubject('')
      setMessage('')
      setRecipientText('')
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to queue batch')
    } finally {
      setSending(false)
    }
  }

  async function toggleBatch(batchId: string) {
    if (expandedBatch === batchId) return setExpandedBatch(null)
    setExpandedBatch(batchId)
    if (!recipientHistory[batchId]) {
      const result = await listQuickSendRecipients(batchId)
      setRecipientHistory(current => ({ ...current, [batchId]: result.recipients }))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">Batch outreach</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Quick Send</h1>
          <p className="mt-2 text-sm text-gray-600">Send branded, paced email batches to pasted recipient lists.</p>
        </div>
        <div className={`flex items-center gap-3 border px-4 py-3 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {connectionLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" /> : connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">infos@calkons.com</p>
            <p className="text-xs text-gray-600">{connected ? 'Gmail connected' : 'Authorization required'}</p>
          </div>
          {!connectionLoading && (connected ? (
            <button type="button" onClick={disconnectGmail} title="Disconnect Gmail" className="ml-2 p-2 text-gray-500 hover:text-red-600"><Unlink className="h-4 w-4" /></button>
          ) : (
            <button type="button" onClick={connectGmail} className="ml-2 inline-flex items-center gap-2 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"><Link2 className="h-4 w-4" /> Connect</button>
          ))}
        </div>
      </div>

      <form onSubmit={sendBatch} className="border border-gray-200 bg-white">
        <div className="grid lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-5 border-b border-gray-200 p-6 lg:border-b-0 lg:border-r">
            <div>
              <label htmlFor="quick-send-category" className="mb-2 block text-sm font-semibold text-gray-800">Category</label>
              <input id="quick-send-category" value={category} onChange={event => setCategory(event.target.value)} maxLength={80} required className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
            </div>
            <div>
              <label htmlFor="quick-send-recipients" className="mb-2 block text-sm font-semibold text-gray-800">Recipients</label>
              <textarea id="quick-send-recipients" value={recipientText} onChange={event => setRecipientText(event.target.value)} rows={13} placeholder={'alex@example.com\nTaylor Reed <taylor@example.com>'} required className="w-full resize-y border border-gray-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
              <div className="mt-2 flex justify-between text-xs">
                <span className={parsed.invalid.length ? 'text-red-600' : 'text-gray-500'}>{parsed.invalid.length ? `${parsed.invalid.length} invalid` : 'Duplicates removed automatically'}</span>
                <span className="font-semibold text-gray-700">{parsed.recipients.length} unique</span>
              </div>
            </div>
            <div>
              <label htmlFor="quick-send-pacing" className="mb-2 block text-sm font-semibold text-gray-800">Seconds between emails</label>
              <input id="quick-send-pacing" type="number" min={1} max={300} value={pacingSeconds} onChange={event => setPacingSeconds(Number(event.target.value))} className="w-28 border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600" />
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label htmlFor="quick-send-subject" className="mb-2 block text-sm font-semibold text-gray-800">Subject</label>
              <input id="quick-send-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={200} required className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
            </div>
            <div>
              <label htmlFor="quick-send-message" className="mb-2 block text-sm font-semibold text-gray-800">Message</label>
              <textarea id="quick-send-message" value={message} onChange={event => setMessage(event.target.value)} rows={15} required className="w-full resize-y border border-gray-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-500">Branding and unsubscribe link are added automatically.</p>
              <button type="submit" disabled={sending || !connected} className="inline-flex h-11 items-center gap-2 bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Queue batch
              </button>
            </div>
          </div>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-center gap-2"><Mail className="h-5 w-5 text-gray-500" /><h2 className="text-lg font-bold text-gray-950">Send history</h2></div>
        <div className="overflow-hidden border border-gray-200 bg-white">
          {batches.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">No Quick Send batches yet.</p>
          ) : batches.map(batch => (
            <div key={batch.id} className="border-b border-gray-100 last:border-b-0">
              <button type="button" onClick={() => toggleBatch(batch.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 text-left hover:bg-gray-50 sm:grid-cols-[1fr_150px_240px_24px]">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-950">{batch.subject}</p><p className="mt-1 text-xs text-gray-500">{batch.category} · {new Date(batch.created_at).toLocaleString()}</p></div>
                <span className={`w-fit border px-2 py-1 text-xs font-semibold capitalize ${statusClass(batch.status)}`}>{batch.status.replace('_', ' ')}</span>
                <p className="hidden text-right text-xs text-gray-600 sm:block">{batch.sent_count} sent · {batch.failed_count} failed · {batch.suppressed_count} suppressed</p>
                {expandedBatch === batch.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedBatch === batch.id && (
                <div className="overflow-x-auto border-t border-gray-100 bg-gray-50 p-4">
                  <table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-xs uppercase text-gray-500"><th className="pb-3">Recipient</th><th className="pb-3">Status</th><th className="pb-3">Sent</th><th className="pb-3">Details</th></tr></thead><tbody>{(recipientHistory[batch.id] || []).map(recipient => <tr key={recipient.id} className="border-t border-gray-200"><td className="py-3"><span className="font-medium text-gray-900">{recipient.name || recipient.email}</span>{recipient.name && <span className="ml-2 text-xs text-gray-500">{recipient.email}</span>}</td><td className="py-3"><span className={`border px-2 py-1 text-xs font-semibold capitalize ${statusClass(recipient.status)}`}>{recipient.status}</span></td><td className="py-3 text-xs text-gray-600">{recipient.sent_at ? new Date(recipient.sent_at).toLocaleString() : '—'}</td><td className="max-w-xs truncate py-3 text-xs text-red-600">{recipient.error_message || recipient.gmail_message_id || '—'}</td></tr>)}</tbody></table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}