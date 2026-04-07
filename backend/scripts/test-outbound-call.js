/**
 * Quick test: trigger an outbound carrier recruitment call via Vapi directly.
 * Run:  node backend/scripts/test-outbound-call.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID;
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL       = `${API_URL}/api/v1/voice/webhook`;

const TEST_NUMBERS = [
  { phone: '+19803242352', company: 'Test Carrier A', city: 'Charlotte', state: 'NC' },
  // { phone: '+17045247921', company: 'Test Carrier B', city: 'Charlotte', state: 'NC' },
];

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

// ── Carrier recruitment persona (mirrors VoiceAgentService carrier_recruitment) ──
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
You open with a short question, not an intro. Give them something to react to before you say a word about DriveDrop. Choose naturally from these — don't repeat the same one every time:
  "Hey — quick question. Do you guys run auto transport at all?"
  "Hi — am I catching you at a bad time? Real quick: do you move vehicles?"
  "Hey, this is Alex with DriveDrop out of Charlotte — do you haul cars?"

If they say "who is this?" or sound confused: "Sorry — Alex with DriveDrop. Do you haul cars?" Keep it short — never say the full company name on the re-intro.
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
  "What's the catch?" → "No catch — free to join, 90 days no fee, then a small per-job fee only on completed loads."
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

// Tools that match the live webhook handler
const CARRIER_TOOLS = [
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'save_carrier_lead',
      description: "Save carrier contact info. Call ONLY after the carrier verbally confirms the email read-back is correct (they said 'yes', 'that's right', 'correct', or similar). After this tool succeeds, you MUST speak the closing line out loud, then call log_carrier_call_outcome, then call endCall. Do NOT call this tool mid-conversation — wait for confirmed read-back.",
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
      description: 'Send the carrier an SMS with the sign-up link.',
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
      description: 'Log the outcome of this call. Always call this at the end.',
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

async function callOne({ phone, company, city, state }) {
  console.log(`\n📞  Calling ${phone} (${company}) ...`);

  const call = await vapi('/call', 'POST', {
    phoneNumberId: PHONE_NUMBER_ID,
    customer: { number: phone, name: company },
    assistant: {
      name:  'Alex',
      // ElevenLabs "Adam" — the most natural-sounding male outbound voice on Vapi
      voice: {
        provider:  '11labs',
        voiceId:         'pNInz6obpgDQGcFmaJgB', // Adam — warm, confident, American male
        stability:       0.70,  // higher = more consistent, less pitch-swing
        similarityBoost: 0.75,
        style:           0.10,  // low = relaxed, not salesy/performative
        speed:           0.82,  // slower = more human, easier to follow
        useSpeakerBoost: false, // off = softer, less "broadcast" quality
      },
      serverUrl: SERVER_URL,
      model: {
        provider:    'groq',
        model:       'llama-3.3-70b-versatile',
        temperature: 0.45,
        messages: [{ role: 'system', content: CARRIER_PROMPT }],
        tools:    CARRIER_TOOLS,
      },
      // Opens with a direct question — no company intro, no "hello is this X"
      firstMessage: `Hey — quick question. Do you guys run auto transport at all?`,
      endCallFunctionEnabled:       true,
      recordingEnabled:             true,
      maxDurationSeconds:           300,
      // ── Conversation feel ───────────────────────────────────────────────
      backchannelingEnabled:        true,   // "mm-hmm", "right" while they speak
      responseDelaySeconds:         0.5,    // breathing room between turns
      numWordsToInterruptAssistant: 2,      // easy to cut in
      backgroundSound:              'office',
      // ── Silence handling ───────────────────────────────────────────────
      silenceTimeoutSeconds:        35,
      messagePlan: {
        // Only nudge if there's been dead silence well into the call
        // idleTimeoutSeconds starts counting from call connect — 20s gives
        // enough room for normal conversation pauses without false-firing
        idleMessages:       ["You with me?"],
        idleMessageMaxSpokenCount: 1,   // say it at most once
        idleTimeoutSeconds: 20,
      },
      // ── Transcriber ────────────────────────────────────────────────────
      transcriber: {
        provider:    'deepgram',
        model:       'nova-2',
        language:    'en-US',
        smartFormat: true,
      },
      // ── Voicemail detection ─────────────────────────────────────────────
      voicemailDetection: {
        provider:                'twilio',
        enabled:                 true,
        voicemailDetectionTypes: ['machine_end_beep', 'machine_end_silence'],
      },
    },
    metadata: {
      campaign:     'carrier_recruitment',
      company_name: company,
      city,
      state,
    },
  });

  console.log(`✅  Call initiated!`);
  console.log(`   Call ID : ${call.id}`);
  console.log(`   From    : +1 (704) 937-5246`);
  console.log(`   To      : ${phone}`);
}

async function main() {
  console.log(`🚀  Firing ${TEST_NUMBERS.length} test calls (V3 Alex prompt)`);
  console.log(`   Webhook : ${SERVER_URL}\n`);

  for (const target of TEST_NUMBERS) {
    await callOne(target);
    // brief pause between calls to avoid race on phone number
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n📋  Check Vapi dashboard → Calls for live transcripts.`);
}

main().catch(err => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
