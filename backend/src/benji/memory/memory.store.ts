/**
 * Benji V2 — MemoryStore abstraction
 * Phase 3 / Phase 4
 *
 * MemoryStore is the storage-agnostic interface that BenjiMemoryService depends on.
 * Swap implementations at startup without changing any service code:
 *
 *   Production:  SupabaseMemoryStore  (benji/memory/supabase-memory.store.ts)
 *   Test / Dev:  InMemoryStore        (this file, below)
 *
 * BenjiMemoryService NEVER imports a concrete store — it only knows MemoryStore.
 * The concrete instance is injected via benji/memory/index.ts.
 */

import type { MemoryNamespace, MemoryKey, MemoryEntry } from '@benji/core/types/memory.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface MemoryStore {
  /**
   * Fetch entries for a user.
   * When `keys` is provided, returns only matching namespace+key pairs.
   * When `keys` is absent, returns all entries for this user.
   * Always returns entries unsorted — sort is BenjiMemoryService's responsibility (I-13).
   */
  get(
    userId: string,
    keys?:  ReadonlyArray<MemoryKey>,
  ): Promise<ReadonlyArray<MemoryEntry>>;

  /**
   * Upsert a single entry. Returns the persisted MemoryEntry.
   * Conflict resolution: last-write-wins on (userId, namespace, key).
   */
  set(
    userId: string,
    entry:  MemoryKey & { value: unknown; ttlSeconds?: number },
  ): Promise<MemoryEntry>;

  /**
   * Delete a single entry. No-op if entry does not exist.
   */
  delete(userId: string, key: MemoryKey): Promise<void>;

  /**
   * Delete all entries for a user in an optional namespace.
   * When `namespace` is absent, clears ALL entries for the user.
   */
  clear(userId: string, namespace?: MemoryNamespace): Promise<void>;
}

// ─── InMemoryStore (dev / test adapter) ──────────────────────────────────────

/**
 * Volatile in-process store.  All data is lost on process restart.
 * Used in development or when SUPABASE_SERVICE_ROLE_KEY is absent.
 * Safe for unit tests — inject a fresh instance per test.
 */
export class InMemoryStore implements MemoryStore {
  /** Outer key: userId; inner key: `${namespace}:${key}` */
  private readonly _data = new Map<string, Map<string, MemoryEntry>>();

  async get(
    userId: string,
    keys?:  ReadonlyArray<MemoryKey>,
  ): Promise<ReadonlyArray<MemoryEntry>> {
    const userMap = this._data.get(userId);
    if (!userMap) return [];

    const all: MemoryEntry[] = [...userMap.values()];

    if (!keys || keys.length === 0) return all;

    return all.filter(e =>
      keys.some(k => k.namespace === e.namespace && k.key === e.key),
    );
  }

  async set(
    userId: string,
    entry:  MemoryKey & { value: unknown; ttlSeconds?: number },
  ): Promise<MemoryEntry> {
    let userMap = this._data.get(userId);
    if (!userMap) {
      userMap = new Map();
      this._data.set(userId, userMap);
    }

    const mapKey  = `${entry.namespace}:${entry.key}`;
    const memEntry: MemoryEntry = {
      namespace:  entry.namespace,
      key:        entry.key,
      value:      entry.value,
      updatedAt:  new Date().toISOString(),
      ...(entry.ttlSeconds !== undefined ? { ttlSeconds: entry.ttlSeconds } : {}),
    };

    userMap.set(mapKey, memEntry);
    return memEntry;
  }

  async delete(userId: string, key: MemoryKey): Promise<void> {
    const userMap = this._data.get(userId);
    if (!userMap) return;
    userMap.delete(`${key.namespace}:${key.key}`);
  }

  async clear(userId: string, namespace?: MemoryNamespace): Promise<void> {
    if (!namespace) {
      this._data.delete(userId);
      return;
    }
    const userMap = this._data.get(userId);
    if (!userMap) return;
    for (const [mapKey, entry] of userMap.entries()) {
      if (entry.namespace === namespace) {
        userMap.delete(mapKey);
      }
    }
  }
}
