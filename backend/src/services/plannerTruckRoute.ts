import config from '@config';
import { logger } from '@utils/logger';
import { commercialRoutingService, type CommercialVehicleProfile } from './commercial-routing.service';

export interface LivePoint {
  lat: number;
  lng: number;
}

export interface LiveRouteStep {
  instruction: string;
  // Google-style maneuver name ("turn-left", "ramp-right"...) so the app's arrows work unchanged.
  maneuver?: string;
  distanceMeters: number;
  durationSeconds: number;
  path: LivePoint[];
}

export interface LiveRouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  steps: LiveRouteStep[];
}

export interface LiveRoute {
  legs: LiveRouteLeg[];
  bounds: { north: number; south: number; east: number; west: number };
}

export interface LiveRouteRequest {
  from: LivePoint;
  stops: LivePoint[];
  profile: CommercialVehicleProfile;
  avoidHighways: boolean;
  avoid: LivePoint[];
  heading?: number | undefined;
  departureTime?: Date | undefined;
}

export class LiveRouteUnavailableError extends Error {}

const MAX_STOPS = 60;
const MAX_AVOID = 10;
// HERE accepts up to 20 via points per request, so longer trips are asked for in consecutive chunks.
const MAX_VIA = 20;
const AVOID_RADIUS_METERS = 80;
const METERS_PER_DEGREE = 111_195;
const REQUEST_TIMEOUT_MS = 10_000;
const FLEX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function point(value: unknown, field: string): LivePoint {
  const record = asRecord(value);
  const lat = record?.['lat'];
  const lng = record?.['lng'];
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`${field} needs a valid latitude`);
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`${field} needs a valid longitude`);
  return { lat, lng };
}

export function parseLiveRouteRequest(body: unknown, now: Date = new Date()): LiveRouteRequest {
  const input = asRecord(body);
  if (!input) throw new Error('Request body is required');
  const from = point(input['from'], 'Start position');
  const rawStops = input['stops'];
  if (!Array.isArray(rawStops) || rawStops.length < 1 || rawStops.length > MAX_STOPS) {
    throw new Error(`Send between 1 and ${MAX_STOPS} stops`);
  }
  const stops = rawStops.map((stop, index) => point(stop, `Stop ${index + 1}`));

  const rawProfile = asRecord(input['profile']);
  if (!rawProfile) throw new Error('A vehicle profile is required');
  const number = (value: unknown) => typeof value === 'number' ? value : undefined;
  const profile = commercialRoutingService.validateProfile({
    heightFeet: number(rawProfile['heightFeet']),
    widthFeet: number(rawProfile['widthFeet']),
    lengthFeet: number(rawProfile['lengthFeet']),
    grossWeightPounds: number(rawProfile['grossWeightPounds']),
    axleCount: number(rawProfile['axleCount']),
    hazmatTypes: Array.isArray(rawProfile['hazmatTypes'])
      ? rawProfile['hazmatTypes'].filter((type): type is string => typeof type === 'string')
      : [],
  });

  const rawAvoid = input['avoid'];
  const avoid = Array.isArray(rawAvoid) ? rawAvoid.slice(0, MAX_AVOID).map((item, index) => point(item, `Closure ${index + 1}`)) : [];
  const heading = typeof input['heading'] === 'number' && Number.isFinite(input['heading']) ? ((Math.round(input['heading']) % 360) + 360) % 360 : undefined;
  const requested = typeof input['departureTime'] === 'string' ? new Date(input['departureTime']) : null;
  const departureTime = requested && !Number.isNaN(requested.getTime()) && requested.getTime() > now.getTime() ? requested : now;

  return { from, stops, profile, avoidHighways: input['avoidHighways'] === true, avoid, heading, departureTime };
}

// HERE "flexible polyline": base-64 variable-length integers holding coordinate deltas.
export function decodeFlexPolyline(encoded: string): LivePoint[] {
  let index = 0;
  const readUnsigned = (): number => {
    let result = 0;
    let shift = 0;
    for (;;) {
      if (index >= encoded.length) throw new Error('Truncated polyline');
      const digit = FLEX_ALPHABET.indexOf(encoded.charAt(index++));
      if (digit < 0) throw new Error('Invalid polyline character');
      result += (digit & 0x1f) * 2 ** shift;
      if ((digit & 0x20) === 0) return result;
      shift += 5;
    }
  };
  const readSigned = (): number => {
    const value = readUnsigned();
    return value % 2 === 1 ? -(value + 1) / 2 : value / 2;
  };

  if (readUnsigned() !== 1) throw new Error('Unsupported polyline version');
  const header = readUnsigned();
  const factor = 10 ** (header & 15);
  const hasThirdDimension = ((header >> 4) & 7) !== 0;

  const points: LivePoint[] = [];
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    lat += readSigned();
    lng += readSigned();
    if (hasThirdDimension) readSigned();
    points.push({ lat: lat / factor, lng: lng / factor });
  }
  return points;
}

// A small box around each reported closure; the router may not cross it.
export function avoidAreas(closures: LivePoint[]): string {
  return closures.map(({ lat, lng }) => {
    const dLat = AVOID_RADIUS_METERS / METERS_PER_DEGREE;
    const dLng = AVOID_RADIUS_METERS / (METERS_PER_DEGREE * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    const round = (value: number) => value.toFixed(6);
    return `bbox:${round(lng - dLng)},${round(lat - dLat)},${round(lng + dLng)},${round(lat + dLat)}`;
  }).join('|');
}

export function maneuverFor(action: string, direction?: string, severity?: string): string | undefined {
  const side = direction === 'left' || direction === 'right' ? direction : undefined;
  const name = action.toLowerCase();
  if (name.startsWith('roundabout')) return `roundabout-${side ?? 'right'}`;
  if (name === 'uturn') return `uturn-${side ?? 'left'}`;
  if (name === 'turn') {
    if (!side) return undefined;
    return severity === 'light' ? `turn-slight-${side}` : severity === 'heavy' ? `turn-sharp-${side}` : `turn-${side}`;
  }
  if (name === 'keep') return side ? `fork-${side}` : undefined;
  if (name === 'enterhighway') return 'merge';
  if (name === 'ramp' || name === 'exit' || name === 'leavehighway') return side ? `ramp-${side}` : undefined;
  if (name === 'ferry') return 'ferry';
  return undefined;
}

// The distance clause ("Go for 500 ft.") is spoken and shown separately by the app.
export function cleanInstruction(text: string): string {
  return text.replace(/\s*Go for [\d.,]+\s*(?:mi|ft|yd|m|km)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildLeg(section: Record<string, unknown>): LiveRouteLeg {
  const summary = asRecord(section['summary']);
  const distanceMeters = numberOr(summary?.['length'], 0);
  const durationSeconds = numberOr(summary?.['duration'], 0);
  if (typeof section['polyline'] !== 'string') throw new Error('Route section has no geometry');
  const points = decodeFlexPolyline(section['polyline']);
  if (points.length < 2) throw new Error('Route section is too short');

  const actions = (Array.isArray(section['actions']) ? section['actions'] : [])
    .map(asRecord)
    .filter((action): action is Record<string, unknown> => Boolean(action) && typeof action?.['offset'] === 'number')
    .sort((a, b) => (a['offset'] as number) - (b['offset'] as number));

  const steps: LiveRouteStep[] = [];
  actions.forEach((action, i) => {
    const start = Math.min(points.length - 1, Math.max(0, action['offset'] as number));
    const next = actions[i + 1];
    const end = next ? Math.min(points.length - 1, next['offset'] as number) : points.length - 1;
    // The closing "arrive" action sits on the last point; the app already says "Arrive" after the final step.
    if (end <= start) return;
    const instruction = typeof action['instruction'] === 'string' ? cleanInstruction(action['instruction']) : '';
    const maneuver = maneuverFor(
      typeof action['action'] === 'string' ? action['action'] : '',
      typeof action['direction'] === 'string' ? action['direction'] : undefined,
      typeof action['severity'] === 'string' ? action['severity'] : undefined,
    );
    steps.push({
      instruction: instruction || 'Continue',
      ...(maneuver ? { maneuver } : {}),
      distanceMeters: numberOr(action['length'], 0),
      durationSeconds: numberOr(action['duration'], 0),
      path: points.slice(start, end + 1),
    });
  });

  if (steps.length === 0) {
    steps.push({ instruction: 'Continue to your stop', distanceMeters, durationSeconds, path: points });
  }
  return { distanceMeters, durationSeconds, steps };
}

export function parseHereLiveRoute(body: unknown, expectedLegs: number): LiveRouteLeg[] | null {
  const routes = asRecord(body)?.['routes'];
  const route = Array.isArray(routes) ? asRecord(routes[0]) : undefined;
  const sections = Array.isArray(route?.['sections']) ? route['sections'] : [];
  if (sections.length === 0) return null;
  if (sections.length !== expectedLegs) throw new Error(`Expected ${expectedLegs} route sections but received ${sections.length}`);
  return sections.map(section => {
    const record = asRecord(section);
    if (!record) throw new Error('Malformed route section');
    return buildLeg(record);
  });
}

export function liveRouteBounds(legs: LiveRouteLeg[]): LiveRoute['bounds'] {
  const bounds = { north: -90, south: 90, east: -180, west: 180 };
  for (const leg of legs) {
    for (const step of leg.steps) {
      for (const { lat, lng } of step.path) {
        bounds.north = Math.max(bounds.north, lat);
        bounds.south = Math.min(bounds.south, lat);
        bounds.east = Math.max(bounds.east, lng);
        bounds.west = Math.min(bounds.west, lng);
      }
    }
  }
  return bounds;
}

export function buildHereUrl(input: {
  origin: LivePoint;
  stops: LivePoint[];
  request: LiveRouteRequest;
  heading?: number | undefined;
  departure: Date;
  apiKey: string;
  baseUrl: string;
}): URL {
  const { origin, stops, request } = input;
  const url = new URL(`${input.baseUrl}/routes`);
  const text = (value: LivePoint) => `${value.lat},${value.lng}`;
  const destination = stops[stops.length - 1]!;
  url.searchParams.set('transportMode', 'truck');
  url.searchParams.set('routingMode', 'fast');
  url.searchParams.set('origin', `${text(origin)}${input.heading !== undefined ? `;course=${input.heading}` : ''}`);
  url.searchParams.set('destination', text(destination));
  for (const via of stops.slice(0, -1)) url.searchParams.append('via', text(via));
  url.searchParams.set('return', 'summary,polyline,actions,instructions');
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('departureTime', input.departure.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  commercialRoutingService.applyVehicleProfile(url, request.profile);
  if (request.avoidHighways) url.searchParams.set('avoid[features]', 'controlledAccessHighway');
  if (request.avoid.length > 0) url.searchParams.set('avoid[areas]', avoidAreas(request.avoid));
  url.searchParams.set('apikey', input.apiKey);
  return url;
}

async function requestChunk(url: URL, legs: number): Promise<LiveRouteLeg[] | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const title = asRecord(body)?.['title'];
    logger.warn('Truck live route was not returned', { status: response.status, title });
    // A 4xx about the request itself means no legal road exists for this vehicle; anything else is an outage.
    if (response.status === 400 || response.status === 404) return null;
    throw new Error(`Routing provider responded ${response.status}`);
  }
  return parseHereLiveRoute(body, legs);
}

// Null means the provider found no road this vehicle may use.
export async function requestLiveRoute(request: LiveRouteRequest, now: Date = new Date()): Promise<LiveRoute | null> {
  if (!config.here.apiKey) throw new LiveRouteUnavailableError('Truck routing is not set up on this server');

  const chunks: Array<{ origin: LivePoint; stops: LivePoint[] }> = [];
  for (let start = 0; start < request.stops.length; start += MAX_VIA + 1) {
    chunks.push({
      origin: start === 0 ? request.from : request.stops[start - 1]!,
      stops: request.stops.slice(start, start + MAX_VIA + 1),
    });
  }

  const results = await Promise.all(chunks.map((chunk, index) => requestChunk(
    buildHereUrl({
      origin: chunk.origin,
      stops: chunk.stops,
      request,
      heading: index === 0 ? request.heading : undefined,
      departure: request.departureTime ?? now,
      apiKey: config.here.apiKey,
      baseUrl: config.here.routingBaseUrl,
    }),
    chunk.stops.length,
  )));
  if (results.some(result => result === null)) return null;
  const legs = results.flatMap(result => result!);
  return { legs, bounds: liveRouteBounds(legs) };
}
