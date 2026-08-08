import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PRODUCTION_PROJECT_REF = 'tgdewxxmfmbvvcelngeg';
const TEST_MARKER = '[TEST][FRESH_PRODUCTION]';

const USERS = {
  client: {
    email: 'brunondenzi80@gmail.com',
    firstName: 'Bruno',
    lastName: 'Denzi',
    role: 'client',
  },
  driver: {
    email: 'btrading456@gmail.com',
    firstName: 'B Trading',
    lastName: 'Driver',
    role: 'driver',
  },
} as const;

interface LocationFixture {
  address: string;
  latitude: number;
  longitude: number;
  city: string;
  zip: string;
}

const LOCATIONS = {
  uptown: {
    address: '400 E Martin Luther King Jr Blvd, Charlotte, NC 28202',
    latitude: 35.22095,
    longitude: -80.84312,
    city: 'Charlotte',
    zip: '28202',
  },
  southPark: {
    address: '4400 Sharon Rd, Charlotte, NC 28211',
    latitude: 35.15231,
    longitude: -80.83152,
    city: 'Charlotte',
    zip: '28211',
  },
  airport: {
    address: '5501 Josh Birmingham Pkwy, Charlotte, NC 28208',
    latitude: 35.21442,
    longitude: -80.94731,
    city: 'Charlotte',
    zip: '28208',
  },
  stadium: {
    address: '800 S Mint St, Charlotte, NC 28202',
    latitude: 35.22578,
    longitude: -80.85284,
    city: 'Charlotte',
    zip: '28202',
  },
  concordMills: {
    address: '8111 Concord Mills Blvd, Concord, NC 28027',
    latitude: 35.37062,
    longitude: -80.72426,
    city: 'Concord',
    zip: '28027',
  },
  speedway: {
    address: '5555 Concord Pkwy S, Concord, NC 28027',
    latitude: 35.35155,
    longitude: -80.68691,
    city: 'Concord',
    zip: '28027',
  },
} satisfies Record<string, LocationFixture>;

const SHIPMENTS = [
  {
    id: 'f1200001-2026-4a11-9000-000000000001',
    vehicle: { year: 2022, make: 'Toyota', model: 'Camry', type: 'sedan' },
    pickup: LOCATIONS.uptown,
    delivery: LOCATIONS.speedway,
    price: 325,
    note: 'Shared pickup A',
  },
  {
    id: 'f1200002-2026-4a11-9000-000000000002',
    vehicle: { year: 2023, make: 'Honda', model: 'CR-V', type: 'suv' },
    pickup: LOCATIONS.uptown,
    delivery: LOCATIONS.stadium,
    price: 280,
    note: 'Shared pickup B',
  },
  {
    id: 'f1200003-2026-4a11-9000-000000000003',
    vehicle: { year: 2021, make: 'Ford', model: 'Mustang', type: 'sedan' },
    pickup: LOCATIONS.southPark,
    delivery: LOCATIONS.airport,
    price: 295,
    note: 'Shared delivery A',
  },
  {
    id: 'f1200004-2026-4a11-9000-000000000004',
    vehicle: { year: 2024, make: 'Hyundai', model: 'Tucson', type: 'suv' },
    pickup: LOCATIONS.concordMills,
    delivery: LOCATIONS.airport,
    price: 340,
    note: 'Shared delivery B',
  },
  {
    id: 'f1200005-2026-4a11-9000-000000000005',
    vehicle: { year: 2020, make: 'Chevrolet', model: 'Silverado', type: 'truck' },
    pickup: LOCATIONS.speedway,
    delivery: LOCATIONS.southPark,
    price: 365,
    note: 'Unique endpoints A',
  },
  {
    id: 'f1200006-2026-4a11-9000-000000000006',
    vehicle: { year: 2022, make: 'BMW', model: 'X3', type: 'suv' },
    pickup: LOCATIONS.stadium,
    delivery: LOCATIONS.concordMills,
    price: 355,
    note: 'Unique endpoints B',
  },
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function generatedPassword(): string {
  return `Dd!${randomBytes(18).toString('base64url')}8x`;
}

async function findAuthUserByEmail(
  admin: SupabaseClient<any, 'public', any>,
  email: string,
): Promise<User | null> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function ensureConfirmedUser(
  admin: SupabaseClient<any, 'public', any>,
  fixture: (typeof USERS)[keyof typeof USERS],
  password: string,
): Promise<User> {
  const metadata = {
    first_name: fixture.firstName,
    last_name: fixture.lastName,
    role: fixture.role,
    test_marker: TEST_MARKER,
  };
  const existing = await findAuthUserByEmail(admin, fixture.email);

  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
      })
    : await admin.auth.admin.createUser({
        email: fixture.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

  if (result.error || !result.data.user) {
    throw result.error ?? new Error(`Failed to create or update ${fixture.email}`);
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: result.data.user.id,
    email: fixture.email,
    first_name: fixture.firstName,
    last_name: fixture.lastName,
    role: fixture.role,
    is_verified: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  return result.data.user;
}

function point(location: LocationFixture): string {
  return `POINT(${location.longitude} ${location.latitude})`;
}

async function run(): Promise<void> {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const isProduction = projectRef === PRODUCTION_PROJECT_REF;

  console.log(`Target Supabase project: ${projectRef} (${isProduction ? 'PRODUCTION' : 'non-production'})`);
  if (isProduction && process.env['ALLOW_PRODUCTION_FRESH_TEST_SEED'] !== 'true') {
    throw new Error('Production seed blocked. Set ALLOW_PRODUCTION_FRESH_TEST_SEED=true for this explicit run.');
  }

  const admin = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clientPassword = process.env['FRESH_TEST_CLIENT_PASSWORD'] ?? generatedPassword();
  const driverPassword = process.env['FRESH_TEST_DRIVER_PASSWORD'] ?? generatedPassword();

  const client = await ensureConfirmedUser(admin, USERS.client, clientPassword);
  const driver = await ensureConfirmedUser(admin, USERS.driver, driverPassword);
  const now = new Date().toISOString();
  const rows = SHIPMENTS.map((shipment, index) => ({
    id: shipment.id,
    client_id: client.id,
    driver_id: driver.id,
    status: index % 2 === 0 ? 'accepted' : 'assigned',
    title: `${TEST_MARKER} ${shipment.vehicle.year} ${shipment.vehicle.make} ${shipment.vehicle.model}`,
    description: `${TEST_MARKER} ${shipment.note}. Deterministic route-optimization fixture.`,
    pickup_address: shipment.pickup.address,
    pickup_location: point(shipment.pickup),
    pickup_city: shipment.pickup.city,
    pickup_state: 'NC',
    pickup_zip: shipment.pickup.zip,
    delivery_address: shipment.delivery.address,
    delivery_location: point(shipment.delivery),
    delivery_city: shipment.delivery.city,
    delivery_state: 'NC',
    delivery_zip: shipment.delivery.zip,
    vehicle_year: shipment.vehicle.year,
    vehicle_make: shipment.vehicle.make,
    vehicle_model: shipment.vehicle.model,
    vehicle_type: shipment.vehicle.type,
    vehicle_count: 1,
    is_operable: true,
    estimated_price: shipment.price,
    final_price: shipment.price,
    terms_accepted: true,
    updated_by: client.id,
    updated_at: now,
  }));

  const { error: shipmentError } = await admin.from('shipments').upsert(rows, { onConflict: 'id' });
  if (shipmentError) throw shipmentError;

  const { data: saved, error: verifyError } = await admin
    .from('shipments')
    .select('id, title, status, pickup_address, delivery_address, client_id, driver_id')
    .in('id', SHIPMENTS.map(shipment => shipment.id))
    .order('id');
  if (verifyError) throw verifyError;
  if (saved?.length !== SHIPMENTS.length) {
    throw new Error(`Seed verification failed: expected ${SHIPMENTS.length} shipments, found ${saved?.length ?? 0}`);
  }

  console.log('\nFresh production test data ready:');
  console.log(`CLIENT: ${USERS.client.email} / ${clientPassword} (${client.id})`);
  console.log(`DRIVER: ${USERS.driver.email} / ${driverPassword} (${driver.id})`);
  console.log(`Confirmed and verified users: 2`);
  console.log(`Assigned shipments: ${saved.length}`);
  console.log(`Shared pickup: shipments 1 and 2 at ${LOCATIONS.uptown.address}`);
  console.log(`Shared delivery: shipments 3 and 4 at ${LOCATIONS.airport.address}`);
  console.table(saved.map(row => ({
    id: row.id,
    status: row.status,
    vehicle: String(row.title).replace(`${TEST_MARKER} `, ''),
    pickup: row.pickup_address,
    delivery: row.delivery_address,
  })));
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});