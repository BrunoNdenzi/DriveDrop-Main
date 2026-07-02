/**
 * Benji V2 — SupabaseMemoryStore
 * Phase 4
 *
 * Production MemoryStore implementation backed by the `benji_memories` Supabase table.
 *
 * Required schema (apply via migration before deploying Phase 4):
 * ─────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS benji_memories (
 *     id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     UUID        NOT NULL,
 *     namespace   TEXT        NOT NULL,
 *     key         TEXT        NOT NULL,
 *     value       JSONB       NOT NULL,
 *     ttl_seconds INTEGER,
 *     updated_at  TIMESTAMPTZ DEFAULT NOW(),
 *     UNIQUE (user_id, namespace, key)
 *   );
 *   CREATE INDEX IF NOT EXISTS benji_memories_user_id ON benji_memories (user_id);
 * ─────────────────────────────────────────────────────────────────
 *
 * Upsert strategy: onConflict 'user_id,namespace,key' → last-write-wins.
 * Read strategy: fetch all for userId, then filter in JS when specific keys requested.
 *   (Avoids complex OR-based tuple IN queries in the Supabase JS client.)
 */

import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import type { MemoryNamespace, MemoryKey, MemoryEntry } from '@benji/core/types/memory.types';
import type { MemoryStore } from './memory.store';

const BENJI_MEMORIES_TABLE = 'benji_memories';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToEntry(row: unknown): MemoryEntry {
  const r = row as Record<string, unknown>;
  const ttl = r['ttl_seconds'];
  return {
    namespace:  r['namespace'] as MemoryNamespace,
    key:        String(r['key']        ?? ''),
    value:      r['value'],
    updatedAt:  String(r['updated_at'] ?? new Date().toISOString()),
    ...(typeof ttl === 'number' ? { ttlSeconds: ttl } : {}),
  };
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class SupabaseMemoryStore implements MemoryStore {
  async get(
    userId: string,
    keys?:  ReadonlyArray<MemoryKey>,
  ): Promise<ReadonlyArray<MemoryEntry>> {
    const { data, error } = await supabaseAdmin
      .from(BENJI_MEMORIES_TABLE)
      .select('namespace, key, value, ttl_seconds, updated_at')
      .eq('user_id', userId);

    if (error) {
      logger.warn('SupabaseMemoryStore.get: query failed', {
        userId,
        error: String(error),
      });
      throw new Error(`MemoryStore.get failed: ${String(error)}`);
    }

    const rows = (Array.isArray(data) ? data : []) as unknown[];
    const entries = rows.map(rowToEntry);

    if (!keys || keys.length === 0) return entries;

    return entries.filter(e =>
      keys.some(k => k.namespace === e.namespace && k.key === e.key),
    );
  }

  async set(
    userId: string,
    entry:  MemoryKey & { value: unknown; ttlSeconds?: number },
  ): Promise<MemoryEntry> {
    const now = new Date().toISOString();

    const row = {
      user_id:    userId,
      namespace:  entry.namespace,
      key:        entry.key,
      value:      entry.value,
      updated_at: now,
      ...(entry.ttlSeconds !== undefined ? { ttl_seconds: entry.ttlSeconds } : {}),
    };

    const { error } = await supabaseAdmin
      .from(BENJI_MEMORIES_TABLE)
      .upsert(row, { onConflict: 'user_id,namespace,key' });

    if (error) {
      logger.warn('SupabaseMemoryStore.set: upsert failed', {
        userId,
        namespace: entry.namespace,
        key:       entry.key,
        error:     String(error),
      });
      throw new Error(`MemoryStore.set failed: ${String(error)}`);
    }

    return {
      namespace:  entry.namespace,
      key:        entry.key,
      value:      entry.value,
      updatedAt:  now,
      ...(entry.ttlSeconds !== undefined ? { ttlSeconds: entry.ttlSeconds } : {}),
    };
  }

  async delete(userId: string, key: MemoryKey): Promise<void> {
    const { error } = await supabaseAdmin
      .from(BENJI_MEMORIES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('namespace', key.namespace)
      .eq('key', key.key);

    if (error) {
      throw new Error(`MemoryStore.delete failed: ${String(error)}`);
    }
  }

  async clear(userId: string, namespace?: MemoryNamespace): Promise<void> {
    let query = supabaseAdmin
      .from(BENJI_MEMORIES_TABLE)
      .delete()
      .eq('user_id', userId);

    if (namespace !== undefined) {
      query = query.eq('namespace', namespace);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`MemoryStore.clear failed: ${String(error)}`);
    }
  }
}
