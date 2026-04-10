/**
 * Retell AI — outbound carrier recruitment calls.
 *
 * Run:  node backend/scripts/retell-outbound-call.js
 *
 * Prerequisites (all in backend/.env):
 *   RETELL_API_KEY    — from dashboard.retellai.com → API Keys
 *   RETELL_AGENT_ID   — output by setup-retell-agent.js
 *   RETELL_PHONE_NUMBER  — the Twilio number you imported into Retell (+E.164)
 *
 * Behavior:
 *   - Rotates 3 opening lines across calls so Alex doesn't sound identical every time
 *   - Injects {{company_name}} as a dynamic variable so Alex knows who he's calling
 *   - Stops immediately (with clear resume instruction) if Retell returns a rate-limit error
 *   - Logs each call ID next to the carrier so it's easy to find in the dashboard
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const RETELL_API_KEY   = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID  = process.env.RETELL_AGENT_ID;
const FROM_NUMBER      = process.env.RETELL_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';

if (!RETELL_API_KEY)  { console.error('❌  RETELL_API_KEY missing from backend/.env'); process.exit(1); }
if (!RETELL_AGENT_ID) { console.error('❌  RETELL_AGENT_ID missing — run setup-retell-agent.js first'); process.exit(1); }
if (!FROM_NUMBER)     { console.error('❌  RETELL_PHONE_NUMBER (or TWILIO_PHONE_NUMBER) missing from backend/.env'); process.exit(1); }

// ── Carrier list — add numbers here, comment out after calling ───────────────
// FIRST TIME: Put YOUR OWN number in as "TEST" to hear what Alex sounds like.
// Then add real carriers and remove the test entry.
const CARRIERS = [
  // ── 🧪  TEST — replace with your own number first to verify Alex ─────────
  // { phone: '+1YOUR_NUMBER', company: 'Test Run', city: 'Charlotte', state: 'NC' },

  // ── Round 1 — Retell batch (April 2026) ──────────────────────────────────
  { phone: '+17042343800', company: 'National Auto Transport', city: 'Charlotte',    state: 'NC' },
  { phone: '+17045593000', company: 'Charlotte Motor Lines',   city: 'Charlotte',    state: 'NC' },
  { phone: '+13363795151', company: 'Greensboro Transport Co', city: 'Greensboro',   state: 'NC' },
  { phone: '+19194624444', company: 'Triangle Auto Movers',    city: 'Raleigh',      state: 'NC' },
  { phone: '+18284855100', company: 'Mountain State Haulers',  city: 'Asheville',    state: 'NC' },
  { phone: '+17043370000', company: 'Speed Auto Transport',    city: 'Charlotte',    state: 'NC' },
  { phone: '+19103237000', company: 'Cape Fear Car Carriers',  city: 'Wilmington',   state: 'NC' },
  { phone: '+13362855500', company: 'Triad Auto Logistics',    city: 'High Point',   state: 'NC' },
  { phone: '+17048482200', company: 'Piedmont Carrier Group',  city: 'Concord',      state: 'NC' },
  { phone: '+17043490000', company: 'Crossroads Auto Transfer',city: 'Gastonia',     state: 'NC' },

  // ── Archived — Round 1 (Vapi, April 8) ───────────────────────────────────
  // { phone: '+17045551001', company: 'Carolina Auto Transport', ... } // call_id: ca_xxx
  // { phone: '+17045551002', company: 'Piedmont Vehicle Transport', ... }
  // { phone: '+17045551003', company: 'Southern Auto Carriers', ... }
  // { phone: '+17045551004', company: 'Queen City Auto Movers', ... }
  // { phone: '+17045551005', company: 'Elite Car Carriers', ... }
  // { phone: '+17045551006', company: 'Freedom Transport Group', ... }

  // ── Archived — Round 2 (Vapi, April 9) ───────────────────────────────────
  // { phone: '+13365551007', company: 'Triad Logistics Solutions', ... }
  // { phone: '+17045551008', company: 'Southeast Hauling Services', ... }
  // { phone: '+17045551009', company: 'Carolinas Auto Shippers', ... }
  // { phone: '+17045551010', company: 'Benchmark Transport', ... }
  // { phone: '+17045551011', company: 'Lakeside Auto Carriers', ... }
  // { phone: '+18285551012', company: 'Blue Ridge Transport', ... }
  // { phone: '+17045551013', company: 'Midland Vehicle Logistics', ... }
  // { phone: '+18035551014', company: 'York County Auto Movers', ... }
  // { phone: '+17045551015', company: 'Cardinal Transport Solutions', ... }
];

// ── Opening line rotation (3 openers → cycles 1→2→3→1→2→3...) ───────────────
const OPENERS = [
  'Hey — quick question. Do you guys run auto transport at all?',
  'Hi — am I catching you at a bad time? Real quick: do you move vehicles?',
  'Hey, this is Alex with DriveDrop out of Charlotte — do you haul cars?',
];
let _openerIdx = 0;

// ── Retell API helper ─────────────────────────────────────────────────────────
async function retell(path, method, body) {
  const res = await fetch(`https://api.retellai.com${path}`, {
    method,
    headers: {
      Authorization:   `Bearer ${RETELL_API_KEY}`,
      'Content-Type':  'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Retell ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
    // Flag rate-limit / concurrency errors so the batch loop can stop cleanly
    const msg = (typeof data?.message === 'string' ? data.message : '').toLowerCase();
    if (
      res.status === 429 ||
      msg.includes('rate limit') ||
      msg.includes('concurrency') ||
      msg.includes('limit reached') ||
      msg.includes('too many')
    ) {
      err.isRateLimit = true;
    }
    throw err;
  }
  return data;
}

// ── Fire a single outbound call ───────────────────────────────────────────────
async function callOne({ phone, company, city, state }) {
  const opening_line = OPENERS[_openerIdx++ % OPENERS.length];
  console.log(`\n📞  Calling ${phone} (${company}, ${city} ${state})...`);

  const call = await retell('/v2/create-phone-call', 'POST', {
    from_number:       FROM_NUMBER,
    to_number:         phone,
    override_agent_id: RETELL_AGENT_ID,
    // Inject per-call variables into the LLM prompt ({{opening_line}}, {{company_name}})
    retell_llm_dynamic_variables: {
      opening_line,
      company_name: company,
    },
    metadata: {
      campaign:     'carrier_recruitment',
      company_name: company,
      city,
      state,
    },
  });

  console.log(`   ✅  Initiated — Call ID: ${call.call_id}`);
  console.log(`       From: ${FROM_NUMBER}  To: ${phone}`);
  return call.call_id;
}

// ── Main batch runner ─────────────────────────────────────────────────────────
async function main() {
  if (CARRIERS.length === 0) {
    console.log('📋  No carriers to call — add numbers to the CARRIERS array in this file.');
    console.log('    Previous rounds are commented out above each entry.');
    process.exit(0);
  }

  console.log(`\n🚀  Retell outbound — firing ${CARRIERS.length} carrier call(s)`);
  console.log(`   Agent  : ${RETELL_AGENT_ID}`);
  console.log(`   Webhook: ${API_URL}/api/v1/retell/tools`);
  console.log(`   From   : ${FROM_NUMBER}\n`);

  let ok = 0, failed = 0;

  for (let i = 0; i < CARRIERS.length; i++) {
    const target = CARRIERS[i];
    try {
      await callOne(target);
      ok++;
    } catch (err) {
      // ── Rate limit / concurrency cap — stop and tell user where to resume ──
      if (err.isRateLimit) {
        console.error(`\n⛔  Retell rate limit hit after ${ok} call(s).`);
        console.error(`   Stopped at: ${target.phone} (${target.company})`);
        console.error(`\n   ➜  Wait a moment then re-run. The calls that already`);
        console.error(`      fired are commented out above each entry in CARRIERS.`);
        console.error(`   ➜  To increase limits: upgrade at dashboard.retellai.com`);
        console.error(`\n📋  ${ok} calls initiated before limit hit.`);
        process.exit(0);
      }
      console.error(`   ❌  Failed (${target.company}): ${err.message}`);
      failed++;
    }

    // 2s gap between calls
    if (i < CARRIERS.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n📋  Done — ${ok} initiated, ${failed} failed.`);
  console.log(`   Retell dashboard → Call History for transcripts.`);
  console.log(`   Supabase → carrier_leads table for saved leads.`);
  console.log(`   Supabase → carrier_call_logs table for outcomes.`);
}

main().catch(err => {
  console.error('❌  Fatal error:', err.message);
  process.exit(1);
});
