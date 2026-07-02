/**
 * Benji V2 — Prompts for AIDocumentExtractionService (OCR pass)
 * Version: v1
 *
 * Moved from AIDocumentExtractionService.extractTextWithOCR() during Phase 2B.
 * Exact prompt text preserved; no behavior change.
 *
 * The OCR call uses a multi-part user message (text + image_url).
 * DOCUMENT_OCR_USER_TEXT is the static text portion; the image URL is
 * assembled by the service at call time.
 */

export const DOCUMENT_OCR_PROMPT_VERSION = 'v1' as const;

/** System prompt — no runtime interpolation required. */
export const DOCUMENT_OCR_SYSTEM_PROMPT =
  'You are an OCR specialist. Extract ALL text from the document image exactly as it appears. Preserve formatting, line breaks, and layout.';

/** Static text portion of the user message (image_url part added by service). */
export const DOCUMENT_OCR_USER_TEXT =
  'Extract all text from this document image. Include every detail you can see.';
