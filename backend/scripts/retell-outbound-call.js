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
const CARRIERS = [
  // ── Add next batch below (uncomment or add new entries) ──────────────────
  // { phone: '+1XXXXXXXXXX', company: 'Company Name', city: 'City', state: 'NC' },
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
