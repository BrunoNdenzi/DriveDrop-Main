/**
 * Enrichment Progress Checker
 * ─────────────────────────────────────────────────────────────────
 * Run at any time to see the current state of carrier enrichment.
 *
 *   node scripts/check-enrichment-progress.js
 *
 * Pass --watch to poll every 30 seconds:
 *   node scripts/check-enrichment-progress.js --watch
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const WATCH = process.argv.includes('--watch');
const POLL_INTERVAL_MS = 30_000;

async function check() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Overall counts
  const [
    { count: total },
    { count: withEmail },
    { count: verified },
    { count: noEmail },
  ] = await Promise.all([
    sb.from('carrier_contacts').select('*', { count: 'exact', head: true }),
    sb.from('carrier_contacts').select('*', { count: 'exact', head: true }).not('email', 'is', null),
    sb.from('carrier_contacts').select('*', { count: 'exact', head: true }).eq('email_verified', true),
    sb.from('carrier_contacts').select('*', { count: 'exact', head: true }).is('email', null),
  ]);

  // Last 5 enriched records (most recently updated)
  const { data: recent } = await sb
    .from('carrier_contacts')
    .select('company_name, state, email, email_verified, enriched_at, updated_at')
    .not('enriched_at', 'is', null)
    .order('enriched_at', { ascending: false })
    .limit(5);

  // Per-state breakdown for NC/SC
  const { data: byState } = await sb
    .from('carrier_contacts')
    .select('state, email')
    .in('state', ['NC', 'SC']);

  const stateStats = {};
  for (const r of (byState || [])) {
    const s = r.state || 'unknown';
    stateStats[s] = stateStats[s] || { total: 0, withEmail: 0 };
    stateStats[s].total++;
    if (r.email) stateStats[s].withEmail++;
  }

  // How recently was anything enriched?
  const { data: lastEnriched } = await sb
    .from('carrier_contacts')
    .select('enriched_at')
    .not('enriched_at', 'is', null)
    .order('enriched_at', { ascending: false })
    .limit(1)
    .single();

  const lastTime = lastEnriched?.enriched_at
    ? new Date(lastEnriched.enriched_at)
    : null;

  const minutesAgo = lastTime
    ? Math.round((Date.now() - lastTime.getTime()) / 60_000)
    : null;

  // Is enrichment likely still running? (last activity < 5 min ago)
  const likelyRunning = minutesAgo !== null && minutesAgo < 5;
  const hitRate = total > 0 ? Math.round((withEmail / total) * 100) : 0;

  const ts = new Date().toLocaleTimeString();
  console.clear();
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Enrichment Progress  [${ts}]`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Total in DB          : ${total}`);
  console.log(` With email found     : ${withEmail}  (${hitRate}% hit rate)`);
  console.log(` Email verified       : ${verified}`);
  console.log(` No email (pending/failed): ${noEmail}`);
  console.log('');

  if (stateStats['NC'] || stateStats['SC']) {
    console.log(' By state:');
    for (const [state, s] of Object.entries(stateStats)) {
      const pct = s.total > 0 ? Math.round((s.withEmail / s.total) * 100) : 0;
      console.log(`   ${state}  ${s.withEmail}/${s.total} with email  (${pct}%)`);
    }
    console.log('');
  }

  if (lastTime) {
    console.log(` Last enrichment      : ${lastTime.toLocaleString()}  (${minutesAgo}m ago)`);
    console.log(` Status               : ${likelyRunning ? '⚡ RUNNING NOW' : noEmail > 0 ? '⏸  Done (or paused) — API quota may be exhausted' : '✅ Complete'}`);
  } else {
    console.log(' Status               : ⏳ No enrichments completed yet');
  }

  console.log('');

  if (recent && recent.length > 0) {
    console.log(' 5 most recently enriched:');
    for (const r of recent) {
      const t = r.enriched_at ? new Date(r.enriched_at).toLocaleTimeString() : '—';
      const emailStr = r.email ? `✉  ${r.email}` : '   (no email found)';
      console.log(`   [${t}] ${(r.company_name || '').padEnd(40)} ${emailStr}`);
    }
  }

  console.log('');

  if (noEmail === total && total > 0) {
    console.log('⚠️  All records have no email.');
    console.log('   Likely causes:');
    console.log('   1. API quota exhausted (Apollo/Snov/Hunter) — check your API dashboards');
    console.log('   2. Enrichment was interrupted before completing');
    console.log('   3. Run: node scripts/import-fmcsa-carolina.js  to queue next batch');
    console.log('');
    console.log('   Quick API quota check:');
    console.log('   - Apollo: https://app.apollo.io/#/settings/billing');
    console.log('   - Snov.io: https://app.snov.io/account/billing');
    console.log('   - Hunter: https://hunter.io/users/billing');
  } else if (withEmail > 0) {
    console.log(`✅ Ready to campaign: ${withEmail} contacts with email`);
    console.log('   Run: node scripts/launch-carolina-campaign.js');
  }

  console.log('═══════════════════════════════════════════════════════════');
  if (WATCH) console.log(` Refreshing every ${POLL_INTERVAL_MS / 1000}s — Ctrl+C to stop\n`);
}

check().catch(console.error);
if (WATCH) setInterval(() => check().catch(console.error), POLL_INTERVAL_MS);
