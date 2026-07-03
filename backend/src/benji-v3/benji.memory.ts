/**
 * Benji V3 — Session memory store
 *
 * In-process TTL store keyed by sessionId.
 * Holds full conversation history + accumulated logistics context.
 *
 * Scale: single-instance (Railway).
 * Upgrade path: swap backing store for Redis without changing the public API.
 *
 * TTL: 2 hours of inactivity.
 * Message cap: 60 messages per session (oldest pruned to keep context window sane).
 */

import { randomUUID } from 'node:crypto';
import type { V3Session, V3LogisticsContext, UserType } from './benji.types';

const SESSION_TTL_MS  = 2 * 60 * 60 * 1_000;   // 2 hours
const MAX_MESSAGES    = 60;                       // cap per session
const EVICT_THRESHOLD = 5_000;                    // lazy evict if store exceeds this

class V3SessionStore {
  private readonly _store = new Map<string, V3Session>();

  /** Get existing session or create a fresh one. */
  getOrCreate(sessionId: string, userId: string, userType: UserType): V3Session {
    const existing = this._store.get(sessionId);

    if (existing) {
      // Security: ensure the session belongs to the requesting user
      if (existing.userId !== userId) {
        // Different user — create a new session rather than erroring
        return this._create(userId, userType);
      }
      existing.lastActive = Date.now();
      return existing;
    }

    return this._create(userId, userType, sessionId);
  }

  /** Persist session after a turn completes (mutates in-place — no copy needed). */
  save(session: V3Session): void {
    session.lastActive = Date.now();

    // Prune oldest messages when the cap is exceeded, preserving system entries
    if (session.messages.length > MAX_MESSAGES) {
      const nonSystem = session.messages.filter(m => m.role !== 'system');
      session.messages = nonSystem.slice(-MAX_MESSAGES);
    }

    this._store.set(session.sessionId, session);

    if (this._store.size > EVICT_THRESHOLD) {
      this._evictExpired();
    }
  }

  /** Remove a session (e.g. on logout). */
  delete(sessionId: string): void {
    this._store.delete(sessionId);
  }

  /** Update the logistics context in-place. */
  mergeContext(sessionId: string, patch: Partial<V3LogisticsContext>): void {
    const session = this._store.get(sessionId);
    if (!session) return;
    session.context = { ...session.context, ...patch };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _create(userId: string, userType: UserType, sessionId?: string): V3Session {
    const id = sessionId ?? randomUUID();
    const session: V3Session = {
      sessionId:   id,
      userId,
      userType,
      messages:    [],
      context:     {},
      createdAt:   Date.now(),
      lastActive:  Date.now(),
    };
    this._store.set(id, session);
    return session;
  }

  private _evictExpired(): void {
    const now  = Date.now();
    const cutoff = now - SESSION_TTL_MS;
    for (const [key, session] of this._store) {
      if (session.lastActive < cutoff) {
        this._store.delete(key);
      }
    }
  }
}

/** Singleton — one store per process. */
export const v3SessionStore = new V3SessionStore();
