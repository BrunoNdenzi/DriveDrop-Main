/**
 * Benji V2 - tool:memory.write
 * Phase 4
 *
 * isMutation: true -- every successful write emits tool_completed benji_event (I-8)
 * namespaceAccess.write: declares the four mutable namespaces (I-13)
 */

import type { ToolDefinition, ToolContext } from '@benji/core/types/tool.types';
import type { MemoryNamespace, MemoryKey, MemoryEntry } from '@benji/core/types/memory.types';
import { benjiMemoryService } from '@benji/memory';

export interface MemoryWriteInput {
  userId: string;
  entry:  MemoryKey & { value: unknown; ttlSeconds?: number };
}

export interface MemoryWriteOutput {
  stored: boolean;
  entry:  Omit<MemoryEntry, 'value'>;
}

const WRITE_NAMESPACES: ReadonlyArray<MemoryNamespace> = [
  'user.preferences',
  'user.vehicles',
  'session.context',
  'shipment.draft',
];

function isMemoryWriteInput(input: unknown): input is MemoryWriteInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  return typeof obj['userId'] === 'string' &&
         typeof obj['entry']  === 'object' && obj['entry'] !== null;
}

export const memoryWriteTool: ToolDefinition<MemoryWriteInput, MemoryWriteOutput> = {
  name:        'tool:memory.write',
  description: 'Persist a namespace-scoped user memory entry (I-13 enforced). Emits tool_completed event.',
  isMutation:  true,
  namespaceAccess: { write: WRITE_NAMESPACES },
  validate:    isMemoryWriteInput,

  execute: async (input: MemoryWriteInput, _context: ToolContext): Promise<MemoryWriteOutput> => {
    const result = await benjiMemoryService.write(input.userId, input.entry, WRITE_NAMESPACES);
    return {
      stored: true,
      entry:  {
        namespace:  result.namespace,
        key:        result.key,
        updatedAt:  result.updatedAt,
        ...(result.ttlSeconds !== undefined ? { ttlSeconds: result.ttlSeconds } : {}),
      },
    };
  },
};