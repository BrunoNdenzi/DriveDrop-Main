// Truck-legal road guidance: the server routes with the vehicle's size and weight, and this turns its answer into the
// shape the navigation screen already reads from Google, so guidance, rerouting and the map line all keep working.

export interface TruckPoint {
  lat: number
  lng: number
}

export interface TruckProfile {
  heightFeet: number
  widthFeet: number
  lengthFeet: number
  grossWeightPounds: number
  axleCount: number
  hazmatTypes: string[]
}

export interface TruckRouteRequest {
  from: TruckPoint
  stops: TruckPoint[]
  profile: TruckProfile
  avoidHighways?: boolean
  avoid?: TruckPoint[]
  heading?: number
  departureTime?: string
}

export interface TruckRouteStep {
  instruction: string
  maneuver?: string
  distanceMeters: number
  durationSeconds: number
  path: TruckPoint[]
}

export interface TruckRoute {
  legs: Array<{ distanceMeters: number; durationSeconds: number; steps: TruckRouteStep[] }>
  bounds: { north: number; south: number; east: number; west: number }
}

// What navigation needs to ask for truck roads. `request` resolves to null when no road suits the vehicle.
export interface TruckRouting {
  profile: TruckProfile
  avoidHighways?: boolean
  request: (request: TruckRouteRequest) => Promise<TruckRoute | null>
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function formatMiles(meters: number): string {
  return `${(meters / 1609.34).toFixed(1)} mi`
}

export function formatMinutes(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} hr ${minutes % 60} min`
}

export interface MapsLike {
  LatLng: new (lat: number, lng: number) => unknown
  LatLngBounds: new (southWest: { lat: number; lng: number }, northEast: { lat: number; lng: number }) => unknown
}

// A Directions result in the parts the navigation screen uses, built from the truck route.
export function toDirectionsResult(route: TruckRoute, maps: MapsLike): google.maps.DirectionsResult {
  const latLng = ({ lat, lng }: TruckPoint) => new maps.LatLng(lat, lng)
  const quantity = (value: number, text: string) => ({ value, text })

  const legs = route.legs.map(leg => {
    const firstStep = leg.steps[0]
    const lastStep = leg.steps[leg.steps.length - 1]
    const start = firstStep?.path[0]
    const end = lastStep?.path[lastStep.path.length - 1]
    return {
      distance: quantity(leg.distanceMeters, formatMiles(leg.distanceMeters)),
      duration: quantity(leg.durationSeconds, formatMinutes(leg.durationSeconds)),
      duration_in_traffic: quantity(leg.durationSeconds, formatMinutes(leg.durationSeconds)),
      ...(start ? { start_location: latLng(start) } : {}),
      ...(end ? { end_location: latLng(end) } : {}),
      steps: leg.steps.map(step => ({
        instructions: escapeHtml(step.instruction),
        ...(step.maneuver ? { maneuver: step.maneuver } : {}),
        distance: quantity(step.distanceMeters, formatMiles(step.distanceMeters)),
        duration: quantity(step.durationSeconds, formatMinutes(step.durationSeconds)),
        path: step.path.map(latLng),
        start_location: latLng(step.path[0]!),
        end_location: latLng(step.path[step.path.length - 1]!),
      })),
    }
  })

  const { north, south, east, west } = route.bounds
  return {
    routes: [{ legs, bounds: new maps.LatLngBounds({ lat: south, lng: west }, { lat: north, lng: east }) }],
  } as unknown as google.maps.DirectionsResult
}
