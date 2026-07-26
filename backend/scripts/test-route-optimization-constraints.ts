import assert from 'node:assert/strict';
import { googleMapsService } from '../src/services/google-maps.service';
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

function locationKey(location: string | { lat: number; lng: number }): string {
  assert.notEqual(typeof location, 'string');
  const coordinates = location as { lat: number; lng: number };
  return `${coordinates.lat.toFixed(4)},${coordinates.lng.toFixed(4)}`;
}

googleMapsService.geocodeAddress = async () => {
  geocodeCalls++;
  throw new Error('Stored coordinates should avoid geocoding');
};

googleMapsService.getDistanceMatrix = async (origins, destinations) => {
  matrixCalls++;
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

googleMapsService.getDirections = async (origin, destination) => {
  directionsCalls++;
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

  const firstDirectionsCalls = directionsCalls;
  const second = await routeOptimizationService.optimizeRoute(stops, { vehicleSlots: 1 });
  assertLegalOrder(second.stops, 1);
  assert.equal(matrixCalls, 1, 'Second optimization should use the distance cache');
  assert.equal(directionsCalls, firstDirectionsCalls, 'Second optimization should use the directions cache');

  console.log('Route optimizer constraint, coordinate, cache, and concurrency checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});