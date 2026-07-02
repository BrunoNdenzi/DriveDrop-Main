/**
 * Benji V2 — Events module bootstrap
 * Phase 4
 *
 * Creates the BenjiEventService singleton and registers it as:
 *   1. ToolEventHook on benjiToolRegistry  (I-8: tool mutations → benji_events)
 *   2. TokenUsageHook on openai.client.ts  (every LLM call → ai_usage_logs)
 *
 * Import this module once at application startup, AFTER benji/tool/index.ts
 * has been imported (so benjiToolRegistry already has tools registered).
 *
 * Import order at app startup:
 *   1. import '@benji/tool'           ← registers all tools
 *   2. import '@benji/events'         ← wires event hooks  ← THIS FILE
 */

import { benjiToolRegistry }      from '@benji/tool/tool.registry';
import { registerTokenUsageHook } from '@benji/ai/client/openai.client';
import { BenjiEventService }      from './benji-event.service';

export const benjiEventService = new BenjiEventService();

// 1. Tool lifecycle events → benji_events table (I-8)
benjiToolRegistry.registerEventHook(event => benjiEventService.onToolEvent(event));

// 2. LLM token usage → ai_usage_logs table
registerTokenUsageHook(event => benjiEventService.onTokenUsage(event));

export { BenjiEventService } from './benji-event.service';
