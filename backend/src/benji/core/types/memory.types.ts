/**
 * Benji V2 — Typed Memory Namespaces
 * Phase 3 (enforced in Phase 4 by BenjiMemoryService)
 *
 * Governance I-13: Memory reads and writes are namespace-scoped.
 * A tool may only access namespaces explicitly declared in its
 * ToolDefinition.readNamespaces / writeNamespaces.
 *
 * ─ NAMESPACE NAMING CONVENTION ────────────────────────────────────────────
 * ALWAYS use dotted notation: `<domain>.<subdomain>` (e.g., `dispatch.state`).
 * NEVER use underscores, camelCase, or uppercase.
 * Segments must be lowercase ASCII letters only.
 *
 * ─ SORT ORDER (I-13 determinism) ───────────────────────────────────
 * BenjiMemoryService MUST apply MEMORY_SORT_COMPARATOR before returning results.
 * This guarantees identical inputs always produce identical output order.
 * Primary: namespace (lexicographic ASC)
 * Secondary: key (lexicographic ASC)
 * Tertiary: updatedAt (lexicographic DESC — most-recent first on key collisions)
 */

// ─── Namespace Registry ───────────────────────────────────────────────────────

export type MemoryNamespace =
  | 'user.preferences'   // notification prefs, display settings, saved defaults
  | 'user.vehicles'      // user's saved vehicles (make/model/year/VIN)
  | 'user.history'       // past shipments, driver earnings, interaction history
  | 'session.context'    // ephemeral context for the current Benji session
  | 'dispatch.state'     // driver's active load state, current route
  | 'shipment.draft';    // in-progress shipment being assembled across turns

// ─── Memory Entry ─────────────────────────────────────────────────────────────

/**
 * A namespaced key reference — used for reads (filter subset) and
 * as the write target identifier.
 */
export interface MemoryKey {
  readonly namespace: MemoryNamespace;
  /** Fine-grained identifier within the namespace (e.g. 'preferred_make'). */
  readonly key:       string;
}

/**
 * Full memory entry as stored and returned by BenjiMemoryService.
 */
export interface MemoryEntry {
  readonly namespace:   MemoryNamespace;
  readonly key:         string;
  readonly value:       unknown;
  readonly updatedAt:   string;       // ISO-8601
  readonly ttlSeconds?: number;       // absent = permanent
}

// ─── Access Declaration (used in ToolDefinition) ─────────────────────────────

/**
 * Declared namespace access for a tool.  Used by BenjiToolRegistry (Phase 3)
 * to warn on missing declarations and by BenjiMemoryService (Phase 4) to
 * enforce I-13 at execution time.
 */
export interface NamespaceAccess {
  readonly read?:  ReadonlyArray<MemoryNamespace>;
  readonly write?: ReadonlyArray<MemoryNamespace>;
}

// ─ Deterministic Sort (I-13) ─────────────────────────────────────────────

/**
 * Canonical comparator for memory entries (see module header for sort semantics).
 * Apply before returning any array of entries from BenjiMemoryService.
 */
export const MEMORY_SORT_COMPARATOR = (
  a: MemoryEntry,
  b: MemoryEntry,
): number => {
  const ns = a.namespace.localeCompare(b.namespace);
  if (ns !== 0) return ns;
  const k = a.key.localeCompare(b.key);
  if (k !== 0) return k;
  // Tertiary: most-recent first
  return b.updatedAt.localeCompare(a.updatedAt);
};

/**
 * Return a new array of entries sorted by MEMORY_SORT_COMPARATOR.
 * Called by BenjiMemoryService before returning results to callers.
 */
export function sortMemoryEntries(entries: readonly MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort(MEMORY_SORT_COMPARATOR);
}
