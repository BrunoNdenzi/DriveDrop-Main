/**
 * Benji V2 — BenjiToolRegistry
 * Phase 3 / Phase 4.5
 *
 * Central registry for all Benji tools. Provides:
 *   - register<TIn, TOut>(def) — typed registration at startup
 *   - execute(name, input, context) — wrapped execution returning ToolResult<unknown>
 *   - has(name) / list() / describe(name) — introspection for orchestrator + simulation engine
 *   - registerEventHook(hook) — I-8 event emission for mutation tools
 *
 * Execution wrapper responsibilities:
 *   1. Input validation   — calls def.validate(input) if provided; short-circuits on failure
 *   2. Timing             — measures durationMs precisely
 *   3. Error isolation    — catches all errors; never throws; returns ToolResult.success = false
 *   4. Event emission     — durability-aware hook dispatch for mutation tools (I-8A)
 *      'async' events → fire-and-forget (current tool lifecycle events)
 *      'await' events → block until all hooks complete; failure = tool failure
 *   5. _stepAction stamp  — sets _stepAction = toolName for GlobalPolicyGuard P2
 *
 * Phase 4 wires BenjiEventService as an event hook.
 */

import { logger } from '@utils/logger';
import {
  type BenjiEventType,
  EVENT_DURABILITY,
  type EventDurability,
} from '@benji/core/events/event.types';
import {
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  toolSuccess,
  toolFailure,
} from '@benji/core/types/tool.types';
import type { NamespaceAccess } from '@benji/core/types/memory.types';

// ─── Event Hook Types ─────────────────────────────────────────────────────────

/**
 * Payload emitted to every registered hook after a mutation tool completes or fails.
 * traceId and stepId are always present (from the now-mandatory ToolContext fields).
 */
export interface ToolEventPayload {
  eventType:   Extract<BenjiEventType, 'tool_completed' | 'tool_failed'>;
  toolName:    string;
  requestId:   string;
  traceId:     string;    // mandatory — from context.traceId (I-14)
  stepId:      string;    // mandatory — from context.stepId
  durationMs:  number;
  success:     boolean;
  userId?:     string;
  errorCode?:  string;
}

/**
 * Hook signature. May be async.
 * 'async' events: fire-and-forget, errors logged but not propagated.
 * 'await' events: awaited in sequence; first failure aborts and returns tool failure.
 */
export type ToolEventHook = (event: ToolEventPayload) => void | Promise<void>;

// ─── Internal Storage Type ────────────────────────────────────────────────────

// Erases TInput/TOutput generics at the storage boundary — safe because execute()
// is only called by the registry, which received the raw input from the caller.
interface StoredToolDef {
  readonly name:             string;
  readonly description:      string;
  readonly isMutation:       boolean;
  readonly namespaceAccess?: NamespaceAccess;
  readonly validate?:        (input: unknown) => boolean;
  readonly execute:          (input: unknown, context: ToolContext) => Promise<unknown>;
}

// ─── Registry Class ───────────────────────────────────────────────────────────

class BenjiToolRegistry {
  private readonly _tools = new Map<string, StoredToolDef>();
  private readonly _hooks: ToolEventHook[] = [];

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a typed tool. Call once per tool at application startup (benji/tool/index.ts).
   * Re-registering the same name overwrites the previous definition and logs a warning.
   *
   * I-13 advisory: if isMutation = true and no writeNamespaces declared, a warning is logged.
   */
  register<TIn, TOut>(def: ToolDefinition<TIn, TOut>): void {
    if (this._tools.has(def.name)) {
      logger.warn('BenjiToolRegistry: overwriting existing tool', { toolName: def.name });
    }

    // I-13 advisory — warn when a mutation tool omits writeNamespaces
    if (def.isMutation && (def.namespaceAccess?.write === undefined || def.namespaceAccess.write.length === 0)) {
      logger.warn('BenjiToolRegistry: mutation tool has no declared writeNamespaces (I-13)', {
        toolName: def.name,
      });
    }

    const stored: StoredToolDef = {
      name:        def.name,
      description: def.description,
      isMutation:  def.isMutation,
      ...(def.namespaceAccess !== undefined ? { namespaceAccess: def.namespaceAccess } : {}),
      ...(def.validate        !== undefined ? { validate:        def.validate        } : {}),
      execute: def.execute as (input: unknown, context: ToolContext) => Promise<unknown>,
    };

    this._tools.set(def.name, stored);
  }

  /**
   * Register an event hook fired after every mutation tool execution.
   * Hooks are fired asynchronously (non-blocking) — errors inside hooks are logged, not thrown.
   * Phase 4: BenjiEventService registers here to persist benji_events rows (I-8).
   */
  registerEventHook(hook: ToolEventHook): void {
    this._hooks.push(hook);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Execute a tool by name. Never throws — all errors are captured in ToolResult.
   *
   * @param name     Registered tool name, e.g. 'tool:validate.input'
   * @param input    Raw input (validated by def.validate() if provided)
   * @param context  Request context threaded from the orchestrator
   */
  async execute(
    name:    string,
    input:   unknown,
    context: ToolContext,
  ): Promise<ToolResult<unknown>> {
    const tool = this._tools.get(name);

    if (!tool) {
      logger.warn('BenjiToolRegistry: unknown tool requested', {
        toolName:  name,
        requestId: context.requestId,
      });
      return toolFailure(name, `Tool not registered: ${name}`, 0, 'TOOL_NOT_FOUND', context.stepId);
    }

    // Input validation (pre-execution guard)
    if (tool.validate !== undefined && !tool.validate(input)) {
      return toolFailure(name, `Input validation failed for ${name}`, 0, 'INVALID_INPUT', context.stepId);
    }

    const start = Date.now();

    try {
      const data       = await tool.execute(input, context);
      const durationMs = Date.now() - start;
      const result     = toolSuccess(name, data, durationMs, context.stepId);

      if (tool.isMutation) {
        const payload: ToolEventPayload = {
          eventType:  'tool_completed',
          toolName:   name,
          requestId:  context.requestId,
          traceId:    context.traceId,
          stepId:     context.stepId,
          durationMs,
          success:    true,
          ...(context.userId !== undefined ? { userId: context.userId } : {}),
        };
        const hookFailure = await this._dispatchHooks(payload, EVENT_DURABILITY['tool_completed']);
        if (hookFailure !== undefined) {
          return toolFailure(name, `Critical event hook failed: ${hookFailure}`, durationMs, 'EVENT_HOOK_FAILED', context.stepId);
        }
      }

      return result;
    } catch (error: unknown) {
      const durationMs = Date.now() - start;
      const msg        = error instanceof Error ? error.message : String(error);

      logger.warn('BenjiToolRegistry: tool execution threw', {
        toolName:  name,
        requestId: context.requestId,
        error:     msg,
        ...(context.stepId !== undefined ? { stepId: context.stepId } : {}),
      });

      if (tool.isMutation) {
        const payload: ToolEventPayload = {
          eventType:  'tool_failed',
          toolName:   name,
          requestId:  context.requestId,
          traceId:    context.traceId,
          stepId:     context.stepId,
          durationMs,
          success:    false,
          errorCode:  'EXECUTION_ERROR',
          ...(context.userId !== undefined ? { userId: context.userId } : {}),
        };
        await this._dispatchHooks(payload, EVENT_DURABILITY['tool_failed']);
      }

      return toolFailure(name, msg, durationMs, 'EXECUTION_ERROR', context.stepId);
    }
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  has(name: string): boolean {
    return this._tools.has(name);
  }

  list(): string[] {
    return [...this._tools.keys()];
  }

  describe(name: string): {
    name:             string;
    description:      string;
    isMutation:       boolean;
    namespaceAccess?: NamespaceAccess;
  } | undefined {
    const tool = this._tools.get(name);
    if (!tool) return undefined;
    return {
      name:        tool.name,
      description: tool.description,
      isMutation:  tool.isMutation,
      ...(tool.namespaceAccess !== undefined ? { namespaceAccess: tool.namespaceAccess } : {}),
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Dispatch hooks with durability-aware semantics (I-8A).
   *   'async' — all hooks fire as independent microtasks; failures are logged only.
   *   'await' — hooks run sequentially; first failure returns the error message,
   *             causing the registry to convert the tool result to a failure.
   * Returns undefined on success, or an error message string if a critical hook failed.
   */
  private async _dispatchHooks(
    event:      ToolEventPayload,
    durability: EventDurability,
  ): Promise<string | undefined> {
    if (durability === 'async') {
      for (const hook of this._hooks) {
        void Promise.resolve()
          .then(() => hook(event))
          .catch((err: unknown) => {
            logger.warn('BenjiToolRegistry: async event hook threw', {
              eventType: event.eventType,
              toolName:  event.toolName,
              error:     err instanceof Error ? err.message : String(err),
            });
          });
      }
      return undefined;
    }

    // 'await': sequential, fail-fast
    for (const hook of this._hooks) {
      try {
        await Promise.resolve(hook(event));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn('BenjiToolRegistry: critical (await) event hook failed', {
          eventType: event.eventType,
          toolName:  event.toolName,
          error:     msg,
        });
        return msg;
      }
    }
    return undefined;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const benjiToolRegistry = new BenjiToolRegistry();
