/**
 * Benji V4 — Persistent session store
 *
 * Backed by Supabase `benji_sessions` table so sessions survive server restarts
 * (Railway deploys, crashes, horizontal scaling).
 *
 * Read-through in-process cache (30s TTL) sits in front of DB reads so that
 * multiple tool calls within a single turn don't each hit Postgres.
 *
 * TTL policy (channel-dependent):
 *   web / mobile / voice : 2 hours of inactivity
 *   sms                  : 7 days (customers reply hours later)
 *
 * Public API is intentionally identical to the old in-memory store except:
 *   - getOrCreate, save, delete are now async
 *   - getOrCreate accepts optional channel + phoneNumber args
 *   - mergeContext remains synchronous (mutates in-memory cached session only;
 *     the caller must call save() at end of turn to flush to DB)
 */

import { randomUUID } from 'node:crypto';
import type { V3Session, V3LogisticsContext, UserType } from './benji.types';

// ─── TTL constants ────────────────────────────────────────────────────────────

const TTL_WEB_MS   = 2 * 60 * 60 * 1_000;        // 2 h
const TTL_SMS_MS   = 7 * 24 * 60 * 60 * 1_000;   // 7 days
const MAX_MESSAGES = 60;
const CACHE_TTL_MS = 30_000;                       // 30 s read-through cache

function channelTtlMs(channel: V3Session['channel']): number {
  return channel === 'sms' ? TTL_SMS_MS : TTL_WEB_MS;
}

// ─── In-process cache entry ───────────────────────────────────────────────────

interface CacheEntry {
  session:  V3Session;
  cachedAt: number;
}

// ─── DB row shape (mirrors the migration) ─────────────────────────────────────

interface SessionRow {
  session_id:   string;
  user_id:      string;
  user_type:    string;
  channel:      string;
  phone_number: string | null;
  messages:     unknown;
  context:      unknown;
  created_at:   string;
  last_active:  string;
  expires_at:   string;
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

function rowToSession(row: SessionRow): V3Session {
  return {
    sessionId:   row.session_id,
    userId:      row.user_id,
    userType:    row.user_type as UserType,
    channel:     (row.channel as V3Session['channel']) ?? 'web',
    ...(row.phone_number != null ? { phoneNumber: row.phone_number } : {}),
    messages:    Array.isArray(row.messages) ? row.messages : [],
    context:     (typeof row.context === 'object' && row.context !== null)
      ? row.context as V3LogisticsContext
      : {},
    createdAt:   new Date(row.created_at).getTime(),
    lastActive:  new Date(row.last_active).getTime(),
    expiresAt:   new Date(row.expires_at).getTime(),
  };
}

function sessionToRow(session: V3Session): Omit<SessionRow, 'created_at'> {
  return {
    session_id:   session.sessionId,
    user_id:      session.userId,
    user_type:    session.userType,
    channel:      session.channel,
    phone_number: session.phoneNumber ?? null,
    messages:     session.messages,
    context:      session.context,
    last_active:  new Date(session.lastActive).toISOString(),
    expires_at:   new Date(session.expiresAt).toISOString(),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

class V3SessionStore {
  private readonly _cache = new Map<string, CacheEntry>();

  /**
   * Get existing session or create a fresh one.
   * `channel` defaults to 'web' for backward compatibility with existing callers.
   */
  async getOrCreate(
    sessionId:    string,
    userId:       string,
    userType:     UserType,
    channel:      V3Session['channel'] = 'web',
    phoneNumber?: string,
  ): Promise<V3Session> {
    // 1. In-process cache hit
    const cached = this._cache.get(sessionId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      if (cached.session.userId !== userId) {
        // Different user — start a new session
        return this._create(userId, userType, channel, phoneNumber);
      }
      cached.session.lastActive = Date.now();
      return cached.session;
    }

    // 2. Supabase lookup
    const { supabaseAdmin } = await import('../lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('benji_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('[SESSION_STORE] DB read error:', error.message);
    }

    if (data) {
      const row = data as SessionRow;
      if (row.user_id !== userId) {
        return this._create(userId, userType, channel, phoneNumber, sessionId);
      }
      const session = rowToSession(row);
      this._cache.set(sessionId, { session, cachedAt: Date.now() });
      return session;
    }

    // 3. Not found — create new
    return this._create(userId, userType, channel, phoneNumber, sessionId);
  }

  /** Persist session after a turn completes. Invalidates the in-process cache entry. */
  async save(session: V3Session): Promise<void> {
    session.lastActive = Date.now();
    session.expiresAt  = Date.now() + channelTtlMs(session.channel);

    // Prune oldest messages when the cap is exceeded, preserving system entries
    if (session.messages.length > MAX_MESSAGES) {
      const nonSystem = session.messages.filter(m => m.role !== 'system');
      session.messages = nonSystem.slice(-MAX_MESSAGES);
    }

    // Update in-process cache first so subsequent mergeContext calls see fresh state
    this._cache.set(session.sessionId, { session, cachedAt: Date.now() });

    // Upsert to Supabase
    const { supabaseAdmin } = await import('../lib/supabase');
    const { error } = await supabaseAdmin
      .from('benji_sessions')
      .upsert(sessionToRow(session), { onConflict: 'session_id' });

    if (error) {
      console.error('[SESSION_STORE] DB save error:', error.message);
      // Non-fatal: the in-process cache still holds the latest state
    }
  }

  /** Remove a session (e.g. on logout or explicit clear). */
  async delete(sessionId: string): Promise<void> {
    this._cache.delete(sessionId);
    const { supabaseAdmin } = await import('../lib/supabase');
    await supabaseAdmin.from('benji_sessions').delete().eq('session_id', sessionId);
  }

  /**
   * Update the logistics context in-place — synchronous, operates on the
   * in-process cached session only. The caller MUST call save() at the end
   * of the turn to persist these changes to the DB.
   */
  mergeContext(sessionId: string, patch: Partial<V3LogisticsContext>): void {
    const entry = this._cache.get(sessionId);
    if (!entry) return;
    entry.session.context = { ...entry.session.context, ...patch };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _create(
    userId:       string,
    userType:     UserType,
    channel:      V3Session['channel'],
    phoneNumber?: string,
    sessionId?:   string,
  ): Promise<V3Session> {
    const id  = sessionId ?? randomUUID();
    const now = Date.now();
    const session: V3Session = {
      sessionId:   id,
      userId,
      userType,
      channel,
      ...(phoneNumber != null ? { phoneNumber } : {}),
      messages:    [],
      context:     {},
      createdAt:   now,
      lastActive:  now,
      expiresAt:   now + channelTtlMs(channel),
    };

    // Insert immediately so re-connects before the first save() still find it
    const { supabaseAdmin } = await import('../lib/supabase');
    const { error } = await supabaseAdmin
      .from('benji_sessions')
      .insert({
        ...sessionToRow(session),
        created_at: new Date(session.createdAt).toISOString(),
      });

    if (error) {
      console.error('[SESSION_STORE] DB insert error:', error.message);
    }

    this._cache.set(id, { session, cachedAt: Date.now() });
    return session;
  }
}

/** Singleton — one store per process. */
export const v3SessionStore = new V3SessionStore();
