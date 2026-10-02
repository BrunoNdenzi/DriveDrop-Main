export interface LatLngPoint {
  lat: number
  lng: number
}

export interface SimPath {
  points: LatLngPoint[]
  legOf: number[]
  cumulative: number[]
  legEnds: number[]
  total: number
}

export interface SimPosition extends LatLngPoint {
  heading: number
  leg: number
}

const EARTH_RADIUS_METERS = 6371000
const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

export function distanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDegrees(a: LatLngPoint, b: LatLngPoint): number {
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat))
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Each entry is one leg's road geometry; legEnds[k] is the distance at which leg k reaches its stop.
export function buildSimPath(legs: LatLngPoint[][]): SimPath {
  const points: LatLngPoint[] = []
  const legOf: number[] = []
  const cumulative: number[] = []
  const legEnds: number[] = []
  let total = 0

  legs.forEach((legPoints, leg) => {
    for (const point of legPoints) {
      const previous = points[points.length - 1]
      if (previous && previous.lat === point.lat && previous.lng === point.lng) continue
      if (previous) total += distanceMeters(previous, point)
      points.push(point)
      legOf.push(leg)
      cumulative.push(total)
    }
    legEnds.push(total)
  })

  return { points, legOf, cumulative, legEnds, total }
}

export function positionAt(path: SimPath, meters: number): SimPosition | null {
  const count = path.points.length
  if (count === 0) return null
  if (count === 1) return { ...path.points[0]!, heading: 0, leg: path.legOf[0]! }

  const distance = Math.min(Math.max(meters, 0), path.total)
  let low = 0
  let high = count - 2
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if (path.cumulative[mid]! <= distance) low = mid
    else high = mid - 1
  }

  const from = path.points[low]!
  const to = path.points[low + 1]!
  const length = path.cumulative[low + 1]! - path.cumulative[low]!
  const t = length > 0 ? (distance - path.cumulative[low]!) / length : 0

  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
    heading: bearingDegrees(from, to),
    leg: path.legOf[low + 1]!,
  }
}
