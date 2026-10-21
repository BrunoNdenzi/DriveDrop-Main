// What a driver says to Benji is a transcript, so names get misheard and a wake phrase can come along with it.
export function normalizeHeard(raw: string): string {
  return raw
    .trim()
    .replace(/\b(benny|bengie|bengi|binji|bendy|banji)\b/gi, 'Benji')
    .replace(/^(?:hey|hi|hello|ok(?:ay)?|yo)[\s,]+benji\b[\s,.!?]*/i, '')
    .replace(/^benji\b[\s,.!?]*/i, '')
    .trim()
}

const YES = /^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|do it|go ahead|go for it|please(?: do)?|sounds good|that works|affirmative|correct|right)\b/i
const NO = /^(?:no|nope|nah|don'?t|do not|not now|cancel|never ?mind|leave it|negative)\b/i

export const isYes = (text: string): boolean => YES.test(text.trim())
export const isNo = (text: string): boolean => NO.test(text.trim())

// Words that help the recognizer: Benji's vocabulary plus names from today's route, trimmed to what a recognizer accepts.
export function recognitionHints(stops: Array<{ name?: string; address?: string; customerName?: string }>): string[] {
  const base = ['Benji', 'ETA', 'drop-off', 'pickup', 'delivery', 'dispatcher', 'bill of lading', 'proof of delivery', 're-plan', 'road blocked', 'detour']
  const fromStops = stops.flatMap(stop => [
    stop.customerName,
    stop.name,
    // Street names are what a driver says out loud; the city and ZIP rarely are.
    stop.address?.split(',')[0]?.replace(/^\d+\s+/, ''),
  ])
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...base, ...fromStops]) {
    const hint = item?.replace(/\s+/g, ' ').trim()
    if (!hint || hint.length < 3 || hint.length > 40 || /^(?:start|stop \d+)$/i.test(hint) || seen.has(hint.toLowerCase())) continue
    seen.add(hint.toLowerCase())
    out.push(hint)
    if (out.length >= 60) break
  }
  return out
}
