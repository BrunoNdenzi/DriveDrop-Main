import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import config from '@config';
import { driverLimitReached, plans, pricePlan } from '../src/services/plannerBilling.service';
import {
  normalizeAddedStops,
  normalizeRecurrence,
  normalizeStops,
  parseImportRows,
} from '../src/routes/standaloneRoutePlanner.routes';
import {
  REOPTIMIZE_ORIGIN_ID,
  arrivalBlockMessage,
  buildAddedStops,
  buildReoptimizationStops,
  evaluateArrival,
  parseLocationPing,
  plannedStopsFromSnapshot,
  publicLastLocation,
  summarizeDeviations,
  upsertDeviation,
  type ProgressStop,
} from '../src/services/plannerLiveRoute';

function checkArrivalVerification(): void {
  const target = { latitude: 35.2271, longitude: -80.8431 };
  const northOf = (meters: number) => ({ latitude: target.latitude + meters / 111195, longitude: target.longitude });
  const body = (extra: Record<string, unknown> = {}) => ({ arrivalTarget: { ...target, radiusMeters: 150 }, ...extra });

  assert.equal(evaluateArrival({}, northOf(10)), null);
  assert.equal(evaluateArrival(body(), northOf(60))?.verdict, 'verified');

  const far = evaluateArrival(body(), { ...northOf(900), accuracyMeters: 10 });
  assert.equal(far?.verdict, 'outside');
  assert.equal(far?.distanceMeters, 900);
  assert.match(arrivalBlockMessage(far!)!, /0\.6 mi from this stop/);

  const overridden = evaluateArrival(body({ overrideCode: 'gate_or_access', overrideNote: ' Locked gate ' }), { ...northOf(900), accuracyMeters: 10 });
  assert.equal(overridden?.overrideCode, 'gate_or_access');
  assert.equal(overridden?.overrideNote, 'Locked gate');
  assert.equal(arrivalBlockMessage(overridden!), null);

  // Accuracy buys a little leeway, a very poor fix is not trusted either way.
  assert.equal(evaluateArrival(body(), { ...northOf(220), accuracyMeters: 80 })?.verdict, 'verified');
  assert.equal(evaluateArrival(body(), { ...northOf(10), accuracyMeters: 500 })?.verdict, 'unreliable');
  assert.equal(evaluateArrival(body(), {})?.verdict, 'unreliable');
  assert.equal(arrivalBlockMessage(evaluateArrival(body(), {})!), null);

  // The radius is clamped so a client cannot widen the zone to cover anywhere.
  const huge = evaluateArrival({ arrivalTarget: { ...target, radiusMeters: 50000 } }, { ...northOf(2000), accuracyMeters: 5 });
  assert.equal(huge?.radiusMeters, 500);
  assert.equal(huge?.verdict, 'outside');

  assert.throws(() => evaluateArrival({ arrivalTarget: { latitude: 35 } }, {}), /latitude and longitude/);
  assert.throws(() => evaluateArrival(body({ overrideCode: 'because' }), northOf(10)), /not recognised/);
}

function checkAddedShipment(): void {
  const now = new Date('2026-10-02T12:00:00.000Z');
  const planned = plannedStopsFromSnapshot({
    optimizedResult: {
      stops: [
        { id: 'depot', type: 'current_location' },
        { id: 'p1', type: 'pickup', shipmentId: 'A' },
        { id: 'd1', type: 'delivery', shipmentId: 'A' },
      ],
    },
  });
  const progress: ProgressStop[] = ['depot', 'p1', 'd1'].map(stopId => ({
    stopId,
    address: `${stopId} address`,
    plannedServiceMinutes: 10,
    status: stopId === 'depot' || stopId === 'p1' ? 'completed' as const : 'pending' as const,
  }));

  // The first added stop is a real pickup, not coerced into a depot like the first stop of a new route.
  const added = normalizeAddedStops([
    { id: 'np', type: 'pickup', address: '1 Pickup St', referenceId: 'NEW', serviceMinutes: 15, latitude: 35.1, longitude: -80.8 },
    { id: 'nd', type: 'delivery', address: '2 Drop Ave', referenceId: 'NEW' },
  ]);
  assert.equal(added[0]?.type, 'pickup');
  assert.equal(added[1]?.estimatedDuration, 10);

  const extra = buildAddedStops({ added, progress, planned, now });
  assert.deepEqual(extra.progress.map(stop => [stop.stopId, stop.status, stop.plannedServiceMinutes]), [['np', 'pending', 15], ['nd', 'pending', 10]]);

  // One re-plan covers the old unfinished stop and the whole new shipment, pickup before its delivery pairing intact.
  const rebuilt = buildReoptimizationStops({
    progress: [...progress, ...extra.progress],
    planned: [...planned, ...extra.planned],
    currentLocation: { latitude: 35.3, longitude: -80.7 },
    lastKnown: null,
    now,
  });
  assert.deepEqual(rebuilt.stops.slice(1).map(stop => stop.id), ['d1', 'np', 'nd']);
  assert.deepEqual(rebuilt.stops.slice(1).map(stop => [stop.type, stop.shipmentId]), [['delivery', 'A'], ['pickup', 'NEW'], ['delivery', 'NEW']]);
  assert.equal(rebuilt.stops[2]?.latitude, 35.1);

  // A pair without a reference is matched automatically; a lone delivery (already loaded) is allowed.
  const auto = buildAddedStops({ added: normalizeAddedStops([{ type: 'pickup', address: 'a' }, { type: 'delivery', address: 'b' }]), progress, planned, now });
  assert.equal(auto.planned[0]?.shipmentId, auto.planned[1]?.shipmentId);
  assert.ok(auto.planned[0]?.shipmentId);
  assert.equal(buildAddedStops({ added: normalizeAddedStops([{ type: 'delivery', address: 'only drop' }]), progress, planned, now }).planned[0]?.shipmentId, undefined);

  assert.throws(() => buildAddedStops({ added: normalizeAddedStops([{ type: 'pickup', address: 'a', referenceId: 'LONE' }]), progress, planned, now }), /has no delivery/);
  assert.throws(() => buildAddedStops({ added: normalizeAddedStops([{ type: 'pickup', address: 'a' }, { type: 'pickup', address: 'b' }]), progress, planned, now }), /reference/);
  assert.throws(() => buildAddedStops({ added: normalizeAddedStops([{ type: 'delivery', address: 'a', referenceId: 'A' }]), progress, planned, now }), /already used/);
  assert.throws(() => buildAddedStops({ added: normalizeAddedStops([{ id: 'd1', type: 'stop', address: 'a' }]), progress, planned, now }), /already exists/);
  assert.throws(() => normalizeAddedStops([]), /between 1 and 10/);
  assert.throws(() => buildAddedStops({ added: normalizeAddedStops([{ type: 'fuel', address: 'a' }]), progress, planned, now }), /pickup, a delivery, or a plain stop/);
}

function checkDeviations(): void {
  const now = new Date('2026-10-07T12:00:00.000Z');
  const started = upsertDeviation([], 'dev-1', { startedAt: '2026-10-07T11:50:00.000Z', maxDistanceMeters: 180, latitude: 35.2, longitude: -80.8 }, now);
  assert.equal(started.length, 1);
  assert.equal(started[0]?.reason, 'unspecified');

  // Updates merge by id, keep the farthest distance, and never duplicate on a retry.
  const reasoned = upsertDeviation(started, 'dev-1', { reason: 'road_blocked', maxDistanceMeters: 90 }, now);
  assert.equal(reasoned.length, 1);
  assert.equal(reasoned[0]?.reason, 'road_blocked');
  assert.equal(reasoned[0]?.maxDistanceMeters, 180);
  assert.equal(reasoned[0]?.latitude, 35.2);
  const ended = upsertDeviation(reasoned, 'dev-1', { endedAt: '2026-10-07T11:56:00.000Z', resolution: 'rerouted', addedMinutes: 4.4 }, now);
  assert.deepEqual(ended, upsertDeviation(ended, 'dev-1', { endedAt: '2026-10-07T11:56:00.000Z', resolution: 'rerouted', addedMinutes: 4.4 }, now));
  assert.equal(ended[0]?.addedMinutes, 4);

  const two = upsertDeviation(ended, 'dev-2', { startedAt: '2026-10-07T11:58:00.000Z', reason: 'personal_stop', endedAt: '2026-10-07T11:59:00.000Z', resolution: 'break_ended' }, now);
  assert.deepEqual(summarizeDeviations(two), { count: 2, totalMinutes: 7, byReason: { road_blocked: 1, personal_stop: 1 } });

  assert.throws(() => upsertDeviation([], 'bad id!', {}, now), /id is invalid/);
  assert.throws(() => upsertDeviation([], 'x', {}, now), /Start time is required/);
  assert.throws(() => upsertDeviation([], 'x', { startedAt: now.toISOString(), reason: 'because' }, now), /not recognised/);
  assert.throws(() => upsertDeviation([], 'x', { startedAt: '2026-10-08T12:00:00.000Z' }, now), /future/);
}

function checkPricingTiers(): void {
  assert.deepEqual(
    (['free', 'solo', 'team', 'business'] as const).map(key => [plans[key].monthlyRoutes, plans[key].maxDrivers]),
    [[5, 1], [null, 1], [null, 3], [null, 10]],
  );
  assert.equal(plans.free.recurringRoutes, false);
  assert.equal(plans.free.routeSharing, false);
  for (const key of ['solo', 'team', 'business'] as const) {
    assert.equal(plans[key].recurringRoutes, true);
    assert.equal(plans[key].routeSharing, true);
  }
  assert.equal(plans.solo.maxStopsPerRoute, 50);
  assert.equal(plans.business.maxStopsPerRoute, 100);

  assert.equal(driverLimitReached(plans.solo, 0), false);
  assert.equal(driverLimitReached(plans.solo, 1), true);
  assert.equal(driverLimitReached(plans.team, 2), false);
  assert.equal(driverLimitReached(plans.team, 3), true);
  assert.equal(driverLimitReached(plans.business, 9), false);
  assert.equal(driverLimitReached(plans.business, 10), true);

  // Existing Starter and Pro subscribers keep their limits and are never capped on drivers.
  assert.equal(plans.starter.monthlyRoutes, 100);
  assert.equal(plans.starter.maxStopsPerRoute, 50);
  assert.equal(driverLimitReached(plans.starter, 50), false);
  assert.equal(driverLimitReached(plans.pro, 50), false);

  const original = { ...config.stripe.plannerPriceIds, basic: config.stripe.priceIdBasic, premium: config.stripe.priceIdPremium };
  Object.assign(config.stripe.plannerPriceIds, { solo: 'price_solo', team: 'price_team', business: 'price_business' });
  config.stripe.priceIdBasic = 'price_legacy_basic';
  config.stripe.priceIdPremium = 'price_legacy_premium';
  try {
    assert.equal(pricePlan('price_solo'), 'solo');
    assert.equal(pricePlan('price_team'), 'team');
    assert.equal(pricePlan('price_business'), 'business');
    assert.equal(pricePlan('price_legacy_basic'), 'starter');
    assert.equal(pricePlan('price_legacy_premium'), 'pro');
    assert.equal(pricePlan('price_unknown'), 'free');
    assert.equal(pricePlan(null), 'free');
  } finally {
    Object.assign(config.stripe.plannerPriceIds, { solo: original.solo, team: original.team, business: original.business });
    config.stripe.priceIdBasic = original.basic;
    config.stripe.priceIdPremium = original.premium;
  }
}

function checkLiveRoute(): void {
  const now = new Date('2026-10-02T12:00:00.000Z');

  const ping = parseLocationPing({ latitude: 35.2, longitude: -80.8, heading: 90, speedMps: 12, simulated: true, recordedAt: '2026-10-02T11:59:50.000Z' }, now);
  assert.equal(ping.simulated, true);
  assert.equal(ping.recordedAt, '2026-10-02T11:59:50.000Z');
  assert.equal(parseLocationPing({ latitude: 1, longitude: 2 }, now).recordedAt, now.toISOString());
  assert.throws(() => parseLocationPing({ latitude: 91, longitude: 0 }, now), /Latitude is invalid/);
  assert.throws(() => parseLocationPing({ latitude: 1 }, now), /required/);
  assert.throws(() => parseLocationPing({ latitude: 1, longitude: 2, recordedAt: '2026-10-02T13:00:00.000Z' }, now), /future/);

  const stored = { last_latitude: 35.2, last_longitude: -80.8, last_location_at: '2026-10-02T11:59:50.000Z' };
  assert.equal(publicLastLocation({ ...stored, status: 'completed' }), null);
  assert.equal(publicLastLocation({ ...stored, status: 'cancelled' }), null);
  assert.equal(publicLastLocation({ status: 'in_progress' }), null);
  assert.equal(publicLastLocation({ ...stored, status: 'in_progress', last_location_simulated: true })?.simulated, true);

  const planned = plannedStopsFromSnapshot({
    optimizedResult: {
      stops: [
        { id: 'depot', type: 'current_location' },
        { id: 'p1', type: 'pickup', shipmentId: 'A', latitude: 35.1, longitude: -80.9 },
        { id: 'd1', type: 'delivery', shipmentId: 'A' },
        { id: 'p2', type: 'pickup', shipmentId: 'B' },
        { id: 'd2', type: 'delivery', shipmentId: 'B', priority: 'high' },
      ],
    },
  });
  const progress = (overrides: Record<string, Partial<ProgressStop>> = {}): ProgressStop[] =>
    ['depot', 'p1', 'd1', 'p2', 'd2'].map(stopId => ({
      stopId,
      address: `${stopId} address`,
      plannedServiceMinutes: 10,
      status: 'pending' as const,
      ...overrides[stopId],
    }));
  const location = { latitude: 35.3, longitude: -80.7 };

  const fromDriver = buildReoptimizationStops({
    progress: progress({ depot: { status: 'completed' }, p1: { status: 'completed', completedAt: '2026-10-02T11:00:00.000Z' } }),
    planned,
    currentLocation: location,
    lastKnown: null,
    now,
  });
  assert.equal(fromDriver.originSource, 'current_location');
  assert.equal(fromDriver.stops[0]?.id, REOPTIMIZE_ORIGIN_ID);
  assert.equal(fromDriver.stops[0]?.latitude, 35.3);
  assert.deepEqual(fromDriver.stops.slice(1).map(stop => stop.id), ['d1', 'p2', 'd2']);
  assert.equal(fromDriver.stops[1]?.type, 'delivery');
  assert.equal(fromDriver.stops[1]?.shipmentId, 'A');
  assert.equal(fromDriver.stops[3]?.priority, 'high');

  const unstarted = buildReoptimizationStops({ progress: progress(), planned, currentLocation: location, lastKnown: null, now });
  assert.deepEqual(unstarted.departedStopIds, ['depot']);
  assert.equal(unstarted.stops.some(stop => stop.id === 'depot'), false);

  const fresh = buildReoptimizationStops({
    progress: progress({ depot: { status: 'completed' } }),
    planned,
    currentLocation: null,
    lastKnown: { ...location, recordedAt: '2026-10-02T11:58:00.000Z' },
    now,
  });
  assert.equal(fresh.originSource, 'last_known');

  const stale = buildReoptimizationStops({
    progress: progress({
      depot: { status: 'completed', completedAt: '2026-10-02T08:00:00.000Z' },
      p1: { status: 'completed', completedAt: '2026-10-02T09:00:00.000Z', actualLatitude: 35.11, actualLongitude: -80.91 },
    }),
    planned,
    currentLocation: null,
    lastKnown: { ...location, recordedAt: '2026-10-02T11:00:00.000Z' },
    now,
  });
  assert.equal(stale.originSource, 'last_finished_stop');
  assert.equal(stale.stops[0]?.address, 'p1 address');
  assert.equal(stale.stops[0]?.latitude, 35.11);

  const nothingKnown = buildReoptimizationStops({ progress: progress(), planned, currentLocation: null, lastKnown: null, now });
  assert.equal(nothingKnown.originSource, 'first_remaining');
  assert.equal(nothingKnown.stops[0]?.type, 'current_location');
  assert.equal(nothingKnown.stops.length, 5);

  // The closing "End" stop of a return trip stays pinned last when the rest is re-planned.
  const withEnd = plannedStopsFromSnapshot({
    optimizedResult: {
      stops: [
        { id: 'depot', type: 'current_location' },
        { id: 'p1', type: 'pickup', shipmentId: 'A' },
        { id: 'd1', type: 'delivery', shipmentId: 'A' },
        { id: 'depot-end', type: 'stop', isReturn: true },
      ],
    },
  });
  const endProgress: ProgressStop[] = ['depot', 'p1', 'd1', 'depot-end'].map(stopId => ({
    stopId,
    address: `${stopId} address`,
    plannedServiceMinutes: 0,
    status: stopId === 'depot' ? 'completed' as const : 'pending' as const,
  }));
  const replanned = buildReoptimizationStops({ progress: endProgress, planned: withEnd, currentLocation: location, lastKnown: null, now });
  const endStop = replanned.stops.find(stop => stop.id === 'depot-end');
  assert.equal(endStop?.pinnedLast, true);
  assert.equal(endStop?.isReturn, true);
  assert.equal(replanned.stops.filter(stop => stop.pinnedLast).length, 1);
}

async function main(): Promise<void> {
  const stops = normalizeStops([
    { name: 'Depot', address: '100 Main St, Charlotte, NC' },
    { name: 'Customer', address: '200 Trade St, Charlotte, NC', serviceMinutes: 20 },
  ]);
  assert.equal(stops[0]?.type, 'current_location');
  assert.equal(stops[1]?.type, 'stop');
  assert.equal(stops[1]?.estimatedDuration, 20);

  const csvRows = await parseImportRows(undefined, 'name,address,service_minutes\nDepot,"100 Main St, Charlotte, NC",0\nCustomer,"200 Trade St, Charlotte, NC",15');
  assert.equal(csvRows.length, 2);
  assert.equal(csvRows[1]?.['address'], '200 Trade St, Charlotte, NC');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stops');
  worksheet.addRow(['name', 'address', 'service_minutes']);
  worksheet.addRow(['Warehouse', '300 South Blvd, Charlotte, NC', 25]);
  const workbookData = await workbook.xlsx.writeBuffer();
  const xlsxRows = await parseImportRows({
    originalname: 'route.xlsx',
    buffer: Buffer.from(workbookData),
  } as Express.Multer.File, undefined);
  assert.equal(xlsxRows.length, 1);
  assert.equal(xlsxRows[0]?.['name'], 'Warehouse');
  assert.equal(xlsxRows[0]?.['service_minutes'], '25');

  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const schedule = normalizeRecurrence({
    frequency: 'weekly',
    interval: 2,
    weekdays: [startsAt.getUTCDay()],
    startsAt: startsAt.toISOString(),
  });
  assert.equal(schedule.recurrence?.interval, 2);
  assert.equal(schedule.nextRunAt, startsAt.toISOString());

  assert.throws(
    () => normalizeStops([{ address: 'Only one stop' }]),
    /between 2 and 100 stops/
  );

  console.log('Standalone planner stop, recurrence, CSV, and XLSX checks passed.');
  checkLiveRoute();
  console.log('Live location and reoptimization checks passed.');
  checkPricingTiers();
  console.log('Pricing tier and driver limit checks passed.');
  checkArrivalVerification();
  console.log('Arrival verification checks passed.');
  checkAddedShipment();
  console.log('Added shipment checks passed.');
  checkDeviations();
  console.log('Deviation checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});