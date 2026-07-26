import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { googleMapsService } from '../src/services/google-maps.service';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TEST_EMAIL = 'routeplanner-test-driver@drivedrop.dev';
const TEST_FIRST_NAME = '[TEST] Route Planner';
const TEST_LAST_NAME = 'Driver';
const TEST_MARKER = '[TEST][ROUTE_PLANNER]';
const PRODUCTION_PROJECT_REF = 'tgdewxxmfmbvvcelngeg';

const SHIPMENTS = [
  {
    id: '7a110001-25c0-4a11-9000-000000000001',
    status: 'accepted',
    title: `${TEST_MARKER} Uptown to Concord`,
    vehicle: { year: 2022, make: 'Toyota', model: 'Camry', type: 'sedan' },
    pickupAddress: '400 E Martin Luther King Jr Blvd, Charlotte, NC 28202',
    deliveryAddress: '5555 Concord Pkwy S, Concord, NC 28027',
    estimatedPrice: 315,
  },
  {
    id: '7a110002-25c0-4a11-9000-000000000002',
    status: 'assigned',
    title: `${TEST_MARKER} Concord to Stadium`,
    vehicle: { year: 2021, make: 'Honda', model: 'CR-V', type: 'suv' },
    pickupAddress: '5555 Concord Pkwy S, Concord, NC 28027',
    deliveryAddress: '800 S Mint St, Charlotte, NC 28202',
    estimatedPrice: 340,
  },
  {
    id: '7a110003-25c0-4a11-9000-000000000003',
    status: 'accepted',
    title: `${TEST_MARKER} SouthPark to CLT`,
    vehicle: { year: 2023, make: 'Ford', model: 'Mustang', type: 'sedan' },
    pickupAddress: '4400 Sharon Rd, Charlotte, NC 28211',
    deliveryAddress: '5501 Josh Birmingham Pkwy, Charlotte, NC 28208',
    estimatedPrice: 285,
  },
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function findAuthUserByEmail(admin: SupabaseClient<any, 'public', any>): Promise<User | null> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', TEST_EMAIL)
    .maybeSingle();
  if (profileError) throw profileError;
  const profileId = (profile as { id?: unknown } | null)?.id;
  if (typeof profileId !== 'string') return null;

  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error) throw error;
  return data.user;
}

async function run(): Promise<void> {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = requiredEnv('SUPABASE_ANON_KEY');
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const isProduction = projectRef === PRODUCTION_PROJECT_REF;

  console.log(`Target Supabase project: ${projectRef} (${isProduction ? 'PRODUCTION' : 'non-production'})`);
  if (isProduction && process.env['ALLOW_PRODUCTION_ROUTE_PLANNER_SEED'] !== 'true') {
    throw new Error('Production seed blocked. Set ALLOW_PRODUCTION_ROUTE_PLANNER_SEED=true for this explicit test run.');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Geocoding six real Charlotte-area endpoints...');
  const geocoded = await Promise.all(SHIPMENTS.map(async shipment => {
    const [pickup, delivery] = await Promise.all([
      googleMapsService.geocodeAddress(shipment.pickupAddress),
      googleMapsService.geocodeAddress(shipment.deliveryAddress),
    ]);
    return { pickup, delivery };
  }));

  const password = `Rp!${randomBytes(24).toString('base64url')}9a`;
  let authUser = await findAuthUserByEmail(admin);
  if (authUser) {
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { first_name: TEST_FIRST_NAME, last_name: TEST_LAST_NAME, role: 'driver', test_marker: TEST_MARKER },
    });
    if (error || !data.user) throw error ?? new Error('Failed to update test auth user');
    authUser = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { first_name: TEST_FIRST_NAME, last_name: TEST_LAST_NAME, role: 'driver', test_marker: TEST_MARKER },
    });
    if (error || !data.user) throw error ?? new Error('Failed to create test auth user');
    authUser = data.user;
  }

  const driverId = authUser.id;
  const { error: profileError } = await admin.from('profiles').upsert({
    id: driverId,
    email: TEST_EMAIL,
    first_name: TEST_FIRST_NAME,
    last_name: TEST_LAST_NAME,
    role: 'driver',
    is_verified: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const now = new Date().toISOString();
  const shipmentRows = SHIPMENTS.map((shipment, index) => ({
    id: shipment.id,
    client_id: driverId,
    driver_id: driverId,
    status: shipment.status,
    title: shipment.title,
    description: `${TEST_MARKER} Adversarial precedence fixture. Remove with cleanup-route-planner-test-data.ts.`,
    pickup_address: geocoded[index]!.pickup.formattedAddress ?? shipment.pickupAddress,
    pickup_location: `POINT(${geocoded[index]!.pickup.longitude} ${geocoded[index]!.pickup.latitude})`,
    delivery_address: geocoded[index]!.delivery.formattedAddress ?? shipment.deliveryAddress,
    delivery_location: `POINT(${geocoded[index]!.delivery.longitude} ${geocoded[index]!.delivery.latitude})`,
    vehicle_year: shipment.vehicle.year,
    vehicle_make: shipment.vehicle.make,
    vehicle_model: shipment.vehicle.model,
    vehicle_type: shipment.vehicle.type,
    vehicle_count: 1,
    is_operable: true,
    estimated_price: shipment.estimatedPrice,
    final_price: shipment.estimatedPrice,
    terms_accepted: true,
    updated_at: now,
  }));

  const { error: shipmentError } = await admin
    .from('shipments')
    .upsert(shipmentRows, { onConflict: 'id' });
  if (shipmentError) throw shipmentError;

  for (const shipment of SHIPMENTS) {
    const { data, error } = await admin.rpc('get_shipment_coordinates', { shipment_id: shipment.id });
    if (error) throw new Error(`Coordinate RPC failed for ${shipment.id}: ${error.message}`);
    const coordinates = Array.isArray(data) ? data[0] : data;
    if (!coordinates || typeof coordinates !== 'object') {
      throw new Error(`Coordinate RPC returned no row for ${shipment.id}`);
    }
  }

  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password });
  if (signInError || !signIn.session?.access_token) {
    throw signInError ?? new Error('Test driver sign-in returned no access token');
  }

  const sessionId = `route-planner-live-${randomUUID()}`;
  console.log(`Seeded/reused test driver: ${TEST_EMAIL}`);
  console.log(`Driver ID: ${driverId}`);
  console.log(`Shipment IDs: ${SHIPMENTS.map(shipment => shipment.id).join(', ')}`);
  console.log(`Session ID: ${sessionId}`);

  if (process.argv.includes('--call-benji')) {
    const port = process.env['PORT'] ?? '3001';
    const response = await fetch(`http://localhost:${port}/api/v1/benji-v3/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${signIn.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "how's my route looking today",
        sessionId,
      }),
    });
    const body = await response.text();
    console.log('--- LIVE BENJI RESPONSE ---');
    console.log(JSON.stringify({ status: response.status, sessionId, body: JSON.parse(body) }, null, 2));
    if (!response.ok) process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});