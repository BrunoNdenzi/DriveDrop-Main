'use client'

/**
 * Benji V2 QA Console
 * Phase 9.2.5 — Admin-only live integration testing console.
 *
 * Features:
 *   1. Role Simulator     — send requests as client / driver / admin via _qaUserType
 *   2. Intent Test Suite  — preset messages per intent + custom input
 *   3. Live Response Panel — full JSON, state badge, confirmation flow
 *   4. Trace Viewer       — recent traces with step expansion
 *   5. Metrics Panel      — 7-day rolling Benji health metrics
 *
 * Feature-flagged: NEXT_PUBLIC_ENABLE_BENJI_QA_CONSOLE must be 'true'.
 * Admin-only: /dashboard/admin guard + role check.
 */

import { useState, useCallback, useRef } from 'react'
import { aiService, type BenjiMetrics, type BenjiTrace, type BenjiTraceStep } from '@/services/aiService'
import {
  Bot,
  FlaskConical,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  BarChart3,
  Layers,
  User,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type UserTypeOption = 'client' | 'driver' | 'admin' | 'broker'
type ResponseState = 'COMPLETE' | 'AWAIT_CONFIRMATION' | 'BLOCKED' | null

interface QaResponse {
  raw: unknown
  state: ResponseState
  traceId?: string
  response?: string
  riskScore?: number
  planSummary?: string[]
  confirmationMessage?: string
  shipmentCreated?: {
    shipment_id: string
    estimatedPrice: number
    distanceMiles: number
    vehicle: string
    pickupAddress: string
    deliveryAddress: string
  }
  error?: string
}

// ─── Preset scenarios ─────────────────────────────────────────────────────────

interface Scenario {
  id: string
  intent: string
  label: string
  suggestedRole: UserTypeOption
  message: string
  description: string
}

const SCENARIOS: Scenario[] = [
  {
    id: 'shipment-create',
    intent: 'shipment.create',
    label: 'Create Shipment',
    suggestedRole: 'client',
    message: 'Ship my 2023 Honda Civic from Charlotte, NC to Atlanta, GA',
    description: '5-tool chain: validate → parse → pricing → create → respond (may trigger confirmation gate)',
  },
  {
    id: 'shipment-track',
    intent: 'shipment.track',
    label: 'Track Shipment',
    suggestedRole: 'client',
    message: 'Where is my latest shipment? What is the current status?',
    description: '2-tool chain: validate → respond',
  },
  {
    id: 'shipment-quote',
    intent: 'shipment.quote',
    label: 'Get Quote',
    suggestedRole: 'client',
    message: 'How much to ship a 2022 Tesla Model 3 from Miami, FL to Chicago, IL?',
    description: '2-tool chain: validate → respond',
  },
  {
    id: 'dispatch-accept',
    intent: 'dispatch.accept',
    label: 'Accept Dispatch Load',
    suggestedRole: 'driver',
    message: 'I want to accept the load for shipment ABC-123',
    description: '2-tool chain: validate → respond',
  },
  {
    id: 'account-query',
    intent: 'account.query',
    label: 'Account Info',
    suggestedRole: 'client',
    message: 'What are my recent shipments and preferences?',
    description: '2-tool chain: memory.read → respond',
  },
  {
    id: 'general-inquiry',
    intent: 'general.inquiry',
    label: 'General Inquiry',
    suggestedRole: 'client',
    message: 'Hello Benji, what can you help me with today?',
    description: '1-tool fallback: chat.respond only',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StateBadge({ state }: { state: string | null | undefined }) {
  if (!state) return null
  const map: Record<string, { label: string; className: string }> = {
    COMPLETE:           { label: 'COMPLETE',      className: 'bg-green-100 text-green-800 border-green-200' },
    AWAIT_CONFIRMATION: { label: 'NEEDS CONFIRM', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    BLOCKED:            { label: 'BLOCKED',        className: 'bg-red-100 text-red-800 border-red-200' },
    completed_success:  { label: 'COMPLETE',      className: 'bg-green-100 text-green-800 border-green-200' },
    completed_blocked:  { label: 'BLOCKED',        className: 'bg-red-100 text-red-800 border-red-200' },
    IDLE:               { label: 'IDLE',           className: 'bg-gray-100 text-gray-600 border-gray-200' },
    RUNNING:            { label: 'RUNNING',        className: 'bg-blue-100 text-blue-800 border-blue-200' },
  }
  const cfg = map[state] ?? { label: state, className: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function RoleChip({ role }: { role: UserTypeOption }) {
  const map: Record<UserTypeOption, string> = {
    client: 'bg-sky-100 text-sky-800',
    driver: 'bg-emerald-100 text-emerald-800',
    admin:  'bg-violet-100 text-violet-800',
    broker: 'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${map[role]}`}>
      {role}
    </span>
  )
}

function ToolStepRow({ step, index }: { step: BenjiTraceStep; index: number }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-1 px-2 text-xs text-gray-500 w-6">{index + 1}</td>
      <td className="py-1 px-2 text-xs font-mono">{step.tool_name ?? '—'}</td>
      <td className="py-1 px-2">
        {step.success == null ? (
          <span className="text-gray-400 text-xs">—</span>
        ) : step.success ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        )}
      </td>
      <td className="py-1 px-2 text-xs text-gray-400 font-mono">{step.input_hash ?? '—'}</td>
      <td className="py-1 px-2 text-xs text-gray-400 font-mono">{step.output_hash ?? '—'}</td>
      <td className="py-1 px-2 text-xs text-gray-500">
        {new Date(step.timestamp).toLocaleTimeString()}
      </td>
    </tr>
  )
}

function TraceRow({
  trace,
  expanded,
  steps,
  loadingSteps,
  onToggle,
}: {
  trace: BenjiTrace
  expanded: boolean
  steps: BenjiTraceStep[]
  loadingSteps: boolean
  onToggle: () => void
}) {
  const outcomeOk = trace.final_outcome?.includes('success') || trace.state === 'COMPLETE'
  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="py-2 px-3">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          )}
        </td>
        <td className="py-2 px-3 text-xs font-mono text-gray-600">{shortId(trace.trace_id)}</td>
        <td className="py-2 px-3 text-xs font-mono">{trace.intent ?? '—'}</td>
        <td className="py-2 px-3">
          <StateBadge state={trace.final_outcome ?? trace.state} />
        </td>
        <td className="py-2 px-3 text-xs text-center">{trace.step_count}</td>
        <td className="py-2 px-3 text-xs text-gray-500">
          {formatDuration(trace.started_at, trace.completed_at)}
        </td>
        <td className="py-2 px-3 text-xs text-gray-400">
          {new Date(trace.started_at).toLocaleTimeString()}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-3">
            {loadingSteps ? (
              <p className="text-xs text-gray-500">Loading steps…</p>
            ) : steps.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No step data recorded.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-1 px-2 w-6">#</th>
                    <th className="py-1 px-2">Tool</th>
                    <th className="py-1 px-2">OK</th>
                    <th className="py-1 px-2">In Hash</th>
                    <th className="py-1 px-2">Out Hash</th>
                    <th className="py-1 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s, i) => (
                    <ToolStepRow key={s.step_id} step={s} index={i} />
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BenjiQAConsolePage() {
  // ── Feature flag gate ──────────────────────────────────────────────────────
  if (process.env.NEXT_PUBLIC_ENABLE_BENJI_QA_CONSOLE !== 'true') {
    return (
      <div className="p-8 text-center">
        <FlaskConical className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <h2 className="text-lg font-semibold text-gray-700">Benji QA Console Disabled</h2>
        <p className="mt-1 text-sm text-gray-500">
          Set <code className="font-mono bg-gray-100 px-1 rounded">NEXT_PUBLIC_ENABLE_BENJI_QA_CONSOLE=true</code> to enable.
        </p>
      </div>
    )
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedRole, setSelectedRole]     = useState<UserTypeOption>('client')
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [customMessage, setCustomMessage]   = useState('')
  const [isSending, setIsSending]           = useState(false)
  const [qaResponse, setQaResponse]         = useState<QaResponse | null>(null)
  const [isConfirming, setIsConfirming]     = useState(false)

  const [traces, setTraces]                 = useState<BenjiTrace[]>([])
  const [tracesLoading, setTracesLoading]   = useState(false)
  const [tracesError, setTracesError]       = useState<string | null>(null)
  const [expandedTrace, setExpandedTrace]   = useState<string | null>(null)
  const [traceSteps, setTraceSteps]         = useState<Record<string, BenjiTraceStep[]>>({})
  const [loadingSteps, setLoadingSteps]     = useState<Record<string, boolean>>({})

  const [metrics, setMetrics]               = useState<BenjiMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError]     = useState<string | null>(null)

  const responseRef = useRef<HTMLDivElement>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleScenarioSelect = useCallback((scenario: Scenario) => {
    setSelectedScenario(scenario)
    setCustomMessage(scenario.message)
    setSelectedRole(scenario.suggestedRole)
    setQaResponse(null)
  }, [])

  const handleSend = useCallback(async () => {
    const msg = customMessage.trim()
    if (!msg || isSending) return
    setIsSending(true)
    setQaResponse(null)
    try {
      const data = await aiService.benjiQaChat(msg, selectedRole)
      const qa: QaResponse = {
        raw:     data,
        state:   (data.state ?? null) as ResponseState,
        traceId: data.traceId,
        response: data.response,
        error:   data.error,
      }
      if (data.confirmationPayload) {
        qa.riskScore           = data.confirmationPayload.riskScore
        qa.planSummary         = data.confirmationPayload.planSummary
        qa.confirmationMessage = data.confirmationPayload.message
      }
      if (data.shipmentCreated) {
        qa.shipmentCreated = data.shipmentCreated
      }
      setQaResponse(qa)
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err: unknown) {
      setQaResponse({
        raw: { error: String(err) },
        state: null,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsSending(false)
    }
  }, [customMessage, isSending, selectedRole])

  const handleConfirm = useCallback(async (confirmed: boolean) => {
    if (!qaResponse?.traceId || isConfirming) return
    setIsConfirming(true)
    try {
      const data = await aiService.benjiConfirm(qaResponse.traceId, confirmed)
      setQaResponse(prev => ({
        ...prev!,
        raw:           data,
        state:         (data.state ?? null) as ResponseState,
        response:      data.response,
        error:         data.error,
        shipmentCreated: data.shipmentCreated ?? prev?.shipmentCreated,
        // clear confirmation fields
        riskScore:           undefined,
        planSummary:         undefined,
        confirmationMessage: undefined,
      }))
    } catch (err: unknown) {
      setQaResponse(prev => ({
        ...prev!,
        error: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setIsConfirming(false)
    }
  }, [qaResponse, isConfirming])

  const loadTraces = useCallback(async () => {
    setTracesLoading(true)
    setTracesError(null)
    try {
      const data = await aiService.getBenjiTraces(25)
      setTraces(data)
    } catch (err: unknown) {
      setTracesError(err instanceof Error ? err.message : String(err))
    } finally {
      setTracesLoading(false)
    }
  }, [])

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true)
    setMetricsError(null)
    try {
      const data = await aiService.getBenjiMetrics()
      setMetrics(data)
    } catch (err: unknown) {
      setMetricsError(err instanceof Error ? err.message : String(err))
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const handleToggleTrace = useCallback(async (traceId: string) => {
    if (expandedTrace === traceId) {
      setExpandedTrace(null)
      return
    }
    setExpandedTrace(traceId)
    if (traceSteps[traceId]) return   // already loaded
    setLoadingSteps(prev => ({ ...prev, [traceId]: true }))
    try {
      const steps = await aiService.getBenjiTraceSteps(traceId)
      setTraceSteps(prev => ({ ...prev, [traceId]: steps }))
    } catch {
      setTraceSteps(prev => ({ ...prev, [traceId]: [] }))
    } finally {
      setLoadingSteps(prev => ({ ...prev, [traceId]: false }))
    }
  }, [expandedTrace, traceSteps])

  // ── Render ─────────────────────────────────────────────────────────────────

  const message = customMessage.trim()

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100">
          <FlaskConical className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Benji V2 QA Console</h1>
          <p className="text-xs text-gray-500">
            Admin-only live integration testing — all requests flow through{' '}
            <code className="font-mono">/api/v1/benji/chat</code>
          </p>
        </div>
      </div>

      {/* ── Section 1 + 2: Role Simulator + Intent Test Suite ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Role Simulator */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <User className="h-4 w-4 text-violet-500" />
            Role Simulator
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Sets <code className="font-mono">_qaUserType</code> in the request. Server accepts
            this override only when <code className="font-mono">ENABLE_BENJI_QA_CONSOLE=true</code>.
          </p>
          <div className="space-y-2">
            {(['client', 'driver', 'admin', 'broker'] as UserTypeOption[]).map(role => (
              <label
                key={role}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                  selectedRole === role
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="qaRole"
                  value={role}
                  checked={selectedRole === role}
                  onChange={() => setSelectedRole(role)}
                  className="accent-violet-600"
                />
                <RoleChip role={role} />
                <span className="text-xs text-gray-600 capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Intent Test Suite */}
        <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Layers className="h-4 w-4 text-violet-500" />
            Intent Test Suite
          </h2>

          {/* Preset scenario grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => handleScenarioSelect(s)}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedScenario?.id === s.id
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs font-semibold text-gray-800">{s.label}</span>
                <span className="mt-0.5 text-[10px] text-gray-400 font-mono">{s.intent}</span>
              </button>
            ))}
          </div>

          {/* Scenario description */}
          {selectedScenario && (
            <p className="text-xs text-gray-500 italic">{selectedScenario.description}</p>
          )}

          {/* Message input */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Test Message
            </label>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              rows={2}
              placeholder="Type a message or select a preset above…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
            />
          </div>

          {/* Run button */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Sending as: <RoleChip role={selectedRole} />
            </div>
            <button
              onClick={handleSend}
              disabled={!message || isSending}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Test
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Live Response Viewer ──────────────────────────────── */}
      {qaResponse !== null && (
        <div ref={responseRef} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Bot className="h-4 w-4 text-violet-500" />
            Live Response
            {qaResponse.state && <StateBadge state={qaResponse.state} />}
          </h2>

          {/* Error */}
          {qaResponse.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              {qaResponse.error}
            </div>
          )}

          {/* Normal response text */}
          {qaResponse.response && (
            <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-gray-800">
              {qaResponse.response}
            </div>
          )}

          {/* Confirmation gate */}
          {qaResponse.state === 'AWAIT_CONFIRMATION' && qaResponse.traceId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Confirmation Required
                {qaResponse.riskScore !== undefined && (
                  <span className="ml-auto font-mono text-amber-700">
                    risk: {(qaResponse.riskScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {qaResponse.confirmationMessage && (
                <p className="text-xs text-amber-700">{qaResponse.confirmationMessage}</p>
              )}
              {qaResponse.planSummary && qaResponse.planSummary.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {qaResponse.planSummary.map((step, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                      <span className="text-amber-400">→</span>
                      {step}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={isConfirming}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {isConfirming ? 'Confirming…' : 'Confirm & Execute'}
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={isConfirming}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Shipment created result */}
          {qaResponse.shipmentCreated && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs space-y-1">
              <p className="font-semibold text-green-800 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Shipment Created
              </p>
              <div className="grid grid-cols-2 gap-1 text-green-700">
                <span>ID: <code className="font-mono">{shortId(qaResponse.shipmentCreated.shipment_id)}</code></span>
                <span>Price: ${qaResponse.shipmentCreated.estimatedPrice}</span>
                <span>Distance: {qaResponse.shipmentCreated.distanceMiles} mi</span>
                <span>Vehicle: {qaResponse.shipmentCreated.vehicle}</span>
                <span className="col-span-2">From: {qaResponse.shipmentCreated.pickupAddress}</span>
                <span className="col-span-2">To: {qaResponse.shipmentCreated.deliveryAddress}</span>
              </div>
            </div>
          )}

          {/* TraceId */}
          {qaResponse.traceId && (
            <p className="text-[10px] text-gray-400 font-mono">
              traceId: {qaResponse.traceId}
            </p>
          )}

          {/* Raw JSON toggle */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600 select-none">
              Raw JSON response
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-gray-900 p-3 text-[11px] text-green-400 max-h-64">
              {JSON.stringify(qaResponse.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* ── Section 4: Trace Viewer ───────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Activity className="h-4 w-4 text-violet-500" />
            Trace Viewer
            <span className="text-xs font-normal text-gray-400">(last 25)</span>
          </h2>
          <button
            onClick={loadTraces}
            disabled={tracesLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${tracesLoading ? 'animate-spin' : ''}`} />
            {tracesLoading ? 'Loading…' : 'Load Traces'}
          </button>
        </div>

        {tracesError && (
          <p className="text-xs text-red-600 mb-2">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
            {tracesError}
          </p>
        )}

        {traces.length === 0 && !tracesLoading && !tracesError ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            No traces loaded — click &ldquo;Load Traces&rdquo; to fetch recent activity.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="py-2 px-3 w-6"></th>
                  <th className="py-2 px-3">Trace ID</th>
                  <th className="py-2 px-3">Intent</th>
                  <th className="py-2 px-3">Outcome</th>
                  <th className="py-2 px-3 text-center">Steps</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {traces.map(t => (
                  <TraceRow
                    key={t.trace_id}
                    trace={t}
                    expanded={expandedTrace === t.trace_id}
                    steps={traceSteps[t.trace_id] ?? []}
                    loadingSteps={loadingSteps[t.trace_id] ?? false}
                    onToggle={() => handleToggleTrace(t.trace_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 5: Metrics Panel ──────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            Benji Metrics
            {metrics && (
              <span className="text-xs font-normal text-gray-400">
                {metrics.windowDays}-day window · {new Date(metrics.computedAt).toLocaleTimeString()}
              </span>
            )}
          </h2>
          <button
            onClick={loadMetrics}
            disabled={metricsLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${metricsLoading ? 'animate-spin' : ''}`} />
            {metricsLoading ? 'Loading…' : 'Load Metrics'}
          </button>
        </div>

        {metricsError && (
          <p className="text-xs text-red-600 mb-2">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
            {metricsError}
          </p>
        )}

        {metrics == null && !metricsLoading && !metricsError ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">
            No metrics loaded — click &ldquo;Load Metrics&rdquo; to fetch data.
          </p>
        ) : metrics != null && (
          <div className="space-y-4">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Traces',    value: String(metrics.totalTraces),     icon: <Activity className="h-4 w-4 text-blue-500" />     },
                { label: 'Completed',       value: String(metrics.completedTraces), icon: <CheckCircle className="h-4 w-4 text-green-500" />  },
                { label: 'Blocked',         value: String(metrics.blockedTraces),   icon: <XCircle className="h-4 w-4 text-red-500" />        },
                {
                  label: 'Avg Latency',
                  value: metrics.averageOrchestrationLatencyMs != null
                    ? `${(metrics.averageOrchestrationLatencyMs / 1000).toFixed(1)}s`
                    : '—',
                  icon: <Clock className="h-4 w-4 text-amber-500" />,
                },
              ].map(tile => (
                <div key={tile.label} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  {tile.icon}
                  <div>
                    <p className="text-lg font-bold text-gray-900 leading-none">{tile.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{tile.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Acceptance + block rates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Confirmation Acceptance Rate: </span>
                <span className="font-semibold">
                  {metrics.confirmationAcceptanceRate != null
                    ? `${(metrics.confirmationAcceptanceRate * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Simulation Block Rate: </span>
                <span className="font-semibold">
                  {metrics.simulationBlockRate != null
                    ? `${(metrics.simulationBlockRate * 100).toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Tool failure rates */}
            {metrics.toolFailureRates.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold text-gray-700">Tool Failure Rates</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-[10px] text-gray-500">
                      <th className="pb-1 pr-3">Tool</th>
                      <th className="pb-1 pr-3 text-right">Calls</th>
                      <th className="pb-1 pr-3 text-right">Failed</th>
                      <th className="pb-1 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.toolFailureRates.map(r => (
                      <tr key={r.toolName} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-3 font-mono">{r.toolName}</td>
                        <td className="py-1 pr-3 text-right">{r.totalCalls}</td>
                        <td className="py-1 pr-3 text-right">{r.failedCalls}</td>
                        <td className={`py-1 text-right font-semibold ${r.failureRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                          {(r.failureRate * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Policy violations */}
            {metrics.policyViolationCounts.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold text-gray-700">Policy Violations</h3>
                <div className="flex flex-wrap gap-2">
                  {metrics.policyViolationCounts.map(v => (
                    <span
                      key={v.ruleId}
                      className={`rounded border px-2 py-0.5 text-xs ${
                        v.severity === 'high'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : v.severity === 'medium'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {v.ruleId}: {v.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
