'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Copy, FileText,
  Link2, Loader2, Mail, Sparkles, Upload, Users, Wand2, X, Send, Unlink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createQuickSendBatch,
  disconnectQuickSendGmail,
  generateContent,
  getGmailAuthorizationUrl,
  getQuickSendConnection,
  listQuickSendBatches,
  listQuickSendRecipients,
  listTemplates,
  parseCSV,
  parseTextInput,
  extractEmails,
  type ParsedRecipient,
  type QuickSendBatch,
  type QuickSendRecipient,
  type Template,
} from '@/lib/api/quick-send'

const CATEGORIES = [
  'Broker Outreach',
  'Driver Recruitment',
  'Logistics Update',
  'Partnership',
  'Marketing',
  'General Outreach',
]

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'sales', label: 'Sales' },
  { value: 'casual', label: 'Casual' },
] as const

function statusClass(status: QuickSendBatch['status'] | QuickSendRecipient['status']) {
  if (status === 'completed' || status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'failed' || status === 'partial_failed') return 'bg-red-50 text-red-700 border-red-200'
  if (status === 'suppressed') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
}

// ─── Placeholder highlighter ──────────────────────────────────────────────────
function extractPlaceholders(text: string): string[] {
  const matches = [...text.matchAll(/\{\{([^}]+)\}\}/g)]
  return [...new Set(matches.map(m => m[1]!))]
}

export default function QuickSendPage() {
  const searchParams = useSearchParams()

  // ── Connection ───────────────────────────────────────────────────────────────
  const [connected, setConnected] = useState(false)
  const [connectedMailbox, setConnectedMailbox] = useState('infos@calkons.com')
  const [connectionLoading, setConnectionLoading] = useState(true)

  // ── Recipients ───────────────────────────────────────────────────────────────
  const [recipientTab, setRecipientTab] = useState<'paste' | 'extract' | 'csv'>('paste')
  const [recipientText, setRecipientText] = useState('')
  const [recipients, setRecipients] = useState<ParsedRecipient[]>([])
  const [parsingLoading, setParsingLoading] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // ── Content ──────────────────────────────────────────────────────────────────
  const [category, setCategory] = useState('Broker Outreach')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [pacingSeconds, setPacingSeconds] = useState(3)

  // ── Templates ────────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplates, setShowTemplates] = useState(false)

  // ── AI Generation ────────────────────────────────────────────────────────────
  const [showAI, setShowAI] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiTone, setAiTone] = useState<typeof TONES[number]['value']>('professional')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMode, setAiMode] = useState<'generate' | 'rewrite'>('generate')

  // ── History ──────────────────────────────────────────────────────────────────
  const [batches, setBatches] = useState<QuickSendBatch[]>([])
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null)
  const [recipientHistory, setRecipientHistory] = useState<Record<string, QuickSendRecipient[]>>({})

  // ── Send ─────────────────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const [conn, history] = await Promise.all([
      getQuickSendConnection(),
      listQuickSendBatches(),
    ])
    setConnected(conn.connected)
    setConnectedMailbox(conn.mailbox)
    setBatches(history.batches)
    setConnectionLoading(false)
  }, [])

  useEffect(() => {
    refresh().catch(() => setConnectionLoading(false))
    listTemplates().then(r => setTemplates(r.templates)).catch(() => undefined)
  }, [refresh])

  useEffect(() => {
    const s = searchParams.get('gmail')
    if (s === 'connected') toast.success('Gmail connected')
    if (s === 'error') toast.error('Gmail authorization failed — sign in with infos@calkons.com')
  }, [searchParams])

  // Auto-refresh while a batch is in progress
  useEffect(() => {
    if (!batches.some(b => b.status === 'queued' || b.status === 'sending')) return
    const t = window.setInterval(() =>
      listQuickSendBatches().then(r => setBatches(r.batches)).catch(() => undefined), 4000)
    return () => window.clearInterval(t)
  }, [batches])

  // ── Gmail ────────────────────────────────────────────────────────────────────
  async function connectGmail() {
    try {
      const { url } = await getGmailAuthorizationUrl()
      window.location.assign(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to start Gmail authorization')
    }
  }

  async function disconnectGmail() {
    if (!window.confirm('Disconnect Gmail from Quick Send?')) return
    await disconnectQuickSendGmail()
    setConnected(false)
    toast.success('Gmail disconnected')
  }

  // ── Recipients ───────────────────────────────────────────────────────────────
  async function handleParseText() {
    if (!recipientText.trim()) return
    setParsingLoading(true)
    try {
      const fn = recipientTab === 'extract' ? extractEmails : parseTextInput
      const result = await fn(recipientText)
      const valid = result.recipients.filter(r => r.isValid)
      setRecipients(prev => {
        const seen = new Set(prev.map(r => r.email))
        const newOnes = valid.filter(r => !seen.has(r.email))
        return [...prev, ...newOnes]
      })
      toast.success(`${valid.length} recipients added${result.duplicateCount ? ` (${result.duplicateCount} duplicates skipped)` : ''}${result.invalidCount ? ` · ${result.invalidCount} invalid` : ''}`)
      setRecipientText('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Parsing failed')
    } finally {
      setParsingLoading(false)
    }
  }

  async function handleCSVFile(file: File) {
    setParsingLoading(true)
    try {
      const result = await parseCSV(file)
      const valid = result.recipients.filter(r => r.isValid)
      setRecipients(prev => {
        const seen = new Set(prev.map(r => r.email))
        const newOnes = valid.filter(r => !seen.has(r.email))
        return [...prev, ...newOnes]
      })
      toast.success(`${valid.length} recipients imported from ${file.name}${result.invalidCount ? ` · ${result.invalidCount} invalid` : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'CSV import failed')
    } finally {
      setParsingLoading(false)
    }
  }

  function removeRecipient(email: string) {
    setRecipients(prev => prev.filter(r => r.email !== email))
  }

  // ── Templates ────────────────────────────────────────────────────────────────
  function applyTemplate(t: Template) {
    setCategory(t.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    setSubject(t.subject)
    setMessage(t.message)
    setShowTemplates(false)
    toast.success(`Template "${t.name}" applied`)
  }

  // ── AI ───────────────────────────────────────────────────────────────────────
  async function handleAIGenerate() {
    if (aiMode === 'generate' && !aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const result = await generateContent(
        aiMode === 'rewrite'
          ? { type: 'rewrite', subject, body: message, tone: aiTone }
          : { type: 'both', prompt: aiPrompt, tone: aiTone, category }
      )
      if (result.subject) setSubject(result.subject)
      if (result.body) setMessage(result.body)
      toast.success('Content generated')
      setShowAI(false)
      setAiPrompt('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleAISubjectOnly() {
    if (!message.trim()) { toast.error('Write a message first'); return }
    setAiLoading(true)
    try {
      const result = await generateContent({ type: 'subject', prompt: message, tone: aiTone, category })
      if (result.subject) setSubject(result.subject)
      toast.success('Subject generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI generation failed')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  async function sendBatch(event: React.FormEvent) {
    event.preventDefault()
    if (!connected) return toast.error('Connect Gmail first')
    if (recipients.length === 0) return toast.error('Add at least one recipient')
    if (!window.confirm(`Send to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} from ${connectedMailbox}?`)) return

    setSending(true)
    try {
      const batch = await createQuickSendBatch({
        category, subject, message, pacingSeconds,
        recipients: recipients.map(r => ({ email: r.email, name: r.name, customFields: r.customFields })),
      })
      toast.success(`${batch.totalCount - batch.suppressedCount} emails queued${batch.suppressedCount ? ` · ${batch.suppressedCount} suppressed` : ''}`)
      setSubject('')
      setMessage('')
      setRecipients([])
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to queue batch')
    } finally {
      setSending(false)
    }
  }

  async function toggleBatch(id: string) {
    if (expandedBatch === id) return setExpandedBatch(null)
    setExpandedBatch(id)
    if (!recipientHistory[id]) {
      const result = await listQuickSendRecipients(id)
      setRecipientHistory(prev => ({ ...prev, [id]: result.recipients }))
    }
  }

  const placeholders = extractPlaceholders(`${subject} ${message}`)

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">Batch outreach</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950 flex items-center gap-3">
            Smart Campaign Builder
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
              <Sparkles className="h-3 w-3" /> AI-powered
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-600">Compose, personalize, and send email campaigns at scale via Gmail.</p>
        </div>
        {/* Gmail connection */}
        <div className={`flex items-center gap-3 border px-4 py-3 ${connected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {connectionLoading ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            : connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            : <AlertCircle className="h-5 w-5 text-amber-600" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">{connectedMailbox}</p>
            <p className="text-xs text-gray-500">{connected ? 'Gmail connected' : 'Authorization required'}</p>
          </div>
          {!connectionLoading && (connected
            ? <button type="button" onClick={disconnectGmail} title="Disconnect" className="ml-2 p-2 text-gray-400 hover:text-red-600"><Unlink className="h-4 w-4" /></button>
            : <button type="button" onClick={connectGmail} className="ml-2 inline-flex items-center gap-2 bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"><Link2 className="h-4 w-4" />Connect</button>
          )}
        </div>
      </div>

      {/* ── Builder ── */}
      <form onSubmit={sendBatch} className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">

        {/* LEFT: Recipients */}
        <div className="space-y-4 border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Users className="h-5 w-5 text-teal-600" /> Recipients
              {recipients.length > 0 && (
                <span className="ml-1 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{recipients.length}</span>
              )}
            </h2>
            {recipients.length > 0 && (
              <button type="button" onClick={() => setRecipients([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>

          {/* Input mode tabs */}
          <div className="flex rounded border border-gray-200 overflow-hidden text-sm">
            {([['paste', 'Paste list'], ['extract', 'Extract emails'], ['csv', 'Upload CSV']] as const).map(([tab, label]) => (
              <button key={tab} type="button" onClick={() => setRecipientTab(tab)}
                className={`flex-1 py-2 font-medium transition-colors ${recipientTab === tab ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab: paste / extract */}
          {(recipientTab === 'paste' || recipientTab === 'extract') && (
            <div className="space-y-2">
              <textarea
                value={recipientText}
                onChange={e => setRecipientText(e.target.value)}
                rows={10}
                placeholder={recipientTab === 'paste'
                  ? 'john@example.com\nJane Doe <jane@example.com>\n"Bob Smith" <bob@example.com>'
                  : 'Paste anything — a webpage, a document, a contact list. Emails will be extracted automatically.'}
                className="w-full resize-y border border-gray-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
              <button type="button" onClick={handleParseText} disabled={!recipientText.trim() || parsingLoading}
                className="flex w-full items-center justify-center gap-2 border border-teal-600 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40">
                {parsingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {recipientTab === 'extract' ? 'Extract emails' : 'Add recipients'}
              </button>
              <p className="text-xs text-gray-400">
                {recipientTab === 'paste' ? 'Supports: email, Name <email>, "First Last" <email>, or comma-separated.' : 'Scans the text and extracts all valid email addresses.'}
              </p>
            </div>
          )}

          {/* Tab: CSV */}
          {recipientTab === 'csv' && (
            <div className="space-y-3">
              <div
                onClick={() => csvInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f) }}
                className="flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-gray-300 p-10 text-center hover:border-teal-500 hover:bg-teal-50 transition-colors"
              >
                {parsingLoading ? <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" /> : <Upload className="h-8 w-8 text-gray-400 mb-2" />}
                <p className="text-sm font-medium text-gray-700">Drag & drop CSV or click to browse</p>
                <p className="mt-1 text-xs text-gray-400">Auto-detects Email, Name, and custom columns · Max 5 MB</p>
              </div>
              <input ref={csvInputRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = '' }} />
              <div className="rounded bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700">Expected columns (flexible):</p>
                <p><code className="font-mono bg-white px-1">Email</code> required · <code className="font-mono bg-white px-1">Name</code> or <code className="font-mono bg-white px-1">First Name</code> · any extra columns become {'{{customField:columnName}}'} placeholders</p>
              </div>
            </div>
          )}

          {/* Recipients list */}
          {recipients.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-100 bg-gray-50">
              {recipients.map(r => (
                <div key={r.email} className="flex items-center justify-between border-b border-gray-100 px-3 py-2 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.name || r.email}</p>
                    {r.name && <p className="truncate text-xs text-gray-400">{r.email}</p>}
                    {Object.keys(r.customFields).length > 0 && (
                      <p className="text-xs text-teal-600 truncate">{Object.entries(r.customFields).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => removeRecipient(r.email)} className="ml-2 flex-shrink-0 p-1 text-gray-400 hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pacing */}
          <div className="pt-2 border-t border-gray-100">
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Seconds between emails</label>
            <input type="number" min={1} max={300} value={pacingSeconds}
              onChange={e => setPacingSeconds(Number(e.target.value))}
              className="w-24 border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-600" />
            <p className="mt-1 text-xs text-gray-400">Recommended: 3–10 s to avoid spam filters</p>
          </div>
        </div>

        {/* RIGHT: Content */}
        <div className="space-y-4 border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <FileText className="h-5 w-5 text-teal-600" /> Campaign content
            </h2>
            <div className="flex items-center gap-2">
              {/* Templates toggle */}
              <button type="button" onClick={() => { setShowTemplates(v => !v); setShowAI(false) }}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${showTemplates ? 'border-teal-600 bg-teal-600 text-white' : 'border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-700'}`}>
                <Copy className="h-3.5 w-3.5" /> Templates
              </button>
              {/* AI toggle */}
              <button type="button" onClick={() => { setShowAI(v => !v); setShowTemplates(false) }}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${showAI ? 'border-teal-600 bg-teal-600 text-white' : 'border-gray-300 text-gray-600 hover:border-teal-500 hover:text-teal-700'}`}>
                <Sparkles className="h-3.5 w-3.5" /> AI Generate
              </button>
            </div>
          </div>

          {/* ── Template picker ── */}
          {showTemplates && (
            <div className="rounded border border-teal-100 bg-teal-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Choose a template</p>
              {templates.length === 0
                ? <p className="text-sm text-gray-500">No templates available</p>
                : <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map(t => (
                      <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                        className="rounded border border-teal-200 bg-white p-3 text-left hover:border-teal-500 hover:shadow-sm transition-all">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                        <p className="mt-0.5 text-xs text-teal-600 capitalize">{t.category.replace(/_/g, ' ')}</p>
                        {t.description && <p className="mt-1 text-xs text-gray-400 truncate">{t.description}</p>}
                      </button>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* ── AI Generation panel ── */}
          {showAI && (
            <div className="rounded border border-purple-100 bg-purple-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">AI Content Generator</p>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setAiMode('generate')}
                  className={`rounded px-3 py-1.5 font-semibold ${aiMode === 'generate' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400'}`}>
                  Generate from prompt
                </button>
                <button type="button" onClick={() => setAiMode('rewrite')}
                  className={`rounded px-3 py-1.5 font-semibold ${aiMode === 'rewrite' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400'}`}>
                  Rewrite existing
                </button>
              </div>
              {aiMode === 'generate' && (
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="Describe the email you want to send... e.g. &quot;Tell brokers we offer expedited freight with 24hr delivery across the Southeast&quot;"
                  className="w-full resize-y rounded border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white"
                />
              )}
              {aiMode === 'rewrite' && (
                <p className="text-xs text-purple-700 bg-purple-100 rounded p-2">
                  Will rewrite your current subject and message with the selected tone.
                </p>
              )}
              <div className="flex items-center gap-3">
                <select value={aiTone} onChange={e => setAiTone(e.target.value as any)}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-purple-500">
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button type="button" onClick={handleAIGenerate}
                  disabled={aiLoading || (aiMode === 'generate' && !aiPrompt.trim())}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {aiMode === 'rewrite' ? 'Rewrite' : 'Generate email'}
                </button>
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Category</label>
            <div className="flex gap-2">
              <input list="category-suggestions" value={category} onChange={e => setCategory(e.target.value)}
                maxLength={80} required
                className="flex-1 border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
              <datalist id="category-suggestions">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Subject */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Subject</label>
              <button type="button" onClick={handleAISubjectOnly} disabled={aiLoading || !message.trim()}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-40 disabled:cursor-not-allowed">
                <Sparkles className="h-3 w-3" /> AI suggest
              </button>
            </div>
            <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} required
              className="w-full border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
            <p className="mt-1 text-xs text-gray-400">{subject.length}/200 chars</p>
          </div>

          {/* Message */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={14} required
              className="w-full resize-y border border-gray-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600" />
          </div>

          {/* Placeholder hints */}
          {placeholders.length > 0 && (
            <div className="rounded border border-teal-100 bg-teal-50 px-3 py-2">
              <p className="text-xs font-semibold text-teal-700 mb-1">Detected personalization fields</p>
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map(p => (
                  <code key={p} className="rounded bg-teal-100 px-2 py-0.5 text-xs font-mono text-teal-800">{`{{${p}}}`}</code>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-teal-600">These will be replaced per recipient. Upload a CSV with matching column names to auto-fill.</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400">DriveDrop branding + unsubscribe link added automatically.</p>
            <button type="submit" disabled={sending || !connected || recipients.length === 0}
              className="inline-flex h-11 items-center gap-2 bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-300">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to {recipients.length || '—'} recipient{recipients.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </form>

      {/* ── History ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-950">Campaign history</h2>
        </div>
        <div className="overflow-hidden border border-gray-200 bg-white">
          {batches.length === 0
            ? <p className="p-8 text-center text-sm text-gray-500">No campaigns sent yet.</p>
            : batches.map(batch => (
              <div key={batch.id} className="border-b border-gray-100 last:border-b-0">
                <button type="button" onClick={() => toggleBatch(batch.id)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-4 p-4 text-left hover:bg-gray-50 sm:grid-cols-[1fr_150px_240px_24px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-950">{batch.subject}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{batch.category} · {new Date(batch.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`w-fit border px-2 py-1 text-xs font-semibold capitalize ${statusClass(batch.status)}`}>
                    {batch.status.replace('_', ' ')}
                  </span>
                  <p className="hidden text-right text-xs text-gray-600 sm:block">
                    {batch.sent_count} sent · {batch.failed_count} failed · {batch.suppressed_count} suppressed
                  </p>
                  {expandedBatch === batch.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedBatch === batch.id && (
                  <div className="overflow-x-auto border-t border-gray-100 bg-gray-50 p-4">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500">
                          <th className="pb-3">Recipient</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Sent</th>
                          <th className="pb-3">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(recipientHistory[batch.id] || []).map(r => (
                          <tr key={r.id} className="border-t border-gray-200">
                            <td className="py-3">
                              <span className="font-medium text-gray-900">{r.name || r.email}</span>
                              {r.name && <span className="ml-2 text-xs text-gray-400">{r.email}</span>}
                            </td>
                            <td className="py-3">
                              <span className={`border px-2 py-1 text-xs font-semibold capitalize ${statusClass(r.status)}`}>{r.status}</span>
                            </td>
                            <td className="py-3 text-xs text-gray-600">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</td>
                            <td className="max-w-xs truncate py-3 text-xs text-red-600">{r.error_message || r.gmail_message_id || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </section>
    </div>
  )
}