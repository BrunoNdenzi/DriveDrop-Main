/**
 * Benji V2 — tool:memory.read
 * Phase 4
 *
 * isMutation: false — reads do not emit events (I-8 applies only to writes)
 * namespaceAccess.read: declared and enforced by BenjiMemoryService (I-13)
 */

import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';
import type { MemoryNamespace, MemoryKey, MemoryEntry } from '@benji/core/types/memory.types';
import { benjiMemoryService } from '@benji/memory';

export interface MemoryReadInput {
  userId: string;
  /**
   * Optional subset of namespaced keys to fetch.
   * Omit to fetch all declared-namespace entries for this user.
   */
  keys?:  ReadonlyArray<MemoryKey>;
}

export interface MemoryReadOutput {
  memories: ReadonlyArray<MemoryEntry>;
}

/** Namespaces this tool is permitted to read (I-13). */
const READ_NAMESPACES: ReadonlyArray<MemoryNamespace> = [
  'user.preferences',
  'user.vehicles',
  'user.history',
  'session.context',
  'dispatch.state',
  'shipment.draft',
];

function isMemoryReadInput(input: unknown): input is MemoryReadInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['userId'] === 'string';
}

export const memoryReadTool: ToolDefinition<MemoryReadInput, MemoryReadOutput> = {
  name:        'tool:memory.read',
  description: 'Read namespace-scoped persisted user memory entries (I-13 enforced).',
  isMutation:  false,
  namespaceAccess: { read: READ_NAMESPACES },
  validate:    isMemoryReadInput,

  execute: async (input: MemoryReadInput, _context: ToolContext): Promise<MemoryReadOutput> => {
    const memories = await benjiMemoryService.read(input.userId, input.keys, READ_NAMESPACES);
    return { memories };
  },
};
