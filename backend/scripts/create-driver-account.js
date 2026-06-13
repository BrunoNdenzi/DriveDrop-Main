/**
 * Create (or recreate) a driver account
 * ─────────────────────────────────────────────────────────────────
 * Usage:
 *   node scripts/create-driver-account.js
 *
 * What it does:
 *   1. Checks if the email already exists (auth + profile + applications)
 *   2. If found: deletes auth user, profile rows, and driver_applications
 *   3. Creates a fresh auth user with a known temporary password
 *   4. Prints the credentials clearly
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ── CONFIG ─────────────────────────────────────────────────────────
const EMAIL         = 'carlosnoel4000@gmail.com';   // <-- confirm this is correct (no space)
const FIRST_NAME    = 'Carlos';
const LAST_NAME     = 'Noel';
const PHONE         = '';                            // fill in if known
const TEMP_PASSWORD = 'DriveDrop2026!';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('\n──────────────────────────────────────────────────────');
  console.log('  Driver Account Tool');
  console.log(`  Email: ${EMAIL}`);
  console.log('──────────────────────────────────────────────────────\n');

  // ── STEP 1: Find existing auth user via SQL ────────────────────
  console.log('🔍  Checking for existing auth user...');

  // Query auth.users directly via service-role (bypasses row-level security)
  const { data: authUser, error: sqlErr } = await supabase
    .schema('auth')
    .from('users')
    .select('id, email')
    .ilike('email', EMAIL)
    .maybeSingle();

  let existingId = authUser?.id || null;

  if (sqlErr) {
    console.warn('   SQL lookup warning:', sqlErr.message);
    // Try exact match if ilike fails
    const { data: exact } = await supabase
      .schema('auth')
      .from('users')
      .select('id, email')
      .eq('email', EMAIL)
      .maybeSingle();
    existingId = exact?.id || null;
  }

  if (existingId) {
    console.log(`⚠️   Found existing auth user: ${existingId}`);
    console.log('🗑️   Deleting auth user...');

    const { error: delErr } = await supabase.auth.admin.deleteUser(existingId);
    if (delErr) {
      console.error('❌  Failed to delete auth user:', delErr.message);
      process.exit(1);
    }
    console.log('✅  Auth user deleted.');
  } else {
    console.log('ℹ️   No existing auth user found.');
  }

  // ── STEP 2: Clean up profile + driver_applications rows ────────
  console.log('\n🗑️   Cleaning up database rows...');

  const { error: delApp } = await supabase
    .from('driver_applications')
    .delete()
    .ilike('email', EMAIL);

  if (delApp) console.warn('   driver_applications cleanup:', delApp.message);
  else console.log('   ✓ driver_applications cleared');

  const { error: delProfile } = await supabase
    .from('profiles')
    .delete()
    .ilike('email', EMAIL);

  if (delProfile) console.warn('   profiles cleanup:', delProfile.message);
  else console.log('   ✓ profiles cleared');

  // ── STEP 3: Create fresh auth user ─────────────────────────────
  console.log('\n🆕  Creating fresh auth user...');

  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: FIRST_NAME,
      last_name:  LAST_NAME,
      phone:      PHONE || '',
      role:       'driver',
      force_password_change: true,
    }
  });

  if (createErr) {
    console.error('❌  Failed to create user:', createErr.message);
    process.exit(1);
  }

  const uid = newUser.user.id;
  console.log('✅  Auth user created:', uid);

  // ── STEP 4: Upsert profile ─────────────────────────────────────
  console.log('\n📄  Upserting profile...');

  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id:         uid,
      email:      EMAIL,
      first_name: FIRST_NAME,
      last_name:  LAST_NAME,
      phone:      PHONE || null,
      role:       'driver',
    }, { onConflict: 'id' });

  if (profileErr) console.warn('   Profile upsert warning:', profileErr.message);
  else console.log('   ✓ Profile saved');

  // ── DONE ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ✅  ACCOUNT READY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${TEMP_PASSWORD}`);
  console.log(`  User ID:  ${uid}`);
  console.log(`  Login at: https://drivedrop.us.com/login`);
  console.log('══════════════════════════════════════════════════════\n');
  console.log('⚠️   Driver will be prompted to change password on first login.');
  console.log('    Share credentials securely — do NOT send via email plaintext.\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
