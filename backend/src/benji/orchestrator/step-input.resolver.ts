/**
 * Benji V2 — Step Input Resolver
 * Phase 8.8
 *
 * Derives the correct tool input for each step based on the current
 * OrchestratorRequest and prior tool outputs. Called by both
 * BenjiOrchestrator.executeSteps() and StreamingOrchestrator's inline
 * step loop, avoiding duplicated input-building logic.
 *
 * Design:
 *   - Pure function — no side effects, no DB access
 *   - Falls back to step.input (if the plan builder set it) or {} for unknown tools
 *   - Prior outputs allow downstream tools (e.g. validate.input) to consume
 *     the result of upstream tools (e.g. shipment.parse)
 */

import type { OrchestratorRequest } from '@benji/core/types/orchestrator.types';
import type { ToolResult }           from '@benji/core/types/tool.types';

// ─── Prior-output extractor ───────────────────────────────────────────────────

/**
 * Extract the structured data produced by tool:shipment.parse from prior outputs.
 * Used by tool:validate.input to validate the parsed shipment fields.
 */
function _extractParsedData(
  priorOutputs: Record<string, ToolResult<unknown>>,
): Record<string, unknown> {
  for (const r of Object.values(priorOutputs)) {
    const stamped = r as ToolResult<unknown> & { _stepAction?: string };
    if (stamped._stepAction === 'tool:shipment.parse' && r.success && r.data !== undefined) {
      return (r.data as Record<string, unknown>);
    }
  }
  return {};
}

// ─── Public resolver ──────────────────────────────────────────────────────────

/**
 * Build the input record for a given tool action.
 *
 * @param action        Registered tool name (e.g. 'tool:chat.respond')
 * @param stepInput     Optional step-level input already set by the plan builder — used as-is if set
 * @param request       The originating orchestrator request
 * @param priorOutputs  Outputs from steps that have already executed this session
 * @param intent        The classified intent for the current request
 */
export function resolveStepInput(
  action:       string,
  stepInput:    unknown,
  request:      OrchestratorRequest,
  priorOutputs: Record<string, ToolResult<unknown>>,
  intent:       string | undefined,
): Record<string, unknown> {
  // If the plan builder explicitly set an input, honour it
  if (stepInput !== undefined && stepInput !== null && typeof stepInput === 'object') {
    const keys = Object.keys(stepInput as object);
    if (keys.length > 0) return stepInput as Record<string, unknown>;
  }

  switch (action) {
    case 'tool:validate.input':
      return {
        intent: intent ?? (request._classifiedIntent ?? 'general.inquiry'),
        data:   _extractParsedData(priorOutputs),
      };

    case 'tool:shipment.parse':
      return {
        user_id:      request.userId,
        input_text:   request.message,
        input_method: 'text',
      };

    case 'tool:chat.respond':
      return {
        messages: [{ role: 'user', content: request.message }],
        context: {
          userId:   request.userId,
          userType: request.userType,
          ...(request.sessionId !== undefined ? { currentPage: request.sessionId } : {}),
        },
      };

    case 'tool:memory.read':
      return { userId: request.userId };

    default:
      // tool:memory.write and any custom tools must have their input
      // set via step.input in the plan builder.
      return {};
  }
}
