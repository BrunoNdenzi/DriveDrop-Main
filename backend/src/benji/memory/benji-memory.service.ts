/**
 * Benji V2 — BenjiMemoryService
 * Phase 4
 *
 * High-level memory service that:
 *   1. Enforces I-13 (namespace-scoped access) before any store operation
 *   2. Applies MEMORY_SORT_COMPARATOR to all read results (deterministic order)
 *   3. Is storage-agnostic — depends only on MemoryStore interface
 *
 * Tools never call MemoryStore directly.  They call BenjiMemoryService and
 * pass their own declared namespaceAccess arrays, which this service validates.
 */

import { logger } from '@utils/logger';
import {
  type MemoryNamespace,
  type MemoryKey,
  type MemoryEntry,
  sortMemoryEntries,
} from '@benji/core/types/memory.types';
import type { MemoryStore } from './memory.store';

// Re-export for callers that only import from @benji/memory
export type { MemoryEntry, MemoryKey, MemoryNamespace };

// ─── I/O types (mirror tool I/O so callers don't need separate imports) ───────

export interface ServiceReadInput {
  userId: string;
  keys?:  ReadonlyArray<MemoryKey>;
}

export interface ServiceReadOutput {
  memories: ReadonlyArray<MemoryEntry>;
}

export interface ServiceWriteInput {
  userId: string;
  entry:  MemoryKey & { value: unknown; ttlSeconds?: number };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BenjiMemoryService {
  constructor(private readonly _store: MemoryStore) {}

  /**
   * Read namespace-scoped memory entries for a user.
   *
   * I-13: only entries whose namespace appears in `allowedNamespaces` are returned.
   * If `keys` contains a namespace not in `allowedNamespaces`, an error is thrown —
   * the tool declared an access scope violation.
   *
   * Results are always sorted by MEMORY_SORT_COMPARATOR (I-13 determinism).
   */
  async read(
    userId:             string,
    keys:               ReadonlyArray<MemoryKey> | undefined,
    allowedNamespaces:  ReadonlyArray<MemoryNamespace>,
  ): Promise<ReadonlyArray<MemoryEntry>> {
    // I-13: validate every requested key is within declared read namespaces
    if (keys !== undefined) {
      for (const k of keys) {
        if (!allowedNamespaces.includes(k.namespace)) {
          throw new Error(
            `I-13 violation: namespace '${k.namespace}' not declared in tool's readNamespaces`,
          );
        }
      }
    }

    const raw = await this._store.get(userId, keys);

    // Defense in depth: filter even if keys was undefined (enforces allowed scope)
    const scoped = raw.filter(e => allowedNamespaces.includes(e.namespace));

    return sortMemoryEntries(scoped);
  }

  /**
   * Write a namespace-scoped memory entry for a user.
   *
   * I-13: throws if the entry's namespace is not in `allowedNamespaces`.
   */
  async write(
    userId:            string,
    entry:             MemoryKey & { value: unknown; ttlSeconds?: number },
    allowedNamespaces: ReadonlyArray<MemoryNamespace>,
  ): Promise<MemoryEntry> {
    if (!allowedNamespaces.includes(entry.namespace)) {
      throw new Error(
        `I-13 violation: namespace '${entry.namespace}' not declared in tool's writeNamespaces`,
      );
    }

    return this._store.set(userId, entry);
  }

  /**
   * Delete a single entry.  No I-13 check — used for explicit cleanup only.
   * Not exposed as a tool — Phase 5+ admin/retention tooling.
   */
  async delete(userId: string, key: MemoryKey): Promise<void> {
    return this._store.delete(userId, key);
  }

  /**
   * Clear all entries for a user in an optional namespace.
   * Not exposed as a tool — Phase 5+ admin/retention tooling.
   */
  async clear(userId: string, namespace?: MemoryNamespace): Promise<void> {
    logger.warn('BenjiMemoryService.clear called', {
      userId,
      ...(namespace !== undefined ? { namespace } : {}),
    });
    return this._store.clear(userId, namespace);
  }
}
