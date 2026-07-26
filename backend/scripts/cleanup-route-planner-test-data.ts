import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TEST_EMAIL = 'routeplanner-test-driver@drivedrop.dev';
const TEST_MARKER = '[TEST][ROUTE_PLANNER]';
const SHIPMENT_IDS = [
  '7a110001-25c0-4a11-9000-000000000001',
  '7a110002-25c0-4a11-9000-000000000002',
  '7a110003-25c0-4a11-9000-000000000003',
];

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
  const admin = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authUser = await findAuthUserByEmail(admin);
  const driverId = authUser?.id;

  const { data: shipments, error: findError } = await admin
    .from('shipments')
    .select('id, title, driver_id')
    .in('id', SHIPMENT_IDS);
  if (findError) throw findError;

  const unexpected = (shipments ?? []).filter(row =>
    !String(row.title).startsWith(TEST_MARKER) || (driverId && row.driver_id !== driverId)
  );
  if (unexpected.length > 0) {
    throw new Error(`Cleanup refused: ${unexpected.length} deterministic shipment ID(s) do not match the test marker/driver`);
  }

  if (process.argv.includes('--dry-run')) {
    console.log(`Would remove ${shipments?.length ?? 0} marked route-planner shipment(s).`);
    console.log(driverId ? `Would remove test driver ${TEST_EMAIL} (${driverId}) and its Benji sessions.` : 'Test driver is already absent.');
    return;
  }

  const { error: shipmentError, count } = await admin
    .from('shipments')
    .delete({ count: 'exact' })
    .in('id', SHIPMENT_IDS)
    .like('title', `${TEST_MARKER}%`);
  if (shipmentError) throw shipmentError;

  if (driverId) {
    const { error: sessionError } = await admin
      .from('benji_sessions')
      .delete()
      .eq('user_id', driverId);
    if (sessionError) throw sessionError;

    const { error: profileError } = await admin
      .from('profiles')
      .delete()
      .eq('id', driverId)
      .eq('email', TEST_EMAIL);
    if (profileError) throw profileError;

    const { error: authError } = await admin.auth.admin.deleteUser(driverId);
    if (authError) throw authError;
  }

  console.log(`Removed ${count ?? 0} marked route-planner shipment(s).`);
  console.log(driverId ? `Removed test driver ${TEST_EMAIL} (${driverId}).` : 'Test driver was already absent.');
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});