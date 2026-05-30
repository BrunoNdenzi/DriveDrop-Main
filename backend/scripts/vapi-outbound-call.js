/**
 * Vapi — outbound carrier recruitment calls (production batch script).
 *
 * Run:
 *   node backend/scripts/vapi-outbound-call.js
 *
 * Prerequisites (all in backend/.env):
 *   VAPI_API_KEY          — from dashboard.vapi.ai → API Keys
 *   VAPI_PHONE_NUMBER_ID  — from dashboard.vapi.ai → Phone Numbers (your 704 number)
 *   VAPI_ASSISTANT_ID     — output by vapi-setup-assistant.js
 *
 * What this script does:
 *   - Rotates 3 opening lines across calls so Alex doesn't sound identical every time
 *   - Injects {{opening_line}} and {{company_name}} as dynamic variables per call
 *   - Stops immediately when Vapi's daily outbound limit is hit, with resume instructions
 *   - Logs each call ID next to the carrier for easy lookup in the dashboard
 *   - If VAPI_ASSISTANT_ID is not set, falls back to inline assistant config
 *
 * Vapi dashboard: https://dashboard.vapi.ai/calls
 * After calls: Supabase → carrier_leads, carrier_call_logs, voice_call_logs for results
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID;
const ASSISTANT_ID     = process.env.VAPI_ASSISTANT_ID;     // set by vapi-setup-assistant.js
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL       = `${API_URL}/api/v1/voice/webhook`;

if (!VAPI_API_KEY)    { console.error('❌  VAPI_API_KEY missing from backend/.env'); process.exit(1); }
if (!PHONE_NUMBER_ID) { console.error('❌  VAPI_PHONE_NUMBER_ID missing — get it from dashboard.vapi.ai → Phone Numbers'); process.exit(1); }

if (!ASSISTANT_ID) {
  console.warn('⚠️   VAPI_ASSISTANT_ID not set — using inline assistant config (run vapi-setup-assistant.js first for dashboard visibility)');
}

// ── Carrier list ─────────────────────────────────────────────────────────────
// INSTRUCTIONS:
//   1. First uncomment your own number as "TEST" to hear Alex live before calling carriers.
//   2. Comment out each entry after it's called (add its call_id as a comment).
//   3. When Vapi daily limit is hit, the script stops and tells you where to resume.

const CARRIERS = [
  // ── 🧪  TEST — replace with your own number first ──────────────────────
  // { phone: '+1YOUR_NUMBER', company: 'Test Run', city: 'Charlotte', state: 'NC' },

  // ── Round 5 — Vapi batch (April 22 2026) ────────────────────────────
  { phone: '+13362290000', company: 'Burlington Auto Carriers',    city: 'Burlington',    state: 'NC' },
  { phone: '+13368700000', company: 'Alamance Vehicle Transport',  city: 'Graham',        state: 'NC' },
  { phone: '+19197820000', company: 'Wake Transport Solutions',    city: 'Raleigh',       state: 'NC' },
  { phone: '+19198330000', company: 'Capital City Auto Haulers',   city: 'Raleigh',       state: 'NC' },
  { phone: '+19198780000', company: 'Cary Vehicle Logistics',      city: 'Cary',          state: 'NC' },
  { phone: '+19198430000', company: 'Garner Auto Freight LLC',     city: 'Garner',        state: 'NC' },
  { phone: '+19196504400', company: 'Triangle Car Carriers',       city: 'Chapel Hill',   state: 'NC' },
  { phone: '+19198050000', company: 'Apex Transport Group',        city: 'Apex',          state: 'NC' },
  { phone: '+19104550000', company: 'Fayetteville Motor Freight',  city: 'Fayetteville',  state: 'NC' },
  { phone: '+19103230000', company: 'Wilmington Vehicle Movers',   city: 'Wilmington',    state: 'NC' },
  { phone: '+12523550000', company: 'Greenville Auto Transport',   city: 'Greenville',    state: 'NC' },
  { phone: '+12527530000', company: 'Rocky Mount Car Carriers',    city: 'Rocky Mount',   state: 'NC' },
  { phone: '+19196735500', company: 'Wilson County Auto Haulers',  city: 'Wilson',        state: 'NC' },
  { phone: '+19108930000', company: 'Jacksonville Transport LLC',  city: 'Jacksonville',  state: 'NC' },
  { phone: '+17049220000', company: 'Shelby Auto Logistics',       city: 'Shelby',        state: 'NC' },

  // ── Round 1 — Vapi batch (April 2026) ────────────────────────────────
  { phone: '+17044210000', company: 'Pro Auto Transport NC',     city: 'Charlotte',   state: 'NC' },
  { phone: '+17045190000', company: 'Direct Drive Logistics',    city: 'Charlotte',   state: 'NC' },
  { phone: '+17048360000', company: 'Southeastern Car Carriers', city: 'Gastonia',    state: 'NC' },
  { phone: '+18033180000', company: 'Carolina Transport Hub',    city: 'Rock Hill',   state: 'SC' },
  { phone: '+19197240000', company: 'Apex Auto Haulers',         city: 'Apex',        state: 'NC' },
  { phone: '+13362880000', company: 'Guilford Carrier Group',    city: 'Greensboro',  state: 'NC' },
  { phone: '+17049870000', company: 'Steele Creek Shipping',     city: 'Charlotte',   state: 'NC' },
  { phone: '+18287540000', company: 'Western NC Auto Movers',    city: 'Hickory',     state: 'NC' },
  { phone: '+19107750000', company: 'Coastal Auto Logistics',    city: 'Wilmington',  state: 'NC' },
  { phone: '+17045260000', company: 'NoDa Vehicle Transport',    city: 'Charlotte',   state: 'NC' },

  // ── Archived — Vapi Round 1 (April 8 2026, test-outbound-call.js) ────
  // { phone: '+17043752200', company: 'Carolina Auto Transport LLC',  ... } // 019d6e9c-6f9b
  // { phone: '+17047824100', company: 'Piedmont Vehicle Carriers',    ... } // 019d6e9c-812e
  // { phone: '+17048537700', company: 'Southern Auto Haulers Inc',    ... } // 019d6e9c-9276
  // { phone: '+17045963300', company: 'Queen City Transport Group',   ... } // 019d6e9c-a3ff
  // { phone: '+17047995500', company: 'Elite Car Carriers LLC',       ... } // 019d6e9c-b54e
  // { phone: '+17042894400', company: 'Freedom Transport Solutions',  ... } // 019d6e9c-ca87
  // ── Archived — Vapi Round 2 (April 9 2026, test-outbound-call.js) ─────
  // { phone: '+13368826600', company: 'Triad Vehicle Logistics',      ... } // 019d7335-a311
  // { phone: '+18033297100', company: 'Southeast Hauling Co',         ... } // 019d7335-b656
  // { phone: '+17049332800', company: 'Carolinas Auto Movers',        ... } // 019d7335-c9ef
  // { phone: '+17049483900', company: 'Benchmark Car Transport',      ... } // 019d7335-dd78
  // { phone: '+17048925200', company: 'Lakeside Auto Carriers',       ... } // 019d7335-ef10
  // { phone: '+17048714600', company: 'Blue Ridge Transport LLC',     ... } // 019d7336-0d8f
  // { phone: '+17048883100', company: 'Midland Vehicle Shippers',     ... } // 019d7336-28d5
  // { phone: '+18035476200', company: 'York County Auto Haulers',     ... } // 019d7336-3d57
  // { phone: '+17046338800', company: 'Cardinal Transport Services',  ... } // 019d7336-4f70
];

// ── Opening line rotation ─────────────────────────────────────────────────────
const OPENERS = [
  "Hey — quick question. Do you guys run auto transport at all?",
  "Hi — am I catching you at a bad time? Real quick: do you move vehicles?",
  "Hey, this is Alex with DriveDrop out of Charlotte — do you haul cars?",
];
let _openerIdx = 0;

// ── Carrier tools (used only in inline fallback mode) ─────────────────────────
const CARRIER_TOOLS = [
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'save_carrier_lead',
      description: "Save carrier contact info. Call ONLY after the carrier verbally confirms the email read-back is correct. After this tool succeeds, speak the closing line, then call log_carrier_call_outcome, then endCall.",
      parameters: {
        type: 'object',
        required: ['carrier_phone'],
        properties: {
          carrier_phone:  { type: 'string' },
          carrier_email:  { type: 'string' },
          contact_name:   { type: 'string' },
          company_name:   { type: 'string' },
          fleet_size:     { type: 'number' },
          states_served:  { type: 'string' },
          vehicle_types:  { type: 'string' },
          interest_level: { type: 'string', enum: ['hot', 'warm', 'cold'] },
          notes:          { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'send_sms_link',
      description: 'Send the carrier an SMS with the sign-up link. Only when they ask for text instead of email.',
      parameters: {
        type: 'object',
        required: ['to_phone', 'link_type'],
        properties: {
          to_phone:  { type: 'string' },
          link_type: { type: 'string', enum: ['signup'] },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'log_carrier_call_outcome',
      description: 'Log the outcome of this call. Call at the END after your goodbye line. Never mid-conversation.',
      parameters: {
        type: 'object',
        required: ['carrier_phone', 'outcome'],
        properties: {
          carrier_phone: { type: 'string' },
          outcome:       { type: 'string', enum: ['interested', 'not_interested', 'callback_requested', 'no_answer', 'voicemail', 'sent_link'] },
          notes:         { type: 'string' },
          callback_date: { type: 'string' },
          fleet_size:    { type: 'number' },
          states_served: { type: 'string' },
        },
      },
    },
  },
];

// Alex's full prompt (same as vapi-setup-assistant.js — used in inline fallback mode)
const CARRIER_PROMPT = `
You are Alex — a recruiter at DriveDrop, a vehicle transport marketplace based in Charlotte, NC.

Who you are
You know trucking. You understand carriers have been squeezed by brokers for years — slow payments, hidden rate cuts, zero transparency. DriveDrop actually fixes that, and you genuinely believe it. You're not calling to pitch. You're calling to let the right carriers know this exists. Your tone is direct but relaxed — the way you'd talk to someone at a truck stop. No jargon, no corporate script. You say "yeah", "totally", "got it", "makes sense". You use contractions. You keep turns short — one thought, then you stop and listen. If they interrupt you, you stop immediately. If there's silence after your question, you wait without filling it.

CRITICAL RULES — always active:
1. DETECT AUTOMATED SYSTEMS: If the line answers with an IVR or AI — scripted phrases like "press 1", "I'd be happy to help", "please hold":
   → Say: "Looks like I've hit an automated system — I'll try back. Have a good one." Call log_carrier_call_outcome with outcome='no_answer' and end the call.
2. IF ASKED "Are you AI?": Never deny it. Redirect: "I'm Alex — here to connect carriers with loads. About that email — what's the best one to use?"
3. TOOL TIMING: save_carrier_lead ONLY after confirmed email read-back. log_carrier_call_outcome ONLY at the very end.
4. IF CONFUSED/RUSHING: "Sorry — let me back up. I'm Alex with DriveDrop. We connect carriers directly with shippers — no broker."

When they confirm they haul: "Got it. We've got direct shipper loads — no broker in the middle — and payment's guaranteed before pickup." Then wait.

Objection responses:
- "Sounds like a broker" → "Fair one — no. Shippers post directly to the platform, you see the full rate they're paying. No markup."
- "We already have loads" → "Totally — most carriers just add us for lanes their broker doesn't cover."
- "What's the catch?" → "No catch — free to join, zero platform fee for 90 days, then small per-job fee only on completed loads."
- "Not interested." → "Totally fine — appreciate your time. Have a good one." → log(not_interested) → endCall
- "Send info." → "For sure — what email should I send it to?"

Qualifying question (pick one, ask once):
  "What lanes are you mainly running?" OR "How many trucks you got?" OR "Mostly open or enclosed?"

Getting the email: "Perfect — what's the best email to send you the loads on those lanes and the sign-up link?"

EMAIL CAPTURE — 6 steps, no skipping:
1. Spell it back letter by letter: "Let me read that back — [LETTERS] at [DOMAIN] dot com. That right?"
2. Wait for verbal confirmation (yes/right/correct/yep/uh-huh).
3. Call save_carrier_lead with confirmed email + collected details.
4. ONLY after save returns: "Perfect — appreciate it. I'll send that over now. Stay safe out there."
5. Call log_carrier_call_outcome with outcome='interested'.
6. Call endCall. Done.

Voicemail: "Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, free for the first 90 days. Give us a call back at 704-937-5246 or check drivedrop.us.com. Have a good one." → log(voicemail)

Callback: "Got it — when's a better time? I'll make a note." → log(callback_requested) → endCall
`.trim();

// ── Vapi API helper ───────────────────────────────────────────────────────────
async function vapi(path, method, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Vapi ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
    // Flag daily limit so the batch loop can stop cleanly
    const msg = typeof data?.message === 'string' ? data.message : '';
    if (
      res.status === 429 ||
      msg.includes('Daily Outbound Call Limit') ||
      msg.toLowerCase().includes('limit reached') ||
      msg.toLowerCase().includes('too many')
    ) {
      err.isDailyLimit = true;
    }
    throw err;
  }
  return data;
}

// ── Fire a single outbound call ───────────────────────────────────────────────
async function callOne({ phone, company, city, state }) {
  const firstMessage = OPENERS[_openerIdx++ % OPENERS.length];
  console.log(`\n📞  Calling ${phone}  (${company}, ${city} ${state})`);
  console.log(`    Opener: "${firstMessage}"`);

  const callPayload = {
    phoneNumberId: PHONE_NUMBER_ID,
    customer:      { number: phone, name: company },
    metadata:      { campaign: 'carrier_recruitment', company_name: company, city, state, platform: 'vapi' },
  };

  if (ASSISTANT_ID) {
    // ── Mode A: use persistent assistant, override firstMessage per call ──
    callPayload.assistantId = ASSISTANT_ID;
    callPayload.assistantOverrides = {
      firstMessage,
      variableValues: { company_name: company },   // available as {{company_name}} in prompt
    };
  } else {
    // ── Mode B: inline assistant config (fallback if no VAPI_ASSISTANT_ID) ─
    callPayload.assistant = {
      name:  'Alex',
      voice: {
        provider:        '11labs',
        voiceId:         'pNInz6obpgDQGcFmaJgB', // Adam
        stability:       0.70,
        similarityBoost: 0.75,
        style:           0.10,
        speed:           0.82,
        useSpeakerBoost: false,
      },
      model: {
        provider:    'groq',
        model:       'llama-3.3-70b-versatile',
        temperature: 0.45,
        messages:    [{ role: 'system', content: CARRIER_PROMPT }],
        tools:       CARRIER_TOOLS,
      },
      transcriber: {
        provider:    'deepgram',
        model:       'nova-2',
        language:    'en-US',
        smartFormat: true,
      },
      firstMessageMode:             'assistant-speaks-first',
      firstMessage,
      serverUrl:                    SERVER_URL,
      endCallFunctionEnabled:       true,
      recordingEnabled:             true,
      maxDurationSeconds:           300,
      backchannelingEnabled:        true,
      responseDelaySeconds:         0.5,
      numWordsToInterruptAssistant: 2,
      backgroundSound:              'office',
      silenceTimeoutSeconds:        35,
      messagePlan: {
        idleMessages:              ['You with me?'],
        idleMessageMaxSpokenCount: 1,
        idleTimeoutSeconds:        20,
      },
      voicemailDetection: {
        provider:                'twilio',
        enabled:                 true,
        voicemailDetectionTypes: ['machine_end_beep', 'machine_end_silence'],
      },
    };
  }

  const call = await vapi('/call', 'POST', callPayload);

  console.log(`    ✅  Initiated — Call ID: ${call.id}`);
  console.log(`       Mode: ${ASSISTANT_ID ? 'persistent assistant' : 'inline config'}`);
  return call.id;
}

// ── Main batch runner ─────────────────────────────────────────────────────────
async function main() {
  if (CARRIERS.length === 0) {
    console.log('📋  No carriers to call — add numbers to the CARRIERS array in this file.');
    process.exit(0);
  }

  console.log(`\n🚀  Vapi outbound — firing ${CARRIERS.length} carrier call(s)`);
  console.log(`   Phone#  : ${PHONE_NUMBER_ID}`);
  console.log(`   Assistant: ${ASSISTANT_ID || '(inline per-call config)'}`);
  console.log(`   Webhook : ${SERVER_URL}\n`);

  let ok = 0, failed = 0;

  for (let i = 0; i < CARRIERS.length; i++) {
    const target = CARRIERS[i];
    try {
      await callOne(target);
      ok++;
    } catch (err) {
      // ── Daily limit — stop cleanly with clear resume instructions ────────
      if (err.isDailyLimit) {
        console.error(`\n⛔  Vapi daily outbound limit hit after ${ok} call(s).`);
        console.error(`   Stopped at: ${target.phone} (${target.company})`);
        console.error(`\n   ➜  Comment out the first ${ok} carrier(s) in the CARRIERS array above.`);
        console.error(`   ➜  Re-run tomorrow — the already-fired entries are stamped with call IDs above.`);
        console.error(`   ➜  To increase your daily limit: upgrade at dashboard.vapi.ai → Billing`);
        console.error(`       OR import your Twilio number directly into Vapi (removes the limit).`);
        console.error(`\n📋  ${ok} calls initiated before limit was hit.`);
        process.exit(0);
      }
      console.error(`   ❌  Failed (${target.company}): ${err.message}`);
      failed++;
    }

    // 3s gap between calls — gives each call time to connect before next fires
    if (i < CARRIERS.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n📋  Done — ${ok} initiated, ${failed} failed.`);
  console.log('');
  console.log('   📊  Check results:');
  console.log('   → Vapi dashboard  : https://dashboard.vapi.ai/calls');
  console.log('   → Carrier leads   : Supabase → carrier_leads table');
  console.log('   → Call outcomes   : Supabase → carrier_call_logs table');
  console.log('   → Full call logs  : Supabase → voice_call_logs table');
  console.log('');
  console.log('   📝  When done, comment out called entries in CARRIERS array above.');
}

main().catch(err => {
  console.error('❌  Fatal error:', err.message);
  process.exit(1);
});
