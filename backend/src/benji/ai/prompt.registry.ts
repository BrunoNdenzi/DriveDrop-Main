/**
 * Benji V2 — Central prompt registry
 *
 * Single lookup point for all externalized system prompts.
 * Services call the typed getters here instead of constructing prompts inline.
 *
 * Responsibilities:
 *   1. Version tracking — each prompt key maps to its active version constant
 *   2. Checksum metadata — SHA-256 (8 hex chars) of canonical prompt text at load time;
 *      detects prompt text drift when the version string was not bumped
 *   3. Typed interface — callers get compile-time checking on interpolation vars
 *   4. Bounded in-memory cache — avoids re-rendering identical prompts on every request
 *
 * Cache design:
 *   - Simple Map, max 256 entries (prompts are small strings; bounded context variants)
 *   - LRU-style eviction: oldest entry deleted when limit is reached
 *   - Dynamic prompts with unique per-request data (e.g. ocrText) bypass the cache
 */

import { createHash } from 'node:crypto';

import {
  BENJI_CHAT_PROMPT_VERSION,
  buildBenjiChatPrompt,
  type BenjiChatPromptVars,
} from './prompts/benji-chat.prompt';
import {
  NL_SHIPMENT_PROMPT_VERSION,
  NL_SHIPMENT_SYSTEM_PROMPT,
} from './prompts/nl-shipment.prompt';
import {
  DOCUMENT_OCR_PROMPT_VERSION,
  DOCUMENT_OCR_SYSTEM_PROMPT,
  DOCUMENT_OCR_USER_TEXT,
} from './prompts/document-ocr.prompt';
import {
  DOCUMENT_EXTRACTION_PROMPT_VERSION,
  buildDocumentExtractionSystemPrompt,
  buildDocumentExtractionUserContent,
} from './prompts/document-extraction.prompt';
import {
  INTENT_CLASSIFY_PROMPT_VERSION,
  INTENT_CLASSIFY_SYSTEM_PROMPT,
} from './prompts/intent-classify.prompt';

// ─── Version Registry ─────────────────────────────────────────────────────────

/** Active version for every registered prompt. */
export const PROMPT_VERSIONS = {
  'benji-chat':          BENJI_CHAT_PROMPT_VERSION,
  'nl-shipment':         NL_SHIPMENT_PROMPT_VERSION,
  'document-ocr':        DOCUMENT_OCR_PROMPT_VERSION,
  'document-extraction': DOCUMENT_EXTRACTION_PROMPT_VERSION,
  'intent-classify':     INTENT_CLASSIFY_PROMPT_VERSION,
} as const;

export type PromptServiceName = keyof typeof PROMPT_VERSIONS;

// ─── Checksum Helper ──────────────────────────────────────────────────────────

/**
 * First 8 hex chars of SHA-256(text) — computed once at module load.
 * Purpose: surface prompt text drift when version string is not bumped.
 */
function promptChecksum(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 8);
}

// ─── Checksum Metadata ────────────────────────────────────────────────────────
// benji-chat: covers all four role variants concatenated — any change to any
// variant changes the checksum, even if the version constant was not bumped.

const _benjiChatCanonical =
  buildBenjiChatPrompt({ userType: 'client' }) +
  buildBenjiChatPrompt({ userType: 'driver' }) +
  buildBenjiChatPrompt({ userType: 'admin' }) +
  buildBenjiChatPrompt({ userType: 'broker' });

export const PROMPT_METADATA: {
  readonly 'benji-chat':          { readonly version: string; readonly checksum: string };
  readonly 'nl-shipment':         { readonly version: string; readonly checksum: string };
  readonly 'document-ocr':        { readonly version: string; readonly checksum: string };
  readonly 'document-extraction': { readonly version: string; readonly checksum: string };
  readonly 'intent-classify':     { readonly version: string; readonly checksum: string };
} = {
  'benji-chat': {
    version:  PROMPT_VERSIONS['benji-chat'],
    checksum: promptChecksum(_benjiChatCanonical),
  },
  'nl-shipment': {
    version:  PROMPT_VERSIONS['nl-shipment'],
    checksum: promptChecksum(NL_SHIPMENT_SYSTEM_PROMPT),
  },
  'document-ocr': {
    version:  PROMPT_VERSIONS['document-ocr'],
    checksum: promptChecksum(DOCUMENT_OCR_SYSTEM_PROMPT + DOCUMENT_OCR_USER_TEXT),
  },
  'document-extraction': {
    version:  PROMPT_VERSIONS['document-extraction'],
    checksum: promptChecksum(buildDocumentExtractionSystemPrompt('bill_of_sale')),
  },
  'intent-classify': {
    version:  PROMPT_VERSIONS['intent-classify'],
    checksum: promptChecksum(INTENT_CLASSIFY_SYSTEM_PROMPT),
  },
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const _MAX_CACHE_SIZE = 256;
const _cache = new Map<string, string>();

function _cached(key: string, build: () => string): string {
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;

  const value = build();

  if (_cache.size >= _MAX_CACHE_SIZE) {
    // Evict the oldest entry (insertion order)
    for (const k of _cache.keys()) {
      _cache.delete(k);
      break;
    }
  }

  _cache.set(key, value);
  return value;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * BenjiChatService — role-based chat system prompt.
 *
 * Cached by (userType, currentPage, hasShipmentId).
 * Prompts with attachments are NOT cached because attachment names vary per request.
 */
export function getBenjiChatPrompt(vars: BenjiChatPromptVars): string {
  const hasAttachments = !!(vars.attachments && vars.attachments.length > 0);

  if (hasAttachments) {
    // Skip cache — attachment names are unique per request
    return buildBenjiChatPrompt(vars);
  }

  const key = [
    'benji-chat',
    PROMPT_VERSIONS['benji-chat'],
    vars.userType,
    vars.currentPage ?? '',
    vars.shipmentId ? '1' : '0',
  ].join(':');

  return _cached(key, () => buildBenjiChatPrompt(vars));
}

/**
 * NaturalLanguageShipmentService — static system prompt (no interpolation).
 * Always returns from cache after first call.
 */
export function getNlShipmentPrompt(): string {
  return _cached(
    `nl-shipment:${PROMPT_VERSIONS['nl-shipment']}`,
    () => NL_SHIPMENT_SYSTEM_PROMPT,
  );
}

/**
 * AIDocumentExtractionService — OCR pass system prompt (static).
 * Always returns from cache after first call.
 */
export function getDocumentOcrSystemPrompt(): string {
  return _cached(
    `document-ocr:${PROMPT_VERSIONS['document-ocr']}:system`,
    () => DOCUMENT_OCR_SYSTEM_PROMPT,
  );
}

/**
 * AIDocumentExtractionService — static text portion of the OCR user message.
 * (The image_url content is assembled by the service at call time.)
 */
export function getDocumentOcrUserText(): string {
  return _cached(
    `document-ocr:${PROMPT_VERSIONS['document-ocr']}:user`,
    () => DOCUMENT_OCR_USER_TEXT,
  );
}

/**
 * AIDocumentExtractionService — structured extraction system prompt.
 * Cached by documentType (bounded set of document types in production).
 *
 * @param documentType  e.g. 'bill_of_sale', 'title', 'insurance', 'inspection_report', 'other'
 */
export function getDocumentExtractionSystemPrompt(documentType: string): string {
  const key = [
    'document-extraction',
    PROMPT_VERSIONS['document-extraction'],
    documentType,
  ].join(':');

  return _cached(key, () => buildDocumentExtractionSystemPrompt(documentType));
}

/**
 * AIDocumentExtractionService — user content for the extraction pass.
 * NOT cached: ocrText is unique per document and can be arbitrarily large.
 *
 * @param ocrText  Raw OCR output from the first (vision) pass
 */
export function buildExtractionUserContent(ocrText: string): string {
  return buildDocumentExtractionUserContent(ocrText);
}

/**
 * BenjiIntentService — LLM fallback system prompt (static).
 * Always returns from cache after first call.
 */
export function getIntentClassifyPrompt(): string {
  return _cached(
    `intent-classify:${PROMPT_VERSIONS['intent-classify']}`,
    () => INTENT_CLASSIFY_SYSTEM_PROMPT,
  );
}
