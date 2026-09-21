import assert from 'node:assert/strict';
import config from '../src/config';
import { googleMapsService } from '../src/services/google-maps.service';
import { pricingLiveEvidenceService } from '../src/services/pricingLiveEvidence.service';
import { routeOptimizationService, RouteStop } from '../src/services/RouteOptimizationService';

const stops: RouteStop[] = [
  { id: 'start', address: 'Start', type: 'current_location', latitude: 35.0000, longitude: -80.0000 },
  { id: 'pickup-a', address: 'Pickup A', type: 'pickup', shipmentId: 'a', latitude: 35.1000, longitude: -80.1000 },
  { id: 'pickup-b', address: 'Pickup B', type: 'pickup', shipmentId: 'b', latitude: 35.2000, longitude: -80.2000 },
  { id: 'delivery-a', address: 'Delivery A', type: 'delivery', shipmentId: 'a', latitude: 35.3000, longitude: -80.3000 },
  { id: 'delivery-b', address: 'Delivery B', type: 'delivery', shipmentId: 'b', latitude: 35.4000, longitude: -80.4000 },
];

const distances = [
  [0, 100, 200, 1, 2],
  [100, 0, 1, 10, 20],
  [200, 1, 0, 1, 10],
  [1, 10, 1, 0, 5],
  [2, 20, 10, 5, 0],
];

const locationIndex = new Map(
  stops.map((stop, index) => [`${stop.latitude!.toFixed(4)},${stop.longitude!.toFixed(4)}`, index])
);

let matrixCalls = 0;
let geocodeCalls = 0;
let directionsCalls = 0;
let activeDirections = 0;
let maxActiveDirections = 0;
let avoidHighwaysObserved = false;

function locationKey(location: string | { lat: number; lng: number }): string {
  assert.notEqual(typeof location, 'string');
  const coordinates = location as { lat: number; lng: number };
  return `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}`;
}

googleMapsService.geocodeAddress = async () => {
  geocodeCalls++;
  throw new Error('Stored coordinates should avoid geocoding');
};

googleMapsService.getDistanceMatrix = async (origins, destinations, _mode, options) => {
  matrixCalls++;
  avoidHighwaysObserved ||= options?.avoidHighways === true;
  return origins.flatMap(origin => destinations.map(destination => {
    const originIndex = locationIndex.get(locationKey(origin))!;
    const destinationIndex = locationIndex.get(locationKey(destination))!;
    const value = distances[originIndex]![destinationIndex]!;
    return {
      originAddress: stops[originIndex]!.address,
      destinationAddress: stops[destinationIndex]!.address,
      distance: { text: `${value} m`, value },
      duration: { text: `${value} sec`, value },
      status: 'OK',
    };
  }));
};

googleMapsService.getDirections = async (origin, destination, _mode, options) => {
  directionsCalls++;
  avoidHighwaysObserved ||= options?.avoidHighways === true;
  activeDirections++;
  maxActiveDirections = Math.max(maxActiveDirections, activeDirections);
  await new Promise(resolve => setTimeout(resolve, 10));
  activeDirections--;

  const originIndex = locationIndex.get(locationKey(origin))!;
  const destinationIndex = locationIndex.get(locationKey(destination))!;
  const value = distances[originIndex]![destinationIndex]!;
  return {
    distance: { text: `${value} m`, value },
    duration: { text: `${value} sec`, value },
    startAddress: stops[originIndex]!.address,
    endAddress: stops[destinationIndex]!.address,
    polyline: '',
  };
};

function assertLegalOrder(
  routeStops: Array<{ type: string; shipmentId?: string | undefined }>,
  capacity: number
): void {
  const onboard = new Set<string>();
  const pickedUp = new Set<string>();

  for (const stop of routeStops) {
    if (!stop.shipmentId) continue;
    if (stop.type === 'pickup') {
      pickedUp.add(stop.shipmentId);
      onboard.add(stop.shipmentId);
      assert.ok(onboard.size <= capacity, `Capacity exceeded at pickup ${stop.shipmentId}`);
    } else if (stop.type === 'delivery') {
      assert.ok(pickedUp.has(stop.shipmentId), `Delivered ${stop.shipmentId} before pickup`);
      onboard.delete(stop.shipmentId);
    }
  }
}

async function main(): Promise<void> {
  const first = await routeOptimizationService.optimizeRoute(stops, { vehicleSlots: 1 });
  assertLegalOrder(first.stops, 1);
  assert.equal(first.stops[1]?.id, 'pickup-a', 'Nearest illegal delivery must be rejected');
  assert.equal(first.stops[2]?.id, 'delivery-a', 'Second pickup must be rejected while trailer is full');
  assert.equal(geocodeCalls, 0);
  assert.equal(matrixCalls, 1);
  assert.ok(maxActiveDirections > 1, 'Directions calls should run concurrently');
  assert.equal(first.savings.percentImprovement, 0, 'A legal baseline must never produce negative savings');

  const firstDirectionsCalls = directionsCalls;
  const second = await routeOptimizationService.optimizeRoute(stops, { vehicleSlots: 1 });
  assertLegalOrder(second.stops, 1);
  assert.equal(matrixCalls, 1, 'Second optimization should use the distance cache');
  assert.equal(directionsCalls, firstDirectionsCalls, 'Second optimization should use the directions cache');

  const roundTrip = await routeOptimizationService.optimizeRoute(stops, {
    vehicleSlots: 1,
    returnToOrigin: true,
    avoidHighways: true,
  });
  assert.equal(roundTrip.stops.at(-1)?.id, 'start', 'returnToOrigin must close the route');
  assert.ok(avoidHighwaysObserved, 'avoidHighways must reach the routing provider');

  await assert.rejects(
    routeOptimizationService.optimizeRoute(stops, { vehicleSlots: 1, maxHours: 0.001 }),
    /maxHours/
  );
  await assert.rejects(
    routeOptimizationService.optimizeRoute(stops, { vehicleSlots: 1, maxDetourMinutes: 0 }),
    /maxDetourMinutes/
  );
  await assert.rejects(
    routeOptimizationService.optimizeRoute(stops, { avoidHighways: true, preferHighway: true }),
    /cannot both be enabled/
  );

  const impossibleWindowStops = stops.map(stop => ({ ...stop }));
  impossibleWindowStops[1] = {
    ...impossibleWindowStops[1]!,
    timeWindow: {
      earliest: '2030-01-01T08:00:00.000Z',
      latest: '2030-01-01T08:00:00.001Z',
    },
  };
  await assert.rejects(
    routeOptimizationService.optimizeRoute(impossibleWindowStops, {
      vehicleSlots: 1,
      departureTime: '2030-01-01T08:00:00.000Z',
    }),
    /time window/
  );

  config.here.apiKey = 'test-here-key';
  const originalFetch = globalThis.fetch;
  const hereUrls: URL[] = [];
  let trafficRouteCalls = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname === 'router.hereapi.com') {
      hereUrls.push(url);
      return new Response(JSON.stringify({
        routes: [{ sections: [{ summary: { length: 1609, duration: 120 }, polyline: 'test' }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.hostname === 'routes.googleapis.com') {
      trafficRouteCalls++;
      return new Response(JSON.stringify({
        routes: [{ staticDuration: '100s', duration: '130s', distanceMeters: 1000 }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };

  const commercialRoute = await routeOptimizationService.optimizeRoute(stops.slice(0, 2), {
    vehicleSlots: 1,
    commercialVehicle: {
      heightFeet: 13.5,
      widthFeet: 8.5,
      lengthFeet: 75,
      grossWeightPounds: 80_000,
      axleCount: 5,
      hazmatTypes: ['flammable'],
    },
  });
  assert.equal(commercialRoute.commercialCompliance.status, 'verified');
  assert.equal(hereUrls.length, 1, 'Every commercial leg must be verified by HERE truck routing');
  assert.equal(hereUrls[0]?.searchParams.get('transportMode'), 'truck');
  assert.equal(hereUrls[0]?.searchParams.get('vehicle[height]'), '411');
  assert.equal(hereUrls[0]?.searchParams.get('vehicle[grossWeight]'), '36287');
  assert.equal(hereUrls[0]?.searchParams.get('vehicle[shippedHazardousGoods]'), 'flammable');

  let geocodeIndex = 0;
  googleMapsService.geocodeAddress = async address => ({
    address,
    latitude: 35 + geocodeIndex * 0.1,
    longitude: -80 - geocodeIndex++ * 0.1,
  });
  const evidence = await pricingLiveEvidenceService.collectRoute(['Origin', 'Middle', 'Destination']);
  assert.equal(trafficRouteCalls, 2, 'Traffic evidence must evaluate every optimized leg');
  assert.equal(evidence.traffic.status, 'available');
  assert.equal(evidence.traffic.evidence?.evaluatedLegs, 2);
  assert.equal(evidence.traffic.evidence?.totalLegs, 2);
  assert.equal(evidence.traffic.evidence?.delaySeconds, 60);
  globalThis.fetch = originalFetch;

  console.log('Route optimizer legality, options, schedule, traffic, truck routing, cache, and concurrency checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});