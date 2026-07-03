/**
 * Benji V2 — Shared OpenAI client
 *
 * Single singleton that replaces the three independent `new OpenAI(...)` instances
 * previously created inside:
 *   - services/BenjiChatService.ts
 *   - services/NaturalLanguageShipmentService.ts
 *   - services/AIDocumentExtractionService.ts
 *
 * Provides:
 *   openaiClient          — raw singleton for direct use (services, Phase 2A)
 *   createChatCompletion  — retry-wrapped call with token hooks (orchestrator, Phase 5)
 *   registerTokenUsageHook — register a callback for Phase 4 DB-backed token logging
 *   getModelConfig        — look up model config by Benji service name
 */

import OpenAI from 'openai';
import { AI_MODELS, SERVICE_MODEL_MAP, type AIServiceName, type ModelConfig } from '@config/ai.config';
import { logger } from '@utils/logger';

// ─── Token Usage Hooks ────────────────────────────────────────────────────────
// Hooks registered here are called after every successful createChatCompletion call.
// No hooks are registered by default — Phase 4 (memory layer) will register one
// that writes to the ai_usage_logs table in Supabase.

export interface TokenUsageEvent {
  serviceName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  userId?: string;
}

export type TokenUsageHook = (event: TokenUsageEvent) => void;

const _tokenUsageHooks: TokenUsageHook[] = [];

/**
 * Register a hook that fires after every successful createChatCompletion call.
 * Safe to call multiple times — all registered hooks are called in order.
 * Hooks must not throw; errors inside hooks are silently swallowed.
 */
export function registerTokenUsageHook(hook: TokenUsageHook): void {
  _tokenUsageHooks.push(hook);
}

// ─── Singleton Client ─────────────────────────────────────────────────────────

if (!process.env['OPENAI_API_KEY']) {
  logger.warn('OPENAI_API_KEY is not set — AI features will be unavailable until it is configured');
}

/**
 * Singleton OpenAI client.
 * Import this everywhere instead of calling `new OpenAI(...)`.
 */
export const openaiClient = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

// ─── Retry Logic ──────────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 200;
const DEFAULT_MAX_RETRIES = 3;

function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return RETRYABLE_STATUS_CODES.has(error.status);
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const modelConfig: ModelConfig | undefined = AI_MODELS[model];
  if (!modelConfig) return 0;
  return (
    (promptTokens / 1_000_000) * modelConfig.costPer1MInput +
    (completionTokens / 1_000_000) * modelConfig.costPer1MOutput
  );
}

export interface ChatCompletionOptions {
  /** Benji service name for token tracking (e.g. 'benji-chat') */
  serviceName?: string;
  /** User ID for per-user cost attribution */
  userId?: string;
  /** Override default retry count (default: 3) */
  maxRetries?: number;
}

/**
 * Chat completion with automatic retry on transient errors and token usage hooks.
 *
 * Retry schedule (exponential backoff, jitter-free):
 *   attempt 1 failure → wait  200ms → retry
 *   attempt 2 failure → wait  400ms → retry
 *   attempt 3 failure → wait  800ms → throw
 *
 * Retried errors: 429, 500, 502, 503, 504
 * Non-retried errors: 401, 403, 422, all others — thrown immediately
 *
 * Token hooks fire after success; hook errors never propagate.
 *
 * Use this in the Phase 5 orchestrator.
 * Existing services call openaiClient.chat.completions.create() directly (Phase 2A).
 */
export async function createChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  options: ChatCompletionOptions = {},
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const startTime = Date.now();

  // ── INSTRUMENTATION ────────────────────────────────────────────────────
  console.log('[BENJI_AUDIT] OPENAI_CALL_START', {
    service: options.serviceName ?? 'unknown',
    model:   params.model,
    ts:      new Date().toISOString(),
  });
  // ───────────────────────────────────────────────────────────────────────

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openaiClient.chat.completions.create(params);

      // ── INSTRUMENTATION ──────────────────────────────────────────────────
      console.log('[BENJI_AUDIT] OPENAI_CALL_END', {
        service:  options.serviceName ?? 'unknown',
        model:    params.model,
        tokens:   completion.usage?.total_tokens ?? 0,
        durationMs: Date.now() - startTime,
        ts:       new Date().toISOString(),
      });
      // ─────────────────────────────────────────────────────────────────────

      // Fire token hooks — never block the response
      if (_tokenUsageHooks.length > 0 && completion.usage) {
        const usage = completion.usage;
        const event: TokenUsageEvent = {
          serviceName:      options.serviceName ?? 'unknown',
          model:            params.model,
          promptTokens:     usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens:      usage.total_tokens,
          estimatedCostUsd: estimateCost(params.model, usage.prompt_tokens, usage.completion_tokens),
          durationMs:       Date.now() - startTime,
          ...(options.userId !== undefined ? { userId: options.userId } : {}),
        };
        for (const hook of _tokenUsageHooks) {
          try { hook(event); } catch { /* hooks never interrupt the response */ }
        }
      }

      return completion;
    } catch (error: unknown) {
      const isLast = attempt === maxRetries;
      if (!isRetryableError(error) || isLast) {
        throw error;
      }
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
      logger.warn('OpenAI transient error — retrying', {
        attempt:    attempt + 1,
        maxRetries,
        delayMs,
        model:      params.model,
      });
      await sleep(delayMs);
    }
  }

  // Unreachable — TypeScript needs explicit return
  throw new Error('createChatCompletion: retry loop exhausted without throwing');
}

// ─── Model Helpers ────────────────────────────────────────────────────────────

/** Look up model config for a named Benji AI service. Returns undefined if not found. */
export function getModelConfig(serviceName: AIServiceName): ModelConfig {
  return SERVICE_MODEL_MAP[serviceName];
}

// Re-export so callers don't need a separate ai.config import for model metadata
export { AI_MODELS, SERVICE_MODEL_MAP };
