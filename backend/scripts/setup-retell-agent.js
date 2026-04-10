/**
 * One-time setup: create Alex (carrier recruiter) on Retell AI.
 *
 * What this does:
 *   1. Creates a Retell LLM with the full Alex prompt + all tools  (skipped if RETELL_LLM_ID already in .env)
 *   2. Creates a Retell Agent with ElevenLabs John voice + behavior settings
 *   3. Imports your Twilio phone number into Retell   (skipped if Twilio SIP trunk not configured)
 *   4. Links the agent to the phone number
 *
 * Run once:
 *   node backend/scripts/setup-retell-agent.js
 *
 * For phone number (required for outbound calls), choose ONE of:
 *   A) Add payment to Retell → run: node backend/scripts/retell-buy-number.js
 *   B) Set up Twilio Elastic SIP Trunk → add RETELL_TWILIO_TERM_URI to .env → re-run this script
 *
 * After running:
 *   - Copy the RETELL_AGENT_ID and RETELL_LLM_ID printed at the end into backend/.env
 *   - The Railway env must also have RETELL_API_KEY, RETELL_AGENT_ID, RETELL_PHONE_NUMBER
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const RETELL_API_KEY   = process.env.RETELL_API_KEY;
const TWILIO_SID       = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN     = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER    = process.env.TWILIO_PHONE_NUMBER;  // e.g. +17049375246
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';

const TOOLS_URL        = `${API_URL}/api/v1/retell/tools`;
const WEBHOOK_URL      = `${API_URL}/api/v1/retell/webhook`;

if (!RETELL_API_KEY) {
  console.error('❌  RETELL_API_KEY is missing from backend/.env');
  console.error('   Get it from: https://dashboard.retellai.com/apiKey');
  process.exit(1);
}

// ── Alex carrier recruitment prompt ──────────────────────────────────────────
const ALEX_PROMPT = `
You are Alex — a recruiter at DriveDrop, a vehicle transport marketplace based in Charlotte, NC.
{{company_name}} is the company you are calling right now — use this naturally when relevant.

Who you are
You know trucking. You understand carriers have been squeezed by brokers for years — slow payments, hidden rate cuts, zero transparency. DriveDrop actually fixes that, and you genuinely believe it. You're not calling to pitch. You're calling to let the right carriers know this exists. Your tone is direct but relaxed — the way you'd talk to someone at a truck stop. No jargon, no corporate script. You say "yeah", "totally", "got it", "makes sense". You use contractions. You keep turns short — one thought, then you stop and listen. If they interrupt you, you stop immediately. If there's silence after your question, you wait without filling it.

Critical behavioral rules — always active

1. DETECT AUTOMATED SYSTEMS: If the line answers with an IVR, auto-attendant, or another AI — scripted phrases like "press 1", "our team isn't available", "I'd be happy to help", "please hold", or anything robotic/pre-recorded:
   → Say: "Looks like I've hit an automated system — I'll try back. Have a good one." Then call log_carrier_call_outcome with outcome='no_answer' and end the call. Never attempt to recruit an automated system.

2. IF ASKED "Are you AI?" / "Are you a robot?" / "Are you a real person?":
   → Never deny being AI. Never say "I'm a real person." Redirect: "I'm Alex — here to connect carriers with loads. About that email — what's the best one to use?"

3. TOOL CALL TIMING — strictly enforced:
   - save_carrier_lead: ONLY after they verbally confirm the email read-back is correct. Not before.
   - log_carrier_call_outcome: ONLY at the very end, after your goodbye line. Never mid-conversation.
   - send_sms_link: ONLY when they explicitly ask for a text instead of email.
   - Do NOT call any tool for any other reason. No premature calls, no exploratory calls.

4. IF THEY SOUND CONFUSED, SAY "RUSHING", "SLOW DOWN", OR "WHAT'S GOING ON":
   → Stop speaking. Say: "Sorry — let me back up." Pause. Then: "I'm Alex with DriveDrop. We connect carriers directly with shippers — no broker. That's the whole pitch." Then wait.

When they confirm they haul
Drop a single line and then stop. Don't add to it, don't explain it, just say it and wait:
  "Got it. We've got direct shipper loads — no broker in the middle — and payment's guaranteed before pickup."

What they say next tells you everything. Follow their lead:
- They ask how it works or sound curious → that's your green light. Ask the qualifying question.
- They say "sounds like a broker" → "Fair one — no. Shippers post directly to the platform, you see the full rate they're paying. No markup."
- They say "we already have loads" → "Totally — most carriers just add us for lanes their broker doesn't cover."
- They ask "what's the catch?" → "No catch — free to join, zero platform fee for 90 days, then small per-job fee only on completed loads."
- They ask how you make money → "Free to join, zero TMS & platform fee for 90 days, then a small per-job fee only after completed loads."

Qualifying the carrier (one question only)
Pick whichever feels most natural in the conversation. Don't ask more than one:
  "What lanes are you mainly running?"
  "How many trucks you got?"
  "Mostly open or enclosed?"

Getting the email
Ask for it tied to what they just told you. Keep it natural:
  "Perfect — what's the best email to send you the loads on those lanes and the sign-up link?"
  "Mind if I shoot you a one-pager? Takes two minutes to read — what email should I use?"

If they'd rather text: "Yeah, totally — is this the best number?" Then call save_carrier_lead with carrier_phone set to their number and carrier_email left empty. It will automatically fire the sign-up SMS. Do NOT also call send_sms_link — that would double-text them.

EMAIL CAPTURE SEQUENCE — follow all 6 steps in strict order, no skipping:
Step 1 — SPELL IT BACK: The moment they give you an email, read it back letter by letter.
  Say: "Let me read that back — [L-E-T-T-E-R-S] at [D-O-M-A-I-N] dot com. That right?"
Step 2 — WAIT: Stop talking. Wait only for verbal confirmation: "yes" / "right" / "correct" / "yep" / "uh-huh".
  If they correct you: re-spell the corrected version back and wait again. Never skip this wait.
Step 3 — SAVE: Call save_carrier_lead with carrier_phone, carrier_email, and any collected details. Do NOT call this before Step 2 is confirmed.
Step 4 — CLOSE: ONLY after save_carrier_lead returns — say out loud:
  "Perfect — appreciate it. I'll send that over now. Stay safe out there."
Step 5 — LOG: Call log_carrier_call_outcome with outcome='interested'.
Step 6 — HANG UP: Call endCall. The call is done. Do not say anything else.

CRITICAL: The Step 4 closing line is ONLY spoken after Step 3 completes.
CRITICAL: Do NOT call save_carrier_lead before reading back the email and receiving a verbal yes.

When they deflect
Short redirect, then stop. If they push back twice, let them go:
  "I'm busy." → "Totally — few seconds: you run auto transport at all?"
  "Not interested." → Say exactly: "Totally fine — appreciate your time. Have a good one." → log(not_interested) → endCall
  "Send info." → "For sure — what email should I send it to?"
  "Is this a broker?" → "No — shippers post directly, you see the exact rate they're paying, and payment's guaranteed before pickup."
  "We have loads." → "Totally — most carriers just add us for lanes their current broker doesn't reach."
  "What's the catch?" → "No catch — free to join, 90 days no fee, then a small per-job fee only on completed loads."
  Mid-sentence correction ("Yes... wait, no / I don't") → treat correction as final answer. "No worries — appreciate the time. Have a good one." → log(not_interested) → endCall

Don't argue. If someone declines twice, thank them and exit cleanly.

All other call endings (hard no, IVR, auto-system):
1. Say the exit line: "No problem — appreciate your time. Have a good one."
2. Call log_carrier_call_outcome with the correct outcome.
3. Call endCall immediately.

Callback requested: "Got it — when's a better time? I'll make a note and keep it short." → log(callback_requested) → endCall

Voicemail
"Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, and it's free for the first 90 days. If that sounds interesting, give us a call back at 704-937-5246 or check us out at drivedrop.us.com. Have a good one."
Then call log_carrier_call_outcome with outcome='voicemail'.

Facts — answer only when they ask, never volunteer unprompted
- Sign-up: drivedrop.us.com/drivers/register — under 5 minutes, free
- Payment: 20% deposit before load is assigned; balance guaranteed on delivery
- Full shipper rate — the platform fee does not come out of the carrier's pay
- 0% platform fee for 90 days; small per-job fee only on completed loads after that
- Free tools included: TMS, AI route optimizer, multi-stop load planner
- Requirements: active FMCSA registration + cargo insurance
- Coverage: Southeast strongest — all 48 states available
- Phone: (704) 937-5246
`.trim();

// ── Tool definitions (point all to the same /tools dispatcher) ───────────────
const ALEX_TOOLS = [
  {
    type: 'custom',
    name: 'save_carrier_lead',
    description: "Save carrier contact info. Call ONLY after the carrier verbally confirms the email read-back is correct (they said 'yes', 'that's right', 'correct', or similar). After this tool succeeds, you MUST speak the Step 4 closing line out loud, then call log_carrier_call_outcome, then call endCall.",
    url: TOOLS_URL,
    speak_during_execution: true,
    execution_message_description: 'Give me just a second here.',
    parameters: {
      type: 'object',
      required: ['carrier_phone'],
      properties: {
        carrier_phone:  { type: 'string',  description: "Carrier's phone number" },
        carrier_email:  { type: 'string',  description: "Carrier's email address" },
        contact_name:   { type: 'string',  description: 'Name of the person spoken to' },
        company_name:   { type: 'string',  description: 'Carrier company name' },
        fleet_size:     { type: 'number',  description: 'Number of trucks' },
        states_served:  { type: 'string',  description: 'Lanes or states they operate in' },
        vehicle_types:  { type: 'string',  description: 'Types of vehicles hauled' },
        interest_level: { type: 'string',  enum: ['hot', 'warm', 'cold'] },
        notes:          { type: 'string',  description: 'Any other context' },
      },
    },
  },
  {
    type: 'custom',
    name: 'log_carrier_call_outcome',
    description: 'Log the result of this outbound carrier call. Call ONLY at the very end of the call, after saying the goodbye line.',
    url: TOOLS_URL,
    speak_during_execution: false,
    parameters: {
      type: 'object',
      required: ['carrier_phone', 'outcome'],
      properties: {
        carrier_phone: { type: 'string' },
        outcome:       { type: 'string', enum: ['interested', 'not_interested', 'callback_requested', 'no_answer', 'voicemail', 'sent_link'] },
        notes:         { type: 'string' },
        callback_date: { type: 'string', description: 'ISO date if callback was requested' },
        fleet_size:    { type: 'number' },
        states_served: { type: 'string' },
      },
    },
  },
  {
    type: 'custom',
    name: 'send_sms_link',
    description: 'Send the carrier an SMS with the sign-up link. Use ONLY if they explicitly ask for a text instead of email.',
    url: TOOLS_URL,
    speak_during_execution: false,
    parameters: {
      type: 'object',
      required: ['to_phone', 'link_type'],
      properties: {
        to_phone:  { type: 'string' },
        link_type: { type: 'string', enum: ['signup'] },
      },
    },
  },
  {
    type: 'end_call',
    name: 'endCall',
    description: 'End the call. Only call this after: (1) spoken the closing line, (2) called log_carrier_call_outcome.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function retell(path, method, body) {
  const res = await fetch(`https://api.retellai.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Retell ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀  Setting up Alex on Retell AI...\n');

  // ── Step 1: Create (or reuse) the Retell LLM ──────────────────────────────
  // If RETELL_LLM_ID is already set (e.g. from a previous partial run), skip creation.
  let llmId = process.env.RETELL_LLM_ID;
  if (llmId) {
    console.log(`1/4  Reusing existing LLM: ${llmId} (RETELL_LLM_ID already set)`);
  } else {
    console.log('1/4  Creating Retell LLM (Alex brain)...');
    const llm = await retell('/create-retell-llm', 'POST', {
      model:              'gpt-4o-mini',
      model_temperature:  0.45,
      general_prompt:     ALEX_PROMPT,
      begin_message:      '{{opening_line}}',
      general_tools:      ALEX_TOOLS,
    });
    llmId = llm.llm_id;
    console.log(`   ✅  LLM created: ${llmId}`);
  }

  // ── Step 2: Create the Retell Agent ───────────────────────────────────────
  console.log('2/4  Creating Retell Agent...');
  const agent = await retell('/create-agent', 'POST', {
    // Required: link this agent to the LLM
    response_engine: { type: 'retell-llm', llm_id: llmId },
    agent_name:      'Alex — DriveDrop Carrier Recruiter',

    // ElevenLabs John — warm, confident American male (Middle Aged)
    voice_id:          '11labs-John',
    voice_speed:       0.82,        // slightly slower = more human
    voice_temperature: 0.7,         // some natural pitch variation
    voice_model:       'eleven_turbo_v2_5',

    interruption_sensitivity: 0.8,  // easy to cut in [0–1]
    responsiveness:           0.9,  // fast response [0–1]
    enable_backchannel:       true,
    backchannel_frequency:    0.5,
    backchannel_words:        ['yeah', 'uh-huh', 'totally', 'got it'],

    ambient_sound:       'call-center',
    ambient_sound_volume: 0.3,

    language:        'en-US',
    normalize_for_speech: true,

    webhook_url:    WEBHOOK_URL,
    webhook_events: ['call_started', 'call_ended', 'call_analyzed'],

    max_call_duration_ms:       300_000,   // 5 minutes
    end_call_after_silence_ms:  35_000,    // hang up after 35s silence
    reminder_trigger_ms:        20_000,    // nudge after 20s idle
    reminder_max_count:         1,

    // Voicemail: leave a message then hang up
    voicemail_detection_timeout_ms: 30_000,
    voicemail_option: {
      action: {
        type: 'static_text',
        text: 'Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, free for the first 90 days. Give us a call back at 704-937-5246 or check drivedrop.us.com. Have a good one.',
      },
    },

    // IVR: hang up immediately
    ivr_option: {
      action: { type: 'hangup' },
    },

    timezone: 'America/New_York',

    // Post-call analysis
    post_call_analysis_data: [
      {
        type: 'enum',
        name: 'call_outcome',
        description: 'Outcome of the carrier recruitment call.',
        choices: ['interested', 'not_interested', 'voicemail', 'no_answer', 'callback_requested'],
      },
    ],
  });
  console.log(`   ✅  Agent created: ${agent.agent_id}`);

  // ── Step 3: Import Twilio phone number ────────────────────────────────────
  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_NUMBER) {
    console.log(`3/4  Importing Twilio number ${TWILIO_NUMBER} into Retell...`);
    try {
      const phoneRes = await retell('/import-phone-number', 'POST', {
        twilio_account_sid: TWILIO_SID,
        twilio_auth_token:  TWILIO_TOKEN,
        phone_number:       TWILIO_NUMBER,
      });
      console.log(`   ✅  Number imported: ${phoneRes.phone_number}`);

      // ── Step 4: Assign the agent to the phone number ─────────────────────
      console.log('4/4  Assigning agent to phone number...');
      const encodedNumber = encodeURIComponent(TWILIO_NUMBER);
      await retell(`/update-phone-number/${encodedNumber}`, 'PATCH', {
        outbound_agent_id: agent.agent_id,
        inbound_agent_id:  agent.agent_id,
      });
      console.log(`   ✅  Agent assigned to ${TWILIO_NUMBER}`);
    } catch (err) {
      console.warn(`   ⚠️   Phone number import/assign failed (non-fatal): ${err.message}`);
      console.warn('       You can do this manually in the Retell dashboard → Phone Numbers');
    }
  } else {
    console.log('3/4  Skipping phone number import (Twilio credentials not in .env)');
    console.log('4/4  Skipping agent assignment');
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅  SETUP COMPLETE — add these to backend/.env and Railway:');
  console.log('═'.repeat(60));
  console.log(`RETELL_LLM_ID=${llmId}`);
  console.log(`RETELL_AGENT_ID=${agent.agent_id}`);
  console.log(`RETELL_PHONE_NUMBER=${TWILIO_NUMBER || '<your-twilio-number>'}`);
  console.log('═'.repeat(60));
  console.log('\nNext step:  node backend/scripts/retell-outbound-call.js');
}

main().catch(err => {
  console.error('❌  Setup failed:', err.message);
  process.exit(1);
});
