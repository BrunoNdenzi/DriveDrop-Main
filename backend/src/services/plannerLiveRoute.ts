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
  isReturn?: boolean;
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
      ...(stop['isReturn'] === true ? { isReturn: true } : {}),
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
      ...(definition?.isReturn ? { isReturn: true, pinnedLast: true } : {}),
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

// ── Arrival verification ───────────────────────────────────────────────

export const ARRIVAL_OVERRIDE_CODES = ['customer_elsewhere', 'gate_or_access', 'address_wrong', 'gps_inaccurate', 'other'] as const;
export type ArrivalOverrideCode = typeof ARRIVAL_OVERRIDE_CODES[number];
export type ArrivalVerdict = 'verified' | 'outside' | 'unreliable';

export interface ArrivalRecord {
  verdict: ArrivalVerdict;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  radiusMeters: number;
  targetLatitude: number;
  targetLongitude: number;
  overrideCode?: ArrivalOverrideCode;
  overrideNote?: string;
  checkedAt: string;
}

const MIN_RADIUS_METERS = 50;
const MAX_RADIUS_METERS = 500;
const DEFAULT_RADIUS_METERS = 150;
const UNRELIABLE_ACCURACY_METERS = 200;
const MAX_ACCURACY_CREDIT_METERS = 100;

export function haversineMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// The server decides the verdict from the coordinates; the client's own opinion is never trusted.
export function evaluateArrival(
  body: unknown,
  fix: { latitude?: number | undefined; longitude?: number | undefined; accuracyMeters?: number | undefined },
  now: Date = new Date(),
): ArrivalRecord | null {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const target = input['arrivalTarget'];
  if (!target || typeof target !== 'object') return null;
  const targetInput = target as Record<string, unknown>;

  const targetLatitude = numberField(targetInput['latitude'], 'Target latitude', -90, 90);
  const targetLongitude = numberField(targetInput['longitude'], 'Target longitude', -180, 180);
  if (targetLatitude === null || targetLongitude === null) {
    throw createError('Arrival target needs a latitude and longitude', 400, 'INVALID_INPUT');
  }
  const requestedRadius = numberField(targetInput['radiusMeters'], 'Arrival radius', 1, 100000) ?? DEFAULT_RADIUS_METERS;
  const radiusMeters = Math.min(MAX_RADIUS_METERS, Math.max(MIN_RADIUS_METERS, requestedRadius));
  const accuracyMeters = fix.accuracyMeters ?? null;

  let verdict: ArrivalVerdict = 'unreliable';
  let distanceMeters: number | null = null;
  if (typeof fix.latitude === 'number' && typeof fix.longitude === 'number') {
    distanceMeters = haversineMeters({ latitude: fix.latitude, longitude: fix.longitude }, { latitude: targetLatitude, longitude: targetLongitude });
    if (accuracyMeters === null || accuracyMeters <= UNRELIABLE_ACCURACY_METERS) {
      const credit = Math.min(accuracyMeters ?? 0, MAX_ACCURACY_CREDIT_METERS);
      verdict = distanceMeters - credit <= radiusMeters ? 'verified' : 'outside';
    }
  }

  const code = input['overrideCode'];
  if (code !== undefined && code !== null && code !== '' && !(ARRIVAL_OVERRIDE_CODES as readonly string[]).includes(String(code))) {
    throw createError('Override reason is not recognised', 400, 'INVALID_INPUT');
  }
  const note = typeof input['overrideNote'] === 'string' ? input['overrideNote'].trim().slice(0, 300) : '';

  return {
    verdict,
    distanceMeters: distanceMeters === null ? null : Math.round(distanceMeters),
    accuracyMeters: accuracyMeters === null ? null : Math.round(accuracyMeters),
    radiusMeters,
    targetLatitude,
    targetLongitude,
    ...(code ? { overrideCode: String(code) as ArrivalOverrideCode } : {}),
    ...(note ? { overrideNote: note } : {}),
    checkedAt: now.toISOString(),
  };
}

export function arrivalBlockMessage(record: ArrivalRecord): string | null {
  if (record.verdict !== 'outside' || record.overrideCode) return null;
  const miles = (record.distanceMeters ?? 0) / 1609.344;
  const distance = miles < 0.19 ? `${Math.round((record.distanceMeters ?? 0) * 3.28084)} ft` : `${miles.toFixed(1)} mi`;
  return `You are ${distance} from this stop. Move closer, or choose a reason to confirm the arrival anyway.`;
}

const ADDABLE_TYPES = new Set<string>(['pickup', 'delivery', 'stop']);

export const DEVIATION_REASONS = ['unspecified', 'road_blocked', 'personal_stop', 'traffic', 'customer_request', 'other'] as const;
export const DEVIATION_RESOLUTIONS = ['returned', 'rerouted', 'break_ended', 'still_off'] as const;
export type DeviationReason = typeof DEVIATION_REASONS[number];
export type DeviationResolution = typeof DEVIATION_RESOLUTIONS[number];

export interface DeviationRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  reason: DeviationReason;
  resolution?: DeviationResolution;
  maxDistanceMeters?: number;
  addedMinutes?: number;
  latitude?: number;
  longitude?: number;
}

const MAX_DEVIATIONS = 100;

// Creates or updates one deviation by its client-chosen id, so a retried or queued request never duplicates it.
export function upsertDeviation(existing: DeviationRecord[], id: string, body: unknown, now: Date = new Date()): DeviationRecord[] {
  if (!/^[\w-]{1,64}$/.test(id)) throw createError('Deviation id is invalid', 400, 'INVALID_INPUT');
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const previous = existing.find(item => item.id === id);

  const date = (value: unknown, field: string): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) throw createError(`${field} must be a valid date`, 400, 'INVALID_INPUT');
    if (parsed.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS) throw createError(`${field} is in the future`, 400, 'INVALID_INPUT');
    return parsed.toISOString();
  };
  const choice = <T extends string>(value: unknown, allowed: readonly T[], field: string): T | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw createError(`${field} is not recognised`, 400, 'INVALID_INPUT');
    return value as T;
  };

  const startedAt = date(input['startedAt'], 'Start time') ?? previous?.startedAt;
  if (!startedAt) throw createError('Start time is required', 400, 'INVALID_INPUT');
  const endedAt = date(input['endedAt'], 'End time') ?? previous?.endedAt;
  const reason = choice(input['reason'], DEVIATION_REASONS, 'Reason') ?? previous?.reason ?? 'unspecified';
  const resolution = choice(input['resolution'], DEVIATION_RESOLUTIONS, 'Resolution') ?? previous?.resolution;
  const maxDistance = numberField(input['maxDistanceMeters'], 'Distance', 0, 1_000_000);
  const added = numberField(input['addedMinutes'], 'Added minutes', -1440, 1440);
  const latitude = numberField(input['latitude'], 'Latitude', -90, 90);
  const longitude = numberField(input['longitude'], 'Longitude', -180, 180);

  const record: DeviationRecord = {
    id,
    startedAt,
    reason,
    ...(endedAt ? { endedAt } : {}),
    ...(resolution ? { resolution } : {}),
    // The farthest point reached only ever grows, even if updates arrive out of order.
    ...(maxDistance !== null || previous?.maxDistanceMeters !== undefined ? { maxDistanceMeters: Math.round(Math.max(maxDistance ?? 0, previous?.maxDistanceMeters ?? 0)) } : {}),
    ...(added !== null ? { addedMinutes: Math.round(added) } : previous?.addedMinutes !== undefined ? { addedMinutes: previous.addedMinutes } : {}),
    ...(latitude !== null && longitude !== null ? { latitude, longitude } : previous?.latitude !== undefined && previous.longitude !== undefined ? { latitude: previous.latitude, longitude: previous.longitude } : {}),
  };
  return [...existing.filter(item => item.id !== id), record].slice(-MAX_DEVIATIONS);
}

export function summarizeDeviations(deviations: DeviationRecord[]): { count: number; totalMinutes: number; byReason: Record<string, number> } {
  const byReason: Record<string, number> = {};
  let totalMs = 0;
  for (const item of deviations) {
    byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
    if (item.endedAt) totalMs += Math.max(0, new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime());
  }
  return { count: deviations.length, totalMinutes: Math.round(totalMs / 60_000), byReason };
}

// Turns stops added mid-run into pending progress entries and definitions, keeping each pickup tied to its delivery.
export function buildAddedStops(input: {
  added: RouteStop[];
  progress: ProgressStop[];
  planned: PlannedStop[];
  now?: Date;
}): { progress: ProgressStop[]; planned: PlannedStop[] } {
  const { added, progress, planned } = input;
  if (added.length === 0) throw createError('Add at least one stop', 400, 'INVALID_STOPS');

  const takenIds = new Set([...progress.map(stop => stop.stopId), ...planned.map(stop => stop.id)]);
  const takenShipments = new Set(planned.flatMap(stop => (stop.shipmentId ? [stop.shipmentId] : [])));

  const stops = added.map(stop => ({ ...stop }));
  for (const stop of stops) {
    if (!ADDABLE_TYPES.has(stop.type)) throw createError('Added stops must be a pickup, a delivery, or a plain stop', 400, 'INVALID_STOPS');
    if (takenIds.has(stop.id)) throw createError('One of the added stops already exists on this route', 409, 'DUPLICATE_STOP');
    takenIds.add(stop.id);
    if (stop.shipmentId && takenShipments.has(stop.shipmentId)) {
      throw createError(`Reference ${stop.shipmentId} is already used on this route`, 409, 'DUPLICATE_REFERENCE');
    }
  }

  // A lone pickup + delivery pair without a reference is matched automatically.
  const unreferenced = stops.filter(stop => (stop.type === 'pickup' || stop.type === 'delivery') && !stop.shipmentId);
  const pickups = unreferenced.filter(stop => stop.type === 'pickup');
  const deliveries = unreferenced.filter(stop => stop.type === 'delivery');
  if (pickups.length === 1 && deliveries.length === 1) {
    const generated = `added-${(input.now ?? new Date()).getTime().toString(36)}`;
    pickups[0]!.shipmentId = generated;
    deliveries[0]!.shipmentId = generated;
  } else if (pickups.length > 0) {
    throw createError('Give each pickup a reference so its delivery can be matched', 400, 'INVALID_STOPS');
  }

  // Every pickup needs a delivery; a delivery alone is fine (the load is already on board).
  const delivered = new Set(stops.filter(stop => stop.type === 'delivery' && stop.shipmentId).map(stop => stop.shipmentId));
  for (const stop of stops) {
    if (stop.type === 'pickup' && stop.shipmentId && !delivered.has(stop.shipmentId)) {
      throw createError(`Pickup ${stop.shipmentId} has no delivery`, 400, 'INVALID_STOPS');
    }
  }

  return {
    progress: stops.map(stop => ({
      stopId: stop.id,
      address: stop.address,
      ...(stop.vehicleInfo ? { name: stop.vehicleInfo } : {}),
      plannedServiceMinutes: stop.estimatedDuration ?? 10,
      status: 'pending' as const,
    })),
    planned: stops.map(stop => ({
      id: stop.id,
      type: stop.type,
      ...(stop.shipmentId ? { shipmentId: stop.shipmentId } : {}),
      ...(stop.latitude !== undefined ? { latitude: stop.latitude } : {}),
      ...(stop.longitude !== undefined ? { longitude: stop.longitude } : {}),
      ...(stop.timeWindow ? { timeWindow: stop.timeWindow } : {}),
      ...(stop.priority ? { priority: stop.priority } : {}),
      ...(stop.vehicleInfo ? { vehicleInfo: stop.vehicleInfo } : {}),
    })),
  };
}
