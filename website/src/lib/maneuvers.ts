export type ManeuverGlyph = 'straight' | 'turn' | 'slight' | 'sharp' | 'uturn' | 'roundabout' | 'merge' | 'fork' | 'ramp' | 'ferry' | 'arrive'

export interface ManeuverView {
  glyph: ManeuverGlyph
  side: 'left' | 'right' | null
}

const SIDE = /(left|right)/

// Google reports maneuvers as strings such as "turn-slight-left" or "roundabout-right".
export function parseManeuver(maneuver: string | undefined, instruction = ''): ManeuverView {
  const value = (maneuver ?? '').toLowerCase()
  const side = (SIDE.exec(value)?.[1] ?? SIDE.exec(instruction.toLowerCase())?.[1] ?? null) as 'left' | 'right' | null

  if (value.startsWith('uturn')) return { glyph: 'uturn', side }
  if (value.startsWith('roundabout')) return { glyph: 'roundabout', side }
  if (value.startsWith('turn-slight')) return { glyph: 'slight', side }
  if (value.startsWith('turn-sharp')) return { glyph: 'sharp', side }
  if (value.startsWith('turn')) return { glyph: 'turn', side }
  if (value.startsWith('fork')) return { glyph: 'fork', side }
  if (value.startsWith('ramp')) return { glyph: 'ramp', side }
  if (value.startsWith('merge')) return { glyph: 'merge', side }
  if (value.startsWith('ferry')) return { glyph: 'ferry', side: null }
  if (value === 'straight') return { glyph: 'straight', side: null }

  // Older steps carry no maneuver, so fall back to the wording.
  const text = instruction.toLowerCase()
  if (/u-turn/.test(text)) return { glyph: 'uturn', side }
  if (/roundabout|traffic circle/.test(text)) return { glyph: 'roundabout', side }
  if (/slight/.test(text)) return { glyph: 'slight', side }
  if (/sharp/.test(text)) return { glyph: 'sharp', side }
  if (/\bturn\b/.test(text) && side) return { glyph: 'turn', side }
  if (/arrive|destination/.test(text)) return { glyph: 'arrive', side: null }
  return { glyph: 'straight', side: null }
}

// Rotation of an upward-pointing arrow for each glyph, in degrees clockwise.
export function arrowRotation(view: ManeuverView): number {
  const sign = view.side === 'left' ? -1 : 1
  switch (view.glyph) {
    case 'turn': return 90 * sign
    case 'slight': return 45 * sign
    case 'sharp': return 135 * sign
    case 'fork': return 25 * sign
    case 'ramp': return 35 * sign
    case 'uturn': return 180
    default: return 0
  }
}
