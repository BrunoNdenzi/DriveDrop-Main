/**
 * Carolina Carrier Campaign Launcher
 * ─────────────────────────────────────────────────────────────────
 * Creates a production-ready Carolina outreach campaign and starts it.
 *
 * Run AFTER import-fmcsa-carolina.js has populated carrier_contacts.
 *
 * Usage:
 *   node scripts/launch-carolina-campaign.js
 *
 * Set OUTREACH_WARMUP=false in .env before running for real sends.
 * Keep OUTREACH_DAILY_LIMIT low (10-20) for the first week.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const API_BASE = process.env.API_URL ? `${process.env.API_URL}/api/v1` : `http://localhost:${process.env.PORT || 3001}/api/v1`;
const ADMIN_EMAIL = 'infos@calkons.com';
const ADMIN_PASSWORD = 'TestAdmin2026!';
const WARMUP = process.env.OUTREACH_WARMUP !== 'false';

async function getToken() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data?.session?.access_token) throw new Error('Login failed: ' + error?.message);
  return data.session.access_token;
}

async function api(method, path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body && { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json?.data ?? json;
}

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Carolina Carrier Campaign Launcher');
  console.log(`  Warmup mode : ${WARMUP ? 'ON (dry-run — no real sends)' : 'OFF (LIVE SENDS)'}`);
  console.log(`  Daily limit : ${process.env.OUTREACH_DAILY_LIMIT || 10} emails/day`);
  console.log('═══════════════════════════════════════════════════\n');

  if (!WARMUP) {
    console.log('⚠️  LIVE SEND MODE — emails will be delivered to real carriers.\n');
  }

  const token = await getToken();
  console.log('✅ Authenticated\n');

  // 1 — Check how many enriched Carolina contacts are ready
  const ncList = await api('GET', '/carriers?state=NC&hasEmail=true&limit=1', null, token);
  const scList = await api('GET', '/carriers?state=SC&hasEmail=true&limit=1', null, token);
  const ncCount = ncList.total ?? 0;
  const scCount = scList.total ?? 0;
  const total = ncCount + scCount;

  console.log(`📊 Carrier contacts with email ready:`);
  console.log(`   NC: ${ncCount}`);
  console.log(`   SC: ${scCount}`);
  console.log(`   Total: ${total}\n`);

  if (total === 0) {
    console.error('❌ No enriched Carolina contacts found.');
    console.error('   Run import-fmcsa-carolina.js first and wait for enrichment to complete.');
    process.exit(1);
  }

  // 2 — Create the campaign
  console.log('📧 Creating campaign…');
  const campaign = await api('POST', '/campaigns', {
    name: `Carolina Carrier Outreach — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    subject: 'New shipment loads available in {{state}} – DriveDrop',
    template: 'introduction',
    targetAudience: {
      states: ['NC', 'SC'],
      emailVerified: false,   // include all — verified + unverified
    },
    dailyLimit: parseInt(process.env.OUTREACH_DAILY_LIMIT || '10', 10),
    tags: ['carolina', 'carrier-outreach', 'phase-1'],
    notes: 'Phase 1 — Carolina carrier acquisition. Targeting NC/SC FMCSA-registered carriers.',
  }, token);

  console.log(`   ✅ Campaign created: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Daily limit: ${campaign.dailyLimit}\n`);

  // 3 — Start the campaign
  console.log('🚀 Starting campaign…');
  const started = await api('POST', `/campaigns/${campaign.id}/start`, null, token);
  console.log(`   Status: ${started.status}`);

  // 4 — Fetch stats
  await new Promise(r => setTimeout(r, 1000));
  const stats = await api('GET', `/campaigns/${campaign.id}`, null, token);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(' Campaign launch summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(` Campaign ID    : ${stats.id || campaign.id}`);
  console.log(` Status         : ${stats.status || 'sending'}`);
  console.log(` Total recipients queued: ${stats.totalRecipients ?? '(counting…)'}`);
  console.log(` Daily limit    : ${stats.dailyLimit ?? campaign.dailyLimit} emails/day`);
  console.log(` Warmup mode    : ${WARMUP ? 'ON — no real sends until OUTREACH_WARMUP=false' : 'OFF — live ✉️'}`);
  console.log('');
  console.log(' Monitor at: GET /api/v1/campaigns/' + (stats.id || campaign.id));
  console.log('═══════════════════════════════════════════════════\n');
})();
