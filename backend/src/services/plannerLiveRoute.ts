import { createError } from '@utils/error';
import type { RouteStop } from './RouteOptimizationService';

export const REOPTIMIZE_ORIGIN_ID = 'current-location';

const FRESH_LOCATION_MS = 10 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const ACTIVE_STATUSES = new Set(['dispatched', 'in_progress']);

export interface LocationPing {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMps: number | null;
  accuracyMeters: number | null;
  recordedAt: string;
  simulated: boolean;
  actualDistanceMiles: number | null;
}

function numberField(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw createError(`${field} is invalid`, 400, 'INVALID_INPUT');
  }
  return parsed;
}

export function parseLocationPing(body: unknown, now: Date = new Date()): LocationPing {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const latitude = numberField(input['latitude'], 'Latitude', -90, 90);
  const longitude = numberField(input['longitude'], 'Longitude', -180, 180);
  if (latitude === null || longitude === null) {
    throw createError('Latitude and longitude are required', 400, 'INVALID_INPUT');
  }

  let recordedAt = now;
  if (input['recordedAt'] !== undefined && input['recordedAt'] !== null && input['recordedAt'] !== '') {
    recordedAt = new Date(String(input['recordedAt']));
    if (Number.isNaN(recordedAt.getTime())) throw createError('Recorded time must be a valid date', 400, 'INVALID_INPUT');
    if (recordedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) {
      throw createError('Recorded time is in the future', 400, 'INVALID_INPUT');
    }
  }

  return {
    latitude,
    longitude,
    heading: numberField(input['heading'], 'Heading', 0, 360),
    speedMps: numberField(input['speedMps'], 'Speed', 0, 150),
    accuracyMeters: numberField(input['accuracyMeters'], 'Accuracy', 0, 100000),
    recordedAt: recordedAt.toISOString(),
    simulated: input['simulated'] === true,
    actualDistanceMiles: numberField(input['actualDistanceMiles'], 'Actual distance', 0, 100000),
  };
}

export interface StoredLocation {
  status: string;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_heading?: number | null;
  last_speed_mps?: number | null;
  last_accuracy_meters?: number | null;
  last_location_at?: string | null;
  last_location_simulated?: boolean | null;
}

// A finished or cancelled run never exposes where the driver is.
export function publicLastLocation(execution: StoredLocation) {
  if (!ACTIVE_STATUSES.has(execution.status)) return null;
  if (typeof execution.last_latitude !== 'number' || typeof execution.last_longitude !== 'number' || !execution.last_location_at) {
    return null;
  }
  return {
    latitude: execution.last_latitude,
    longitude: execution.last_longitude,
    heading: execution.last_heading ?? null,
    speedMps: execution.last_speed_mps ?? null,
    accuracyMeters: execution.last_accuracy_meters ?? null,
    recordedAt: execution.last_location_at,
    simulated: execution.last_location_simulated === true,
  };
}

export interface ProgressStop {
  stopId: string;
  address: string;
  name?: string;
  plannedServiceMinutes: number;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrivedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  actualLatitude?: number;
  actualLongitude?: number;
}

export interface PlannedStop {
  id: string;
  type?: RouteStop['type'];
  shipmentId?: string;
  latitude?: number;
  longitude?: number;
  timeWindow?: RouteStop['timeWindow'];
  priority?: RouteStop['priority'];
  vehicleInfo?: string;
}

const STOP_TYPES = new Set<string>(['pickup', 'delivery', 'fuel', 'rest', 'current_location', 'stop']);

export function plannedStopsFromSnapshot(snapshot: Record<string, unknown> | null | undefined): PlannedStop[] {
  const optimized = snapshot?.['optimizedResult'];
  const stops = optimized && typeof optimized === 'object' ? (optimized as Record<string, unknown>)['stops'] : undefined;
  if (!Array.isArray(stops)) return [];

  return stops.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const stop = value as Record<string, unknown>;
    if (typeof stop['id'] !== 'string') return [];
    const type = typeof stop['type'] === 'string' && STOP_TYPES.has(stop['type']) ? stop['type'] as RouteStop['type'] : undefined;
    const priority = stop['priority'] === 'high' || stop['priority'] === 'medium' || stop['priority'] === 'low' ? stop['priority'] : undefined;
    const window = stop['timeWindow'] as RouteStop['timeWindow'] | undefined;
    return [{
      id: stop['id'],
      ...(type ? { type } : {}),
      ...(typeof stop['shipmentId'] === 'string' ? { shipmentId: stop['shipmentId'] } : {}),
      ...(typeof stop['latitude'] === 'number' ? { latitude: stop['latitude'] } : {}),
      ...(typeof stop['longitude'] === 'number' ? { longitude: stop['longitude'] } : {}),
      ...(window && typeof window.earliest === 'string' && typeof window.latest === 'string' ? { timeWindow: window } : {}),
      ...(priority ? { priority } : {}),
      ...(typeof stop['vehicleInfo'] === 'string' ? { vehicleInfo: stop['vehicleInfo'] } : {}),
    }];
  });
}

export type OriginSource = 'current_location' | 'last_known' | 'last_finished_stop' | 'first_remaining';

export interface ReoptimizationInput {
  progress: ProgressStop[];
  planned: PlannedStop[];
  currentLocation: { latitude: number; longitude: number; address?: string } | null;
  lastKnown: { latitude: number; longitude: number; recordedAt: string } | null;
  now?: Date;
}

const coordinateLabel = (latitude: number, longitude: number) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

function finishedAt(stop: ProgressStop): number {
  const time = stop.completedAt ?? stop.skippedAt ?? stop.arrivedAt;
  return time ? new Date(time).getTime() : Number.NEGATIVE_INFINITY;
}

// Rebuilds the unfinished stops with their pickup/delivery pairing intact and a real starting point.
export function buildReoptimizationStops(input: ReoptimizationInput): {
  stops: RouteStop[];
  originSource: OriginSource;
  departedStopIds: string[];
} {
  const now = input.now ?? new Date();
  const planned = new Map(input.planned.map(stop => [stop.id, stop]));
  const isFinished = (stop: ProgressStop) => stop.status === 'completed' || stop.status === 'skipped';
  const isDepot = (stop: ProgressStop) => planned.get(stop.stopId)?.type === 'current_location';
  const finished = input.progress.filter(isFinished);

  const lastKnown = input.lastKnown && now.getTime() - new Date(input.lastKnown.recordedAt).getTime() <= FRESH_LOCATION_MS
    ? input.lastKnown
    : null;
  const lastFinished = finished.reduce<ProgressStop | null>(
    (latest, stop) => (!latest || finishedAt(stop) >= finishedAt(latest) ? stop : latest),
    null,
  );
  const hasRealOrigin = Boolean(input.currentLocation || lastKnown || lastFinished);

  // The depot is a departure point: once the driver is known to be elsewhere it is no longer a stop to visit.
  const departed = hasRealOrigin ? input.progress.filter(stop => !isFinished(stop) && isDepot(stop)) : [];
  const remaining = input.progress.filter(stop => !isFinished(stop) && !departed.includes(stop));
  const departedStopIds = departed.map(stop => stop.stopId);

  const remainingStops: RouteStop[] = remaining.map(stop => {
    const definition = planned.get(stop.stopId);
    const type = definition?.type && definition.type !== 'current_location' ? definition.type : 'stop';
    return {
      id: stop.stopId,
      address: stop.address,
      type,
      latitude: definition?.latitude ?? stop.actualLatitude,
      longitude: definition?.longitude ?? stop.actualLongitude,
      shipmentId: definition?.shipmentId,
      vehicleInfo: stop.name ?? definition?.vehicleInfo,
      estimatedDuration: stop.plannedServiceMinutes,
      timeWindow: definition?.timeWindow,
      priority: definition?.priority,
    };
  });

  const origin = (latitude: number, longitude: number, address?: string): RouteStop => ({
    id: REOPTIMIZE_ORIGIN_ID,
    address: address?.trim() || coordinateLabel(latitude, longitude),
    type: 'current_location',
    latitude,
    longitude,
    estimatedDuration: 0,
  });

  if (input.currentLocation) {
    const { latitude, longitude, address } = input.currentLocation;
    return { stops: [origin(latitude, longitude, address), ...remainingStops], originSource: 'current_location', departedStopIds };
  }

  if (lastKnown) {
    return {
      stops: [origin(lastKnown.latitude, lastKnown.longitude), ...remainingStops],
      originSource: 'last_known',
      departedStopIds,
    };
  }

  if (lastFinished) {
    const definition = planned.get(lastFinished.stopId);
    return {
      stops: [
        {
          id: REOPTIMIZE_ORIGIN_ID,
          address: lastFinished.address,
          type: 'current_location',
          latitude: lastFinished.actualLatitude ?? definition?.latitude,
          longitude: lastFinished.actualLongitude ?? definition?.longitude,
          estimatedDuration: 0,
        },
        ...remainingStops,
      ],
      originSource: 'last_finished_stop',
      departedStopIds,
    };
  }

  const [first, ...rest] = remainingStops;
  return {
    stops: first ? [{ ...first, type: 'current_location' }, ...rest] : [],
    originSource: 'first_remaining',
    departedStopIds,
  };
}
