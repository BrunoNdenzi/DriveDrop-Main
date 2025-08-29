/**
 * Script to create predefined review users (Client, Driver, Admin)
 * Emails:
 *  - Client: reviewercustomer@example.com
 *  - Driver: reviewerdriver@example.com
 *  - Admin:  revieweradmin@example.com
 * Password (all): TestReviewer!
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31mError: Missing Supabase environment variables.\x1b[0m');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USERS = [
  { email: 'reviewercustomer@example.com', role: 'client', first_name: 'Review', last_name: 'Customer' },
  { email: 'reviewerdriver@example.com', role: 'driver', first_name: 'Review', last_name: 'Driver' },
  { email: 'revieweradmin@example.com', role: 'admin', first_name: 'Review', last_name: 'Admin' },
];

const PASSWORD = 'TestReviewer!';

async function ensureUser(u) {
  // Check if profile exists
  const { data: existing, error: queryError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', u.email)
    .limit(1);

  if (queryError) {
    console.warn('Warning querying profiles for', u.email, queryError.message);
  }

  if (existing && existing.length > 0) {
    console.log(`↺ Updating existing user role for ${u.email} -> ${u.role}`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: u.role, updated_at: new Date().toISOString() })
      .eq('email', u.email);
    if (updateError) {
      console.error('Failed to update profile for', u.email, updateError.message);
    }
    return; // assume auth user already exists
  }

  // Create auth user (prefer admin API)
  let authUserId;
  const { data: adminCreate, error: adminErr } = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: u.role, first_name: u.first_name, last_name: u.last_name },
  });

  if (adminErr) {
    console.warn('admin.createUser failed for', u.email, adminErr.message, '— falling back to signUp');
    const { data: signUpData, error: signErr } = await supabase.auth.signUp({
      email: u.email,
      password: PASSWORD,
      options: { data: { role: u.role, first_name: u.first_name, last_name: u.last_name } },
    });
    if (signErr || !signUpData.user) {
      console.error('Failed to create auth user for', u.email, signErr?.message);
      return;
    }
    authUserId = signUpData.user.id;
  } else if (adminCreate?.user) {
    authUserId = adminCreate.user.id;
  }

  if (!authUserId) {
    console.error('No auth user id for', u.email);
    return;
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authUserId,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    phone: null,
    avatar_url: null,
    is_verified: false,
    rating: null,
    created_at: now,
    updated_at: now,
  });

  if (profileError) {
    console.error('Profile upsert failed for', u.email, profileError.message);
  } else {
    console.log(`✔ Created review user ${u.email} (${u.role})`);
  }
}

(async () => {
  console.log('Creating review users...');
  for (const u of USERS) {
    try { await ensureUser(u); } catch (e) { console.error('Error with user', u.email, e); }
  }
  console.log('\nDone. Credentials:');
  USERS.forEach(u => console.log(`${u.role.toUpperCase()}: ${u.email} / ${PASSWORD}`));
})();
