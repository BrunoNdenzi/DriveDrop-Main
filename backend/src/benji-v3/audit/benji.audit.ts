/**
 * Benji V3 — Production Audit Logger
 *
 * Emits structured [BENJI_V3_AUDIT] log lines that Railway / any log aggregator
 * can ingest. Each line is valid JSON.
 *
 * Fields tracked:
 *   sessionId, userId, userType, model, toolsUsed, tokenUsage,
 *   latencyMs, failureReason, responseStatus, streaming
 */

// ─── Audit event shape ────────────────────────────────────────────────────────

export interface V3AuditEvent {
  sessionId:     string
  userId:        string
  userType:      string
  latencyMs:     number
  model:         string
  toolsUsed:     string[]
  promptTokens:  number
  completionTokens: number
  totalTokens:   number
  streaming:     boolean
  responseStatus: 'success' | 'fallback' | 'error' | 'rate_limited' | 'tool_failure'
  failureReason?: string
  loopCount:     number
  ts:            string
}

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Write a production audit log line.
 * Uses console.warn so it is NOT stripped by Next.js removeConsole in production,
 * and to distinguish audit lines from regular info logs.
 */
export function logV3Audit(event: V3AuditEvent): void {
  console.warn('[BENJI_V3_AUDIT]', JSON.stringify(event));
}

/**
 * Build a baseline audit event (fill in before/after loop).
 */
export function createAuditEvent(
  partial: Pick<V3AuditEvent, 'sessionId' | 'userId' | 'userType' | 'streaming'>,
): V3AuditEvent {
  return {
    sessionId:        partial.sessionId,
    userId:           partial.userId,
    userType:         partial.userType,
    streaming:        partial.streaming,
    latencyMs:        0,
    model:            'gpt-4o-mini',
    toolsUsed:        [],
    promptTokens:     0,
    completionTokens: 0,
    totalTokens:      0,
    responseStatus:   'success',
    loopCount:        0,
    ts:               new Date().toISOString(),
  };
}
