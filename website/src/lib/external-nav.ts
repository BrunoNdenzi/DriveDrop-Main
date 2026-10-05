export interface NavTarget {
  address: string
  lat?: number | undefined
  lng?: number | undefined
  label?: string | undefined
}

export interface ExportPart {
  url: string
  index: number
  total: number
  stops: NavTarget[]
}

// Google Maps URLs allow 3 waypoints in a mobile browser and 9 elsewhere, and cap the URL at 2,048 characters.
export const MOBILE_WAYPOINT_LIMIT = 3
export const DESKTOP_WAYPOINT_LIMIT = 9
const MAX_URL_LENGTH = 2048

const place = (target: NavTarget): string =>
  Number.isFinite(target.lat) && Number.isFinite(target.lng) ? `${target.lat},${target.lng}` : target.address.trim()

const hasLocation = (target: NavTarget) => Boolean(target.address.trim()) || (Number.isFinite(target.lat) && Number.isFinite(target.lng))

function buildUrl(origin: NavTarget | null, stops: NavTarget[]): string {
  const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: place(stops[stops.length - 1]!) })
  if (origin) params.set('origin', place(origin))
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map(place).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function isMobileBrowser(userAgent: string): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}

// Splits the whole remaining route into consecutive Google Maps links. Each part starts where the
// previous one ended, so following them in order covers every stop. The first part has no explicit
// origin unless one is given, which lets Google start from the device's current location.
export function googleMapsRouteParts(
  targets: NavTarget[],
  { maxWaypoints = DESKTOP_WAYPOINT_LIMIT, origin = null }: { maxWaypoints?: number; origin?: NavTarget | null } = {},
): ExportPart[] {
  const stops = targets.filter(hasLocation)
  if (stops.length === 0) return []

  const perPart = Math.max(1, maxWaypoints + 1)
  const chunks: NavTarget[][] = []
  let current: NavTarget[] = []
  // Every part after the first starts at the previous part's last stop, which also counts toward the URL length.
  const originFor = (): NavTarget | null => (chunks.length === 0 ? origin : chunks[chunks.length - 1]![chunks[chunks.length - 1]!.length - 1]!)

  for (const stop of stops) {
    const candidate = [...current, stop]
    const tooLong = buildUrl(originFor(), candidate).length > MAX_URL_LENGTH
    if (current.length > 0 && (candidate.length > perPart || tooLong)) {
      chunks.push(current)
      current = [stop]
    } else {
      current = candidate
    }
  }
  if (current.length > 0) chunks.push(current)

  return chunks.map((chunk, index) => ({
    url: buildUrl(index === 0 ? origin : chunks[index - 1]![chunks[index - 1]!.length - 1]!, chunk),
    index: index + 1,
    total: chunks.length,
    stops: chunk,
  }))
}
