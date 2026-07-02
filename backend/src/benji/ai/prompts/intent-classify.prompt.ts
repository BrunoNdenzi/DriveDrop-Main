/**
 * Benji V2 — LLM fallback prompt for BenjiIntentService
 * Version: v1
 *
 * Used only when deterministic classifier confidence < DETERMINISTIC_CONFIDENCE_THRESHOLD.
 * Moved here during Phase 2C so the classifier has no inline strings.
 */

export const INTENT_CLASSIFY_PROMPT_VERSION = 'v1' as const;

/**
 * Static system prompt — the full intent taxonomy is listed here so the LLM
 * returns a consistent, parseable enum value in its JSON output.
 */
export const INTENT_CLASSIFY_SYSTEM_PROMPT = `Classify the user message into exactly one intent category and return structured JSON.

Intent categories:
- shipment.create     : User wants to create, request, or initiate a new vehicle shipment
- shipment.track      : User wants to track an existing shipment or know its current location/status
- shipment.quote      : User wants a price estimate, quote, or cost for shipping
- dispatch.find_loads : Driver looking for available loads, jobs, or pickups to accept
- dispatch.accept     : Driver wants to accept or take a specific load (load ID may be present)
- dispatch.route      : Driver wants route optimization, a multi-stop plan, or daily schedule
- account.query       : User asking about their account, earnings, rating, payment, or history
- support.general     : General question, how-to request, or informational query
- general.greeting    : Greeting, opener, or asking what the assistant can do
- unknown             : Does not fit any of the above categories

Return ONLY valid JSON — no explanation, no markdown:
{
  "intent": "<one of the categories above>",
  "confidence": <number 0.0 to 1.0>,
  "entities": {
    "originCity":      "<string or null>",
    "destinationCity": "<string or null>",
    "vehicleYear":     <number or null>,
    "vehicleMake":     "<string or null>",
    "vehicleModel":    "<string or null>",
    "loadId":          "<string or null>",
    "shipmentId":      "<string or null>",
    "rawDateRef":      "<string or null>"
  }
}

Rules:
1. Set confidence to reflect how clearly the message maps to the intent (0.95 = very clear, 0.60 = ambiguous)
2. Only populate entity fields that are explicitly mentioned — use null for absent fields
3. Never add fields not listed above`;
