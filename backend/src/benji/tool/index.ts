/**
 * Benji V2 — Tool bootstrap
 * Phase 3
 *
 * Imports all tool definitions and registers them with benjiToolRegistry.
 * Import this module once at application startup (e.g., from benji/index.ts).
 *
 * Tool execution order for P2 compliance:
 *   tool:validate.input → (financial tools) → tool:chat.respond
 */

import { benjiToolRegistry } from './tool.registry';
import { validateInputTool }  from './validate-input.tool';
import { shipmentParseTool }  from './shipment-parse.tool';
import { chatRespondTool }    from './chat-respond.tool';
import { memoryReadTool }     from './memory-read.tool';
import { memoryWriteTool }    from './memory-write.tool';

benjiToolRegistry.register(validateInputTool);
benjiToolRegistry.register(shipmentParseTool);
benjiToolRegistry.register(chatRespondTool);
benjiToolRegistry.register(memoryReadTool);
benjiToolRegistry.register(memoryWriteTool);

export { benjiToolRegistry } from './tool.registry';
export type { ToolEventHook, ToolEventPayload } from './tool.registry';
