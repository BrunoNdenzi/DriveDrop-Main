/**
 * Benji V2 — ClarificationStore
 * Phase 9.3
 *
 * In-memory TTL store for pending CLARIFICATION_REQUIRED contexts.
 * Key: traceId (UUID returned with the CLARIFICATION_REQUIRED response).
 * The frontend echoes traceId back as `clarificationTraceId` on the follow-up
 * message, allowing the route handler to merge the original message with the
 * user's answer before re-running the orchestrator.
 *
 * Security: get() enforces userId ownership — a user cannot consume another
 *           user's clarification context.
 * TTL: 30 minutes.  Expired entries are lazily evicted.
 * Scale: single-instance (Railway).  Upgrade to Redis for multi-instance.
 *
 * Governance: I-8A (no DB writes), I-14 (traceId coupling)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClarificationEntry {
  /** Who started the clarification turn. */
  readonly userId:          string;
  /** Classified intent stored so we can skip re-classification on resume. */
  readonly intent:          string;
  /** The user's original first message ("Ship my Honda Civic"). */
  readonly originalMessage: string;
  /** Unix ms when this entry expires. */
  readonly expiresAt:       number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

class ClarificationStore {
  /** TTL for each entry (30 minutes). */
  static readonly TTL_MS = 30 * 60 * 1_000;

  private readonly _store = new Map<string, ClarificationEntry>();

  /**
   * Store a pending clarification context.
   * Overwrites any previous entry for the same traceId.
   */
  set(traceId: string, entry: Omit<ClarificationEntry, 'expiresAt'>): void {
    this._store.set(traceId, {
      ...entry,
      expiresAt: Date.now() + ClarificationStore.TTL_MS,
    });

    // Lazy eviction — keeps memory bounded without a background timer
    if (this._store.size > 2_000) {
      this._evictExpired();
    }
  }

  /**
   * Retrieve a clarification entry.
   * Returns null if:
   *   - traceId is unknown
   *   - entry is expired
   *   - userId does not match (security check)
   *
   * Does NOT delete the entry — call delete() after consuming.
   */
  get(traceId: string, userId: string): ClarificationEntry | null {
    const entry = this._store.get(traceId);
    if (!entry)                        return null;
    if (entry.userId !== userId)       return null;  // ownership check
    if (Date.now() > entry.expiresAt) {
      this._store.delete(traceId);
      return null;
    }
    return entry;
  }

  /**
   * Remove an entry.  Call after successfully consuming it to prevent replay.
   */
  delete(traceId: string): void {
    this._store.delete(traceId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }
}

export const clarificationStore = new ClarificationStore();
