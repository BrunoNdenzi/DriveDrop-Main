import * as Location from 'expo-location'
import * as SecureStore from 'expo-secure-store'
import * as TaskManager from 'expo-task-manager'

export const TRACKING_TASK = 'planner-background-location'
const TRIP_KEY = 'planner-trip'
const DISCLOSURE_KEY = 'planner-location-disclosure'

// What the planner page hands over when a trip starts. The token only lets this app report this one run's position.
export interface TripConfig {
  executionId: string
  trackingToken: string
  expiresAt: string
  apiBase: string
}

export async function saveTrip(trip: TripConfig): Promise<void> {
  await SecureStore.setItemAsync(TRIP_KEY, JSON.stringify(trip))
}

export async function loadTrip(): Promise<TripConfig | null> {
  try {
    const stored = await SecureStore.getItemAsync(TRIP_KEY)
    return stored ? (JSON.parse(stored) as TripConfig) : null
  } catch {
    return null
  }
}

export const disclosureAccepted = async (): Promise<boolean> => (await SecureStore.getItemAsync(DISCLOSURE_KEY)) === '1'
export const rememberDisclosure = (): Promise<void> => SecureStore.setItemAsync(DISCLOSURE_KEY, '1')

export async function stopTracking(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) await Location.stopLocationUpdatesAsync(TRACKING_TASK)
  } catch {
    // Already stopped.
  }
  await SecureStore.deleteItemAsync(TRIP_KEY).catch(() => undefined)
}

export async function startTracking(trip: TripConfig): Promise<void> {
  await saveTrip(trip)
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) await Location.stopLocationUpdatesAsync(TRACKING_TASK)
  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 8000,
    distanceInterval: 15,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android keeps a tracking service alive only while it can show this notification.
    foregroundService: {
      notificationTitle: 'Route in progress',
      notificationBody: 'Sharing your position with your dispatcher.',
      notificationColor: '#123638',
    },
  })
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return
  const trip = await loadTrip()
  if (!trip) return
  if (Date.parse(trip.expiresAt) <= Date.now()) {
    await stopTracking()
    return
  }

  const { coords, timestamp } = data.locations[data.locations.length - 1]!
  try {
    const response = await fetch(`${trip.apiBase}/standalone-route-planner/executions/${encodeURIComponent(trip.executionId)}/native-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${trip.trackingToken}` },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...(coords.heading !== null && coords.heading >= 0 ? { heading: coords.heading } : {}),
        ...(coords.speed !== null && coords.speed >= 0 ? { speedMps: coords.speed } : {}),
        ...(coords.accuracy !== null && coords.accuracy >= 0 ? { accuracyMeters: coords.accuracy } : {}),
        recordedAt: new Date(timestamp).toISOString(),
      }),
    })
    // The run ended, was cancelled, or the token is no good: nothing left to report.
    if (response.status === 401 || response.status === 404 || response.status === 409) await stopTracking()
  } catch {
    // No signal for a moment. The next fix replaces this one, so there is nothing to retry.
  }
})
