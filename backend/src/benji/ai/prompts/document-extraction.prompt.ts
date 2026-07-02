/**
 * Benji V2 — Prompts for AIDocumentExtractionService (structured extraction pass)
 * Version: v1
 *
 * Moved from AIDocumentExtractionService.extractStructuredData() during Phase 2B.
 * Exact prompt text preserved; no behavior change.
 *
 * @param documentType  The document type string from the call site (e.g. 'bill_of_sale')
 * @returns             Rendered system prompt string
 */

export const DOCUMENT_EXTRACTION_PROMPT_VERSION = 'v1' as const;

export function buildDocumentExtractionSystemPrompt(documentType: string): string {
  return `You are a document extraction specialist for vehicle shipping documents.
Extract structured data from the OCR text into JSON format.
Document type: ${documentType}

IMPORTANT: Return ONLY valid JSON with these possible fields (omit any field you cannot confidently extract):
- vehicle_info: {vin?, year?, make?, model?, color?, mileage?, license_plate?}
- seller_info: {name?, address?, phone?, email?}
- buyer_info: {name?, address?, phone?, email?}
- sale_info: {sale_date?, sale_price?, payment_method?}
- insurance_info: {policy_number?, provider?, coverage_amount?, expiration_date?}
- inspection_info: {inspection_date?, inspector_name?, pass_status?, notes?}

Rules:
1. Only include fields with high confidence
2. Use correct data types (numbers for year/mileage/price, strings for text)
3. Normalize values (e.g., "HONDA" → "Honda", dates to ISO format)
4. Return empty object {} if no data can be extracted
5. MUST be valid JSON - no explanations, no markdown, just JSON`;
}

/** User content for the extraction pass. */
export function buildDocumentExtractionUserContent(ocrText: string): string {
  return `Extract data from this OCR text:\n\n${ocrText}`;
}
