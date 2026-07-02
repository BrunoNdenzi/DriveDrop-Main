/**
 * Benji V2 — Memory module bootstrap
 * Phase 4
 *
 * Selects the appropriate MemoryStore implementation at startup:
 *   - SUPABASE_SERVICE_ROLE_KEY set → SupabaseMemoryStore (production)
 *   - key absent                   → InMemoryStore (development / CI)
 *
 * Exports a singleton `benjiMemoryService` for use by memory tools.
 */

import { InMemoryStore }        from './memory.store';
import { SupabaseMemoryStore }   from './supabase-memory.store';
import { BenjiMemoryService }    from './benji-memory.service';
import { logger } from '@utils/logger';

function createStore(): InMemoryStore | SupabaseMemoryStore {
  if (process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    return new SupabaseMemoryStore();
  }
  logger.warn('BenjiMemory: SUPABASE_SERVICE_ROLE_KEY not set — using volatile InMemoryStore');
  return new InMemoryStore();
}

export const benjiMemoryService = new BenjiMemoryService(createStore());

export { BenjiMemoryService } from './benji-memory.service';
export { InMemoryStore, type MemoryStore } from './memory.store';
export { SupabaseMemoryStore } from './supabase-memory.store';
export type { MemoryEntry, MemoryKey, MemoryNamespace } from './benji-memory.service';
