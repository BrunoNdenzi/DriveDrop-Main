const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_BASE = process.env.DRIVER_ROUTE_TEST_API || 'http://localhost:3001/api/v1/driver-routes';
const TEST_EMAIL = 'driver-route-lifecycle-test@drivedrop.dev';
const TEST_PASSWORD = 'DriverRouteLifecycle!2026';
const TEST_MARKER = '[TEST][DRIVER_ROUTE_LIFECYCLE]';
const KEEP_FIXTURE = process.env.KEEP_DRIVER_ROUTE_FIXTURE === 'true';
const CLEANUP_ONLY = process.env.CLEANUP_DRIVER_ROUTE_FIXTURE === 'true';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId = null;
  let shipmentId = null;

  const cleanup = async () => {
    if (!userId) {
      const { data: profile } = await admin.from('profiles').select('id').eq('email', TEST_EMAIL).maybeSingle();
      userId = profile?.id ?? null;
    }
    if (!userId) return;
    await admin.from('shipments').delete().eq('driver_id', userId).like('title', `${TEST_MARKER}%`);
    await admin.from('profiles').delete().eq('id', userId).eq('email', TEST_EMAIL);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !/not found/i.test(error.message)) throw error;
  };

  try {
    await cleanup();
    if (CLEANUP_ONLY) {
      console.log('Removed marked driver route lifecycle test data.');
      return;
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: '[TEST] Driver', last_name: 'Route Lifecycle', role: 'driver', test_marker: TEST_MARKER },
    });
    if (createError || !created.user) throw createError || new Error('Unable to create driver route test user');
    userId = created.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      email: TEST_EMAIL,
      first_name: '[TEST] Driver',
      last_name: 'Route Lifecycle',
      role: 'driver',
      is_verified: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    shipmentId = randomUUID();
    const { error: shipmentError } = await admin.from('shipments').insert({
      id: shipmentId,
      client_id: userId,
      driver_id: userId,
      assignment_type: 'broker_assigned',
      status: 'assigned',
      title: `${TEST_MARKER} Charlotte delivery`,
      description: `${TEST_MARKER} deterministic lifecycle fixture`,
      pickup_address: '400 E Martin Luther King Jr Blvd, Charlotte, NC 28202',
      pickup_location: 'POINT(-80.8376 35.2195)',
      delivery_address: '5501 Josh Birmingham Pkwy, Charlotte, NC 28208',
      delivery_location: 'POINT(-80.9473 35.2144)',
      vehicle_year: 2022,
      vehicle_make: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_type: 'sedan',
      vehicle_count: 1,
      is_operable: true,
      estimated_price: 325,
      final_price: 325,
      driver_offer_amount: 260,
      terms_accepted: true,
      updated_at: new Date().toISOString(),
    });
    if (shipmentError) throw shipmentError;

    const { data: login, error: loginError } = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (loginError || !login.session?.access_token) throw loginError || new Error('No driver route test token');
    const token = login.session.access_token;

    const request = async (pathName, options = {}, authenticated = true) => {
      const response = await fetch(`${API_BASE}${pathName}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('json') ? await response.json() : await response.text();
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathName} failed (${response.status}): ${JSON.stringify(body)}`);
      return { response, body };
    };

    const optimized = (await request('/optimize', {
      method: 'POST',
      body: JSON.stringify({
        name: `${TEST_MARKER} Charlotte Run`,
        driverLocation: '222 E 3rd St, Charlotte, NC 28202',
        shipmentIds: [shipmentId],
        options: { vehicleType: 'car_hauler_loaded', vehicleSlots: 5, maxHours: 11, preferHighway: true },
      }),
    })).body.data;
    assert.equal(optimized.route.status, 'planned');
    assert.equal(optimized.route.current_version, 1);
    assert.equal(optimized.route.shipment_ids[0], shipmentId);
    assert.equal(optimized.optimizedRoute.stops.length, 3);
    assert.equal(optimized.optimizedRoute.totalAcceptedPayout, 260);

    const routeId = optimized.route.id;
    const versions = (await request(`/routes/${routeId}/versions`)).body.data;
    assert.deepEqual(versions.map(version => version.version_number), [1]);

    const execution = (await request(`/routes/${routeId}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ plannedStartAt: new Date().toISOString() }),
    })).body.data;
    assert.equal(execution.status, 'dispatched');
    assert.equal(execution.stop_progress.length, 3);

    const started = (await request(`/executions/${execution.id}/start`, { method: 'POST', body: '{}' })).body.data;
    assert.equal(started.status, 'in_progress');

    const pickup = started.stop_progress.find(stop => stop.type === 'pickup');
    const pickupResult = (await request(`/executions/${execution.id}/stops/${encodeURIComponent(pickup.stopId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'completed', timestamp: new Date().toISOString(), latitude: 35.2195, longitude: -80.8376, gpsAccuracyMeters: 7 }),
    })).body.data;
    assert.equal(pickupResult.stop_progress.find(stop => stop.stopId === pickup.stopId).status, 'completed');
    const { data: pickedUpShipment } = await admin.from('shipments').select('status').eq('id', shipmentId).single();
    assert.equal(pickedUpShipment.status, 'picked_up');

    const reoptimized = (await request(`/executions/${execution.id}/reoptimize`, {
      method: 'POST',
      body: JSON.stringify({ currentLocation: { address: '400 E Martin Luther King Jr Blvd, Charlotte, NC 28202', latitude: 35.2195, longitude: -80.8376 } }),
    })).body.data;
    assert.equal(reoptimized.execution.version_number, 2);
    assert.equal(reoptimized.execution.reoptimizations.length, 1);

    const delivery = reoptimized.execution.stop_progress.find(stop => stop.type === 'delivery');
    const delivered = (await request(`/executions/${execution.id}/stops/${encodeURIComponent(delivery.stopId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'completed',
        timestamp: new Date().toISOString(),
        latitude: 35.2144,
        longitude: -80.9473,
        gpsAccuracyMeters: 6,
        proofOfDeliveryUrls: ['https://example.test/driver-pod.jpg'],
      }),
    })).body.data;
    assert.equal(delivered.status, 'completed');
    const { data: deliveredShipment } = await admin.from('shipments').select('status').eq('id', shipmentId).single();
    assert.equal(deliveredShipment.status, 'delivered');

    const report = (await request(`/executions/${execution.id}/report`)).body.data;
    assert.equal(report.completedStops, 2);
    assert.equal(report.stopAnalysis.some(stop => stop.proofOfDeliveryUrls?.length === 1), true);

    const share = (await request(`/routes/${routeId}/shares`, { method: 'POST', body: JSON.stringify({ permission: 'track' }) })).body.data;
    const publicShare = (await request(`/shared/${share.token}`, {}, false)).body.data;
    assert.equal(publicShare.route.id, routeId);
    assert.equal(publicShare.execution.id, execution.id);

    const csv = await request(`/routes/${routeId}/export?format=csv`);
    assert.match(csv.body, /order,shipment_id,name,address,type,service_minutes,planned_arrival/);
    const json = await request(`/routes/${routeId}/export?format=json`);
    assert.equal(json.body.version, 2);

    const restored = (await request(`/routes/${routeId}/versions/1/restore`, { method: 'POST', body: '{}' })).body.data;
    assert.equal(restored.status, 'planned');
    assert.equal(restored.current_version, 3);

    const { count: billingEvents } = await admin.from('planner_usage_events').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const { count: subscriptions } = await admin.from('planner_subscriptions').select('user_id', { count: 'exact', head: true }).eq('user_id', userId);
    assert.equal(billingEvents, 0);
    assert.equal(subscriptions, 0);

    console.log('Driver route lifecycle E2E passed: saved optimization, dispatch, shipment sync, reoptimization, POD, reporting, sharing, export, restore, and billing isolation.');
    if (KEEP_FIXTURE) console.log(`Kept marked fixture: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  } finally {
    if (!KEEP_FIXTURE) {
      await cleanup();
      console.log('Removed marked driver route lifecycle test data.');
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
