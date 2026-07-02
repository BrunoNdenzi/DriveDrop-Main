/**
 * Benji V2 — BenjiIntentService
 * Phase 2C
 *
 * Deterministic-first intent classifier with LLM fallback.
 *
 * Pipeline:
 *   1. Deterministic stage — regex/keyword matching via INTENT_PATTERNS
 *      → If confidence ≥ DETERMINISTIC_CONFIDENCE_THRESHOLD (0.75): return immediately
 *      → Cost: ~0ms, no network, no token spend
 *
 *   2. LLM fallback stage — GPT-4o-mini with structured JSON output
 *      → Only reached when deterministic confidence < 0.75
 *      → Skipped if OPENAI_API_KEY is absent or LLM call fails
 *      → On failure: returns best deterministic result (source = 'fallback')
 *
 * Governance invariants:
 *   I-11 — no hidden side effects (this service is read-only; no DB writes)
 *   I-12 — LLM call goes through createChatCompletion, not raw SDK
 *
 * No route exposure in Phase 2C — the orchestrator (Phase 5) imports this service.
 */

import { createChatCompletion } from '../client/openai.client';
import { SERVICE_MODEL_MAP } from '@config/ai.config';
import { logger } from '@utils/logger';
import { getIntentClassifyPrompt } from '../prompt.registry';
import { INTENT_PATTERNS, extractEntities } from './intent.patterns';
import type {
  BenjiIntent,
  IntentClassification,
  IntentClassifyInput,
  IntentEntities,
} from './intent.types';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Minimum deterministic confidence required to skip the LLM fallback.
 * Raised to 0.90 in Phase 2C refinement — only very high-confidence regex
 * matches skip the LLM entirely.
 * Matches `intent.keywordConfidenceFloor` in benji_config.
 * Learning layer may propose adjustments within [0.60, 0.90].
 */
export const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.90;

/**
 * When the top two matched intent scores are within this delta, the result is
 * flagged as ambiguous. The orchestrator may request clarification.
 */
export const AMBIGUITY_DELTA_THRESHOLD = 0.10;

// ─── Valid Intent Set (for LLM response validation) ──────────────────────────

const VALID_INTENTS: ReadonlySet<BenjiIntent> = new Set<BenjiIntent>([
  'shipment.create',
  'shipment.track',
  'shipment.quote',
  'dispatch.find_loads',
  'dispatch.accept',
  'dispatch.route',
  'account.query',
  'support.general',
  'general.greeting',
  'unknown',
]);

function isValidIntent(value: unknown): value is BenjiIntent {
  return typeof value === 'string' && VALID_INTENTS.has(value as BenjiIntent);
}

// ─── Deterministic Classifier ─────────────────────────────────────────────────

interface DeterministicResult {
  intent:      BenjiIntent;
  confidence:  number;
  entities:    IntentEntities;
  /** Gap between 1st and 2nd ranked matched scores; undefined when only one intent matched. */
  scoreDelta?: number;
}

function runDeterministicClassifier(message: string): DeterministicResult {
  // Collect ALL matching entries so we can compute the score delta
  const matches: Array<{ intent: BenjiIntent; confidence: number }> = [];

  for (const entry of INTENT_PATTERNS) {
    if (entry.patterns.some(re => re.test(message))) {
      matches.push({ intent: entry.intent, confidence: entry.confidence });
    }
  }

  if (matches.length === 0) {
    return { intent: 'unknown', confidence: 0, entities: {} };
  }

  // Sort descending — highest confidence first
  matches.sort((a, b) => b.confidence - a.confidence);

  const first  = matches[0];
  const second = matches[1];

  // Guard against noUncheckedIndexedAccess (matches is non-empty after the guard above)
  if (!first) {
    return { intent: 'unknown', confidence: 0, entities: {} };
  }

  const scoreDelta = second !== undefined
    ? first.confidence - second.confidence
    : undefined;

  return {
    intent:     first.intent,
    confidence: first.confidence,
    entities:   extractEntities(message),
    ...(scoreDelta !== undefined ? { scoreDelta } : {}),
  };
}

// ─── LLM Response Parser ──────────────────────────────────────────────────────

function parseEntitiesFromLLM(raw: Record<string, unknown>): IntentEntities {
  const entities: IntentEntities = {};
  const oc = raw['originCity'];
  const dc = raw['destinationCity'];
  const vy = raw['vehicleYear'];
  const vm = raw['vehicleMake'];
  const vmo = raw['vehicleModel'];
  const li = raw['loadId'];
  const si = raw['shipmentId'];
  const dr = raw['rawDateRef'];

  if (typeof oc  === 'string' && oc)   entities.originCity      = oc;
  if (typeof dc  === 'string' && dc)   entities.destinationCity = dc;
  if (typeof vy  === 'number')         entities.vehicleYear     = vy;
  if (typeof vm  === 'string' && vm)   entities.vehicleMake     = vm;
  if (typeof vmo === 'string' && vmo)  entities.vehicleModel    = vmo;
  if (typeof li  === 'string' && li)   entities.loadId          = li;
  if (typeof si  === 'string' && si)   entities.shipmentId      = si;
  if (typeof dr  === 'string' && dr)   entities.rawDateRef      = dr;

  return entities;
}

// ─── LLM Fallback ─────────────────────────────────────────────────────────────

async function runLLMClassifier(
  input:            IntentClassifyInput,
  deterministicRes: DeterministicResult,
): Promise<IntentClassification> {
  const start = Date.now();

  const userContent = input.userType
    ? `User type: ${input.userType}\nMessage: ${input.message}`
    : input.message;

  try {
    const modelConfig = SERVICE_MODEL_MAP['intent-classify'];

    const completion = await createChatCompletion(
      {
        model:           modelConfig.model,
        messages: [
          { role: 'system', content: getIntentClassifyPrompt() },
          { role: 'user',   content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature:     0.1,
        max_tokens:      256,
      },
      { serviceName: 'intent-classify', ...(input.userId !== undefined ? { userId: input.userId } : {}) },
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('Empty response from intent classifier LLM');
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('LLM response is not an object');
    }

    const obj = parsed as Record<string, unknown>;
    const intent = obj['intent'];
    const confidence = obj['confidence'];
    const entitiesRaw = obj['entities'];

    if (!isValidIntent(intent)) {
      throw new Error(`LLM returned unknown intent: ${String(intent)}`);
    }

    const parsedConfidence =
      typeof confidence === 'number' && confidence >= 0 && confidence <= 1
        ? confidence
        : 0.5;

    const entities =
      typeof entitiesRaw === 'object' && entitiesRaw !== null
        ? parseEntitiesFromLLM(entitiesRaw as Record<string, unknown>)
        : extractEntities(input.message);

    const ambiguousFromDelta =
      deterministicRes.scoreDelta !== undefined &&
      deterministicRes.scoreDelta < AMBIGUITY_DELTA_THRESHOLD;
    const ambiguousFromLLM = parsedConfidence < 0.70;
    const ambiguous = ambiguousFromDelta || ambiguousFromLLM;

    return {
      intent,
      confidence:   parsedConfidence,
      entities,
      source:       'llm',
      processingMs: Date.now() - start,
      ...(deterministicRes.scoreDelta !== undefined ? { scoreDelta: deterministicRes.scoreDelta } : {}),
      ...(ambiguous ? { ambiguous: true } : {}),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('BenjiIntentService LLM fallback failed — using deterministic result', {
      error:      msg,
      message:    input.message.slice(0, 80),
      userType:   input.userType,
    });

    const ambiguous =
      deterministicRes.scoreDelta !== undefined &&
      deterministicRes.scoreDelta < AMBIGUITY_DELTA_THRESHOLD;

    // Fall back to deterministic result (may be 'unknown' with confidence 0)
    return {
      intent:       deterministicRes.intent,
      confidence:   deterministicRes.confidence,
      entities:     deterministicRes.entities,
      source:       'fallback',
      processingMs: Date.now() - start,
      ...(deterministicRes.scoreDelta !== undefined ? { scoreDelta: deterministicRes.scoreDelta } : {}),
      ...(ambiguous ? { ambiguous: true } : {}),
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class BenjiIntentService {
  /**
   * Classify the intent of a user message.
   *
   * Always tries deterministic matching first (regex, ~0ms, free).
   * Falls back to GPT-4o-mini only when deterministic confidence < 0.90.
   * Ambiguity is flagged when the top-two pattern scores are within 0.10 of each other.
   * On LLM failure, returns the best deterministic result with source='fallback'.
   */
  async classify(input: IntentClassifyInput): Promise<IntentClassification> {
    const start = Date.now();

    const deterministicRes = runDeterministicClassifier(input.message);

    if (deterministicRes.confidence >= DETERMINISTIC_CONFIDENCE_THRESHOLD) {
      const ambiguous =
        deterministicRes.scoreDelta !== undefined &&
        deterministicRes.scoreDelta < AMBIGUITY_DELTA_THRESHOLD;
      return {
        intent:       deterministicRes.intent,
        confidence:   deterministicRes.confidence,
        entities:     deterministicRes.entities,
        source:       'deterministic',
        processingMs: Date.now() - start,
        ...(deterministicRes.scoreDelta !== undefined ? { scoreDelta: deterministicRes.scoreDelta } : {}),
        ...(ambiguous ? { ambiguous: true } : {}),
      };
    }

    // Deterministic confidence insufficient — escalate to LLM
    if (!process.env['OPENAI_API_KEY']) {
      logger.warn('BenjiIntentService: OPENAI_API_KEY not set, skipping LLM fallback', {
        detConfidence: deterministicRes.confidence,
        message:       input.message.slice(0, 80),
      });
      const ambiguous =
        deterministicRes.scoreDelta !== undefined &&
        deterministicRes.scoreDelta < AMBIGUITY_DELTA_THRESHOLD;
      return {
        intent:       deterministicRes.intent,
        confidence:   deterministicRes.confidence,
        entities:     deterministicRes.entities,
        source:       'fallback',
        processingMs: Date.now() - start,
        ...(deterministicRes.scoreDelta !== undefined ? { scoreDelta: deterministicRes.scoreDelta } : {}),
        ...(ambiguous ? { ambiguous: true } : {}),
      };
    }

    return runLLMClassifier(input, deterministicRes);
  }
}

export const benjiIntentService = new BenjiIntentService();
