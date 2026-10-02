interface NavTarget {
  address: string
  lat?: number | undefined
  lng?: number | undefined
}

// Google Maps URLs accept one destination plus up to nine waypoints.
const MAX_TARGETS = 10

const place = (target: NavTarget) =>
  Number.isFinite(target.lat) && Number.isFinite(target.lng) ? `${target.lat},${target.lng}` : target.address

export function googleMapsDirectionsUrl(targets: NavTarget[]): string | null {
  const chunk = targets.filter(target => target.address.trim() || Number.isFinite(target.lat)).slice(0, MAX_TARGETS)
  if (chunk.length === 0) return null

  const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: place(chunk[chunk.length - 1]!) })
  if (chunk.length > 1) params.set('waypoints', chunk.slice(0, -1).map(place).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
