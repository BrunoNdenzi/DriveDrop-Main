import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import config from '@config';
import { driverLimitReached, plans, pricePlan } from '../src/services/plannerBilling.service';
import {
  normalizeRecurrence,
  normalizeStops,
  parseImportRows,
} from '../src/routes/standaloneRoutePlanner.routes';
import {
  REOPTIMIZE_ORIGIN_ID,
  arrivalBlockMessage,
  buildReoptimizationStops,
  evaluateArrival,
  parseLocationPing,
  plannedStopsFromSnapshot,
  publicLastLocation,
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
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});