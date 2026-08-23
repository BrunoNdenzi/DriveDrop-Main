import assert from 'node:assert/strict';
import { supabaseAdmin } from '../src/lib/supabase';
import { googleMapsService } from '../src/services/google-maps.service';
import { pricingLiveEvidenceService } from '../src/services/pricingLiveEvidence.service';
import { executeV3Tool } from '../src/benji-v3/tools';
import { getToolsForRole } from '../src/benji-v3/benji.service';

const driverId = 'driver-route-test';
const shipments = [
  {
    id: 'shipment-a',
    status: 'accepted',
    title: '2022 Toyota Camry',
    vehicle_year: 2022,
    vehicle_make: 'Toyota',
    vehicle_model: 'Camry',
    pickup_address: 'Pickup A',
    delivery_address: 'Delivery A',
    driver_offer_amount: 97.35,
  },
  {
    id: 'shipment-b',
    status: 'assigned',
    title: '2021 Honda Accord',
    vehicle_year: 2021,
    vehicle_make: 'Honda',
    vehicle_model: 'Accord',
    pickup_address: 'Pickup B',
    delivery_address: 'Delivery B',
    driver_offer_amount: 120,
  },
];

const coordinates: Record<string, Record<string, number>> = {
  'shipment-a': { pickup_lat: 35.1, pickup_lng: -80.1, delivery_lat: 35.3, delivery_lng: -80.3 },
  'shipment-b': { pickup_lat: 35.2, pickup_lng: -80.2, delivery_lat: 35.4, delivery_lng: -80.4 },
};

const points = [
  { lat: 35.0, lng: -80.0 },
  { lat: 35.1, lng: -80.1 },
  { lat: 35.2, lng: -80.2 },
  { lat: 35.3, lng: -80.3 },
  { lat: 35.4, lng: -80.4 },
];
const distances = [
  [0, 100, 200, 1, 2],
  [100, 0, 1, 10, 20],
  [200, 1, 0, 1, 10],
  [1, 10, 1, 0, 5],
  [2, 20, 10, 5, 0],
];

function pointIndex(point: { lat: number; lng: number }): number {
  const index = points.findIndex(candidate =>
    candidate.lat.toFixed(4) === point.lat.toFixed(4) &&
    candidate.lng.toFixed(4) === point.lng.toFixed(4)
  );
  assert.notEqual(index, -1, `Unknown point ${point.lat},${point.lng}`);
  return index;
}

let queriedDriver = '';
let queriedStatuses: string[] = [];
let queriedShipmentIds: string[] = [];

const query = {
  select: () => query,
  eq: (column: string, value: string) => {
    if (column === 'driver_id') queriedDriver = value;
    return query;
  },
  in: (column: string, values: string[]) => {
    if (column === 'status') queriedStatuses = values;
    if (column === 'id') queriedShipmentIds = values;
    return query;
  },
  order: async () => ({
    data: queriedShipmentIds.length > 0
      ? shipments.filter(shipment => queriedShipmentIds.includes(shipment.id))
      : shipments,
    error: null,
  }),
};

(supabaseAdmin as unknown as { from: (table: string) => typeof query }).from = table => {
  assert.equal(table, 'shipments');
  return query;
};
(supabaseAdmin as unknown as {
  rpc: (name: string, args: { shipment_id: string }) => Promise<{ data: unknown[]; error: null }>;
}).rpc = async (name, args) => {
  assert.equal(name, 'get_shipment_coordinates');
  return { data: [coordinates[args.shipment_id]], error: null };
};

googleMapsService.geocodeAddress = async address => {
  assert.equal(address, 'Charlotte, NC');
  return { address, latitude: 35.0, longitude: -80.0 };
};
googleMapsService.getDistanceMatrix = async (origins, destinations) => origins.flatMap(origin => {
  assert.equal(typeof origin, 'object');
  const from = pointIndex(origin as { lat: number; lng: number });
  return destinations.map(destination => {
    assert.equal(typeof destination, 'object');
    const to = pointIndex(destination as { lat: number; lng: number });
    const value = distances[from]![to]!;
    return {
      originAddress: String(from),
      destinationAddress: String(to),
      distance: { text: `${value} m`, value },
      duration: { text: `${value} sec`, value },
      status: 'OK',
    };
  });
});
googleMapsService.getDirections = async (origin, destination) => {
  assert.equal(typeof origin, 'object');
  assert.equal(typeof destination, 'object');
  const from = pointIndex(origin as { lat: number; lng: number });
  const to = pointIndex(destination as { lat: number; lng: number });
  const value = distances[from]![to]!;
  return {
    distance: { text: `${value} m`, value },
    duration: { text: `${value} sec`, value },
    startAddress: String(from),
    endAddress: String(to),
    polyline: '',
  };
};

pricingLiveEvidenceService.collect = async () => ({
  traffic: {
    provider: 'google_maps',
    status: 'available',
    observedAt: '2026-08-23T12:00:00.000Z',
    freshUntil: '2026-08-23T12:15:00.000Z',
    latencyMs: 10,
    evidence: {
      normalDurationSeconds: 600,
      trafficDurationSeconds: 720,
      delaySeconds: 120,
      delayPercent: 20,
    },
  },
  tolls: {
    provider: 'here',
    status: 'available',
    observedAt: '2026-08-23T12:00:00.000Z',
    freshUntil: '2026-08-23T13:00:00.000Z',
    latencyMs: 10,
    evidence: { currency: 'USD', estimatedAmount: 0, tollCount: 0 },
  },
  weather: {
    provider: 'openweather',
    status: 'available',
    observedAt: '2026-08-23T12:00:00.000Z',
    freshUntil: '2026-08-23T12:30:00.000Z',
    latencyMs: 10,
    evidence: {
      condition: 'Clear',
      temperatureFahrenheit: 82,
      windSpeedMph: 6,
      precipitationOneHourInches: 0,
    },
  },
  fuel: {
    provider: 'opis',
    status: 'unavailable',
    observedAt: '2026-08-23T12:00:00.000Z',
    freshUntil: '2026-08-23T13:00:00.000Z',
    latencyMs: 0,
    errorCode: 'PROVIDER_NOT_ENABLED',
  },
});

function toolNames(role: 'client' | 'driver'): string[] {
  return getToolsForRole(role).flatMap(tool => {
    const definition = tool as { function?: { name: string } };
    return definition.function ? [definition.function.name] : [];
  });
}

function assertSafeSequence(stops: Array<{ type: string; shipmentId?: string | undefined }>): void {
  const pickedUp = new Set<string>();
  const onboard = new Set<string>();

  for (const stop of stops) {
    if (!stop.shipmentId) continue;
    if (stop.type === 'pickup') {
      pickedUp.add(stop.shipmentId);
      onboard.add(stop.shipmentId);
      assert.ok(onboard.size <= 1, 'One-slot trailer capacity exceeded');
    } else if (stop.type === 'delivery') {
      assert.ok(pickedUp.has(stop.shipmentId), `Delivered ${stop.shipmentId} before pickup`);
      onboard.delete(stop.shipmentId);
    }
  }
}

async function main(): Promise<void> {
  assert.ok(toolNames('driver').includes('plan_route'));
  assert.ok(!toolNames('client').includes('plan_route'));

  const blocked = await executeV3Tool('plan_route', '{}', 'client-test', 'client');
  assert.equal(blocked.success, false);

  const result = await executeV3Tool(
    'plan_route',
    JSON.stringify({ current_location: 'Charlotte, NC', vehicle_slots: 1 }),
    driverId,
    'driver'
  );

  assert.equal(result.success, true, result.errorMessage);
  assert.equal(queriedDriver, driverId);
  assert.deepEqual(queriedStatuses, ['accepted', 'assigned']);
  assert.match(result.summary, /optimized route covers 2 shipments/i);
  assert.match(result.summary, /Total: .* miles .* hours/i);
  assert.match(result.summary, /\$217\.35 accepted payout/i);
  assert.match(result.summary, /next-leg traffic delay: 2 minutes/i);
  assert.match(result.summary, /next-leg midpoint weather: clear/i);
  assert.doesNotMatch(result.summary, /assigned revenue/i);
  assert.ok(!result.summary.includes('**'), 'SMS summary should not contain markdown bold');

  const data = result.data as {
    route: { stops: Array<{ type: string; shipmentId?: string | undefined }> };
    repositioningMilesReduced: number;
  };
  assertSafeSequence(data.route.stops);
  assert.equal(typeof data.repositioningMilesReduced, 'number');

  const selectedResult = await executeV3Tool(
    'plan_route',
    JSON.stringify({ current_location: 'Charlotte, NC', vehicle_slots: 1, shipment_ids: ['shipment-a'] }),
    driverId,
    'driver'
  );
  assert.equal(selectedResult.success, true, selectedResult.errorMessage);
  assert.deepEqual(queriedShipmentIds, ['shipment-a']);
  assert.match(selectedResult.summary, /optimized route covers 1 shipment\./i);
  assert.match(selectedResult.summary, /\$97\.35 accepted payout/i);

  console.log('Benji plan_route role, query, real optimizer, summary, precedence, and capacity checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});