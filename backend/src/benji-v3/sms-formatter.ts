/**
 * Benji V4 — SMS response formatter
 *
 * Strips markdown syntax and collapses verbose LLM responses so they fit
 * within ~320 characters (2 SMS segments) when possible.
 *
 * Rules applied in order:
 *   1. Strip markdown bold (**text** → text)
 *   2. Strip markdown headers (# Heading → Heading)
 *   3. Strip backtick code spans
 *   4. Normalize bullet/list markers to simple dashes
 *   5. Collapse multiple blank lines to a single newline
 *   6. Trim leading/trailing whitespace
 *   7. If the result exceeds MAX_SMS_CHARS, truncate at the last sentence
 *      boundary before the limit and append an ellipsis
 */

const MAX_SMS_CHARS = 1500; // Hard cap — long messages still get through, just trimmed

export function formatForSms(text: string): string {
  let out = text;

  // Strip markdown bold / italic
  out = out.replace(/\*\*(.+?)\*\*/g, '$1');
  out = out.replace(/\*(.+?)\*/g,     '$1');
  out = out.replace(/_(.+?)_/g,       '$1');

  // Strip markdown headings
  out = out.replace(/^#{1,6}\s+/gm, '');

  // Strip backtick code spans
  out = out.replace(/`([^`]+)`/g, '$1');

  // Strip triple-backtick code blocks
  out = out.replace(/```[\s\S]*?```/g, '');

  // Normalize bullet markers to dash
  out = out.replace(/^[•*]\s+/gm, '- ');

  // Collapse multiple blank lines
  out = out.replace(/\n{3,}/g, '\n\n');

  // Trim
  out = out.trim();

  // Truncate if too long
  if (out.length > MAX_SMS_CHARS) {
    const truncated = out.slice(0, MAX_SMS_CHARS);
    // Try to break at the last sentence end before the limit
    const lastPeriod = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('.\n'),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
    );
    if (lastPeriod > MAX_SMS_CHARS * 0.6) {
      out = truncated.slice(0, lastPeriod + 1) + '…';
    } else {
      out = truncated.trimEnd() + '…';
    }
  }

  return out;
}
