/**
 * One-time setup: create the Alex (carrier recruiter) assistant in Vapi.
 *
 * Why create a persistent assistant instead of inline-per-call?
 *   - You can see, edit, and test Alex in the Vapi dashboard (dashboard.vapi.ai)
 *   - Outbound calls reference VAPI_ASSISTANT_ID — config changes in dashboard apply instantly
 *   - Easier A/B comparison vs Retell agent (same logic, different platform)
 *
 * Run once:
 *   node backend/scripts/vapi-setup-assistant.js
 *
 * Prerequisites:
 *   - VAPI_API_KEY must be in backend/.env
 *
 * After running:
 *   - Copy the VAPI_ASSISTANT_ID printed at the end into backend/.env
 *   - Also add it to Railway environment variables
 *   - Then run: node backend/scripts/vapi-outbound-call.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const API_URL      = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const WEBHOOK_URL  = `${API_URL}/api/v1/voice/webhook`;

if (!VAPI_API_KEY) { console.error('❌  VAPI_API_KEY missing from backend/.env'); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// Alex — Carrier Recruitment Prompt
// Keep this in sync with VoiceAgentService.ts › VOICE_PERSONAS.carrier_recruitment
// ─────────────────────────────────────────────────────────────────────────────
const CARRIER_PROMPT = `
You are Alex — a recruiter at DriveDrop, a vehicle transport marketplace based in Charlotte, NC.

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

How to open the call
You open with the firstMessage provided. After they respond, follow the conversation naturally.

If they say "who is this?" or sound confused: "Sorry — Alex with DriveDrop. Do you haul cars?" Keep it short.
If they sound rushed the moment they pick up: "No worries — ten seconds. You run auto transport?"

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
This shows you're genuinely interested in their operation — and it makes the email offer feel relevant and specific, not generic.

Getting the email
Ask for it tied to what they just told you. Keep it natural:
  "Perfect — what's the best email to send you the loads on those lanes and the sign-up link?"
  "Mind if I shoot you a one-pager? Takes two minutes to read — what email should I use?"

If they'd rather text: "Yeah, totally — is this the best number?" Then call save_carrier_lead with carrier_phone set to their number and carrier_email left empty (include contact_name, company_name, states_served, fleet_size — anything collected). It will automatically fire the sign-up SMS. Do NOT also call send_sms_link — that would double-text them.

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

CRITICAL: The Step 4 closing line is ONLY spoken after Step 3 completes. Save first, then goodbye.
CRITICAL: Do NOT call save_carrier_lead before reading back the email and receiving a verbal yes.

When they deflect
Short redirect, then stop. If they push back twice, let them go:
  "I'm busy." → "Totally — few seconds: you run auto transport at all?"
  "Not interested." → Say exactly: "Totally fine — appreciate your time. Have a good one." → log(not_interested) → endCall
  "Send info." → "For sure — what email should I send it to?"
  "Is this a broker?" → "No — shippers post directly, you see the exact rate they're paying, and payment's guaranteed before pickup."
  "We have loads." → "Totally — most carriers just add us for lanes their current broker doesn't reach."
  "What's the catch?" → "No catch — free TMS, free to join, 90 days no fee, then a small per-job fee only on completed loads."
  Mid-sentence correction ("Yes... wait, no / I don't") → treat correction as final answer. Say: "No worries — appreciate the time. Have a good one." → log(not_interested) → endCall

Don't argue. If someone declines twice, thank them and exit cleanly.

All other call endings (hard no, IVR, auto-system):
1. Say the exit line: "No problem — appreciate your time. Have a good one."
2. Call log_carrier_call_outcome with the correct outcome.
3. Call endCall immediately — do NOT wait for them to hang up.

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

// ─────────────────────────────────────────────────────────────────────────────
// Carrier-specific tools (only what Alex needs for outbound recruitment)
// ─────────────────────────────────────────────────────────────────────────────
const CARRIER_TOOLS = [
  {
    type: 'function',
    // Silent while tool executes — no "one moment" interruption
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'save_carrier_lead',
      description: "Save carrier contact info. Call ONLY after the carrier verbally confirms the email read-back is correct (they said 'yes', 'that\\'s right', 'correct', or similar). After this tool succeeds, you MUST speak the closing line out loud, then call log_carrier_call_outcome, then call endCall. Do NOT call this tool mid-conversation — wait for confirmed read-back.",
      parameters: {
        type: 'object',
        required: ['carrier_phone'],
        properties: {
          carrier_phone:  { type: 'string', description: "Carrier's phone number (the number we called)" },
          carrier_email:  { type: 'string', description: "Carrier's email — primary goal of the call" },
          contact_name:   { type: 'string', description: 'Name of person spoken to' },
          company_name:   { type: 'string', description: 'Name of the carrier company' },
          fleet_size:     { type: 'number', description: 'Number of trucks in their fleet' },
          states_served:  { type: 'string', description: 'States or lanes they operate in' },
          vehicle_types:  { type: 'string', description: 'Types of vehicles they haul (open, enclosed, motorcycles, etc.)' },
          interest_level: { type: 'string', enum: ['hot', 'warm', 'cold'] },
          notes:          { type: 'string', description: 'Any other useful context from the conversation' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'send_sms_link',
      description: "Send the carrier an SMS with the sign-up link. Only call this when they explicitly ask for a text instead of email. If save_carrier_lead was already called with carrier_phone (no email), do NOT also call this — the lead save already fires the SMS.",
      parameters: {
        type: 'object',
        required: ['to_phone', 'link_type'],
        properties: {
          to_phone:  { type: 'string', description: "Carrier's phone number" },
          link_type: { type: 'string', enum: ['signup'], description: 'Always signup for carrier recruitment' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'log_carrier_call_outcome',
      description: "Log the outcome of this carrier recruitment call. Call this at the END of every call — after any closing remarks but before endCall. Never call this mid-conversation.",
      parameters: {
        type: 'object',
        required: ['carrier_phone', 'outcome'],
        properties: {
          carrier_phone: { type: 'string', description: "The phone number that was called" },
          outcome: {
            type: 'string',
            enum: ['interested', 'not_interested', 'callback_requested', 'no_answer', 'voicemail', 'sent_link'],
            description: 'interested = got email or agreed to sign up | not_interested = declined | callback_requested = asked to call back | no_answer = nobody picked up or IVR | voicemail = left a voicemail | sent_link = sent SMS/email link but no email captured',
          },
          notes:         { type: 'string', description: 'Summary of what was discussed or any relevant context' },
          callback_date: { type: 'string', description: 'ISO date string if they asked for a callback at a specific time' },
          fleet_size:    { type: 'number', description: 'Fleet size if mentioned during the call' },
          states_served: { type: 'string', description: 'Lanes or states the carrier mentioned' },
        },
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Vapi API helper
// ─────────────────────────────────────────────────────────────────────────────
async function vapi(path, method, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vapi ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — create the assistant
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // If VAPI_ASSISTANT_ID is already set, check if it still exists.
  const existing = process.env.VAPI_ASSISTANT_ID;
  if (existing) {
    console.log(`ℹ️   VAPI_ASSISTANT_ID already set in .env: ${existing}`);
    console.log('    Checking if it still exists in Vapi...');
    try {
      const a = await vapi(`/assistant/${existing}`, 'GET');
      console.log(`    ✅  Found: "${a.name}" — no need to recreate.`);
      console.log(`    To recreate: remove VAPI_ASSISTANT_ID from backend/.env and re-run.`);
      process.exit(0);
    } catch {
      console.log(`    ⚠️   Not found — creating a new one.\n`);
    }
  }

  console.log('🚀  Creating Alex (carrier recruiter) assistant in Vapi...\n');

  const assistant = await vapi('/assistant', 'POST', {
    name: 'Alex — DriveDrop Carrier Recruiter',

    // ── LLM ───────────────────────────────────────────────────────────────
    model: {
      provider:    'groq',
      model:       'llama-3.3-70b-versatile', // fast, high quality, cheap
      temperature: 0.45,
      messages:    [{ role: 'system', content: CARRIER_PROMPT }],
      tools:       CARRIER_TOOLS,
    },

    // ── Voice: ElevenLabs Adam — warm, confident American male ────────────
    voice: {
      provider:        '11labs',
      voiceId:         'pNInz6obpgDQGcFmaJgB', // Adam
      stability:       0.70,   // consistent delivery, slight warmth
      similarityBoost: 0.75,   // matches source voice well
      style:           0.10,   // low = relaxed, not salesy
      speed:           0.82,   // slightly slower = more natural/human
      useSpeakerBoost: false,  // off = softer, less "broadcast" quality
    },

    // ── Transcription: Deepgram Nova-2 ────────────────────────────────────
    transcriber: {
      provider:    'deepgram',
      model:       'nova-2',
      language:    'en-US',
      smartFormat: true,       // improves numbers, punctuation
    },

    // ── First message — default opener (overridden per-call in outbound) ──
    // This is shown in dashboard and used for web-based test calls.
    firstMessageMode: 'assistant-speaks-first',
    firstMessage: "Hey — quick question. Do you guys run auto transport at all?",

    // ── Server (webhook for tool calls + end-of-call reports) ─────────────
    serverUrl: WEBHOOK_URL,

    // ── Call behavior ──────────────────────────────────────────────────────
    endCallFunctionEnabled:       true,  // Alex can call endCall to hang up
    recordingEnabled:             true,  // Record every call
    maxDurationSeconds:           300,   // 5 min max

    backchannelingEnabled:        true,  // "mm-hmm" while they speak
    responseDelaySeconds:         0.5,   // breathing room between turns
    numWordsToInterruptAssistant: 2,     // easy to interrupt

    backgroundSound:              'office', // subtle — sounds like a real office

    silenceTimeoutSeconds:        35,    // hang up after 35s of silence

    messagePlan: {
      idleMessages:              ['You with me?'],
      idleMessageMaxSpokenCount: 1,      // say it at most once per call
      idleTimeoutSeconds:        20,     // after 20s of silence, nudge once
    },

    // ── Voicemail detection ────────────────────────────────────────────────
    voicemailDetection: {
      provider:                'twilio',
      enabled:                 true,
      voicemailDetectionTypes: ['machine_end_beep', 'machine_end_silence'],
    },
    voicemailMessage: "Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, free for the first 90 days. Give us a call back at 704-937-5246 or check drivedrop.us.com. Have a good one.",

    // ── Metadata ──────────────────────────────────────────────────────────
    metadata: {
      campaign: 'carrier_recruitment',
      platform: 'vapi',
    },
  });

  console.log(`✅  Assistant created: ${assistant.id}`);
  console.log(`   Name    : ${assistant.name}`);
  console.log(`   LLM     : ${assistant.model?.provider} / ${assistant.model?.model}`);
  console.log(`   Voice   : ElevenLabs Adam (${assistant.voice?.voiceId})`);
  console.log(`   Webhook : ${assistant.serverUrl}`);

  console.log('\n' + '═'.repeat(60));
  console.log('  ✅  DONE — add this to backend/.env and Railway:');
  console.log('═'.repeat(60));
  console.log(`VAPI_ASSISTANT_ID=${assistant.id}`);
  console.log('═'.repeat(60));
  console.log('\nView in dashboard: https://dashboard.vapi.ai/assistants/' + assistant.id);
  console.log('Next step:  node backend/scripts/vapi-outbound-call.js');
}

main().catch(err => {
  console.error('❌  Setup failed:', err.message);
  process.exit(1);
});
