const STORAGE_KEY = 'planner-benji-cost'

// Google lists the Neural2 voices at about $16 per million characters, with a monthly free allowance.
export const TTS_USD_PER_MILLION_CHARS = 16

export interface BenjiCost {
  day: string
  questions: number
  llmUsd: number
  ttsChars: number
}

export const today = (now = new Date()) => now.toISOString().slice(0, 10)

export const emptyCost = (day = today()): BenjiCost => ({ day, questions: 0, llmUsd: 0, ttsChars: 0 })

export function loadCost(day = today()): BenjiCost {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<BenjiCost> | null
    if (!stored || stored.day !== day) return emptyCost(day)
    return {
      day,
      questions: Number(stored.questions) || 0,
      llmUsd: Number(stored.llmUsd) || 0,
      ttsChars: Number(stored.ttsChars) || 0,
    }
  } catch {
    return emptyCost(day)
  }
}

export function saveCost(cost: BenjiCost): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cost)) } catch { /* storage unavailable */ }
}

export function summarizeCost(cost: BenjiCost) {
  const ttsUsd = (cost.ttsChars / 1_000_000) * TTS_USD_PER_MILLION_CHARS
  return { llmUsd: cost.llmUsd, ttsUsd, totalUsd: cost.llmUsd + ttsUsd }
}

export function formatUsd(value: number): string {
  if (value <= 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}
