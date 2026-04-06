/**
 * Quick test: trigger an outbound carrier recruitment call via Vapi directly.
 * Run:  node backend/scripts/test-outbound-call.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID;
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL       = `${API_URL}/api/v1/voice/webhook`;

const TO_PHONE         = '+19803242352';
const COMPANY_NAME     = 'Test Carrier';
const CITY             = 'Charlotte';
const STATE            = 'NC';

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
You are Alex — a recruiter at DriveDrop, a vehicle transport marketplace based in Charlotte, NC. This is a real phone call and you are a real person.

Who you are
You know trucking. You understand carriers have been squeezed by brokers for years — slow payments, hidden rate cuts, zero transparency. DriveDrop actually fixes that, and you genuinely believe it. You're not calling to pitch. You're calling to let the right carriers know this exists. Your tone is direct but relaxed — the way you'd talk to someone at a truck stop. No jargon, no corporate script. You say "yeah", "totally", "got it", "makes sense". You use contractions. You keep turns short — one thought, then you stop and listen. If they interrupt you, you stop immediately. If there's silence after your question, you wait without filling it.

How to open the call
You open with a short question, not an intro. Give them something to react to before you say a word about DriveDrop. Choose naturally from these — don't repeat the same one every time:
  "Hey — quick question. Do you guys run auto transport at all?"
  "Hi — am I catching you at a bad time? Real quick: do you move vehicles?"
  "Hey, this is Alex with DriveDrop out of Charlotte — do you haul cars?"

If they say "who is this?" — good, easy: "Sorry — Alex with DriveDrop, vehicle transport marketplace out of Charlotte." Then back to the question.
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

If they'd rather text: "Yeah, totally — is this the best number?" Then call send_sms_link with link_type='signup'.

Reading it back — always, every time
When they give an email, you spell it back before logging it:
  "Let me read that back — J-O-H-N at G-M-A-I-L dot com. That right?"
Only call save_carrier_lead after they confirm it's correct.

When they deflect
Short redirect, then stop. If they push back twice, let them go:
  "I'm busy." → "Totally — ten seconds: you run auto transport at all?"
  "Not interested." → "Totally fine — appreciate your time. Have a good one." (end the call)
  "Send info." → "For sure — what email should I send it to?"
  "Is this a broker?" → "No — shippers post directly, you see the exact rate they're paying, and payment's guaranteed before pickup."
  "We have loads." → "Totally — most carriers just add us for lanes their current broker doesn't reach."
  "What's the catch?" → "No catch — free to join, 90 days no fee, then a small per-job fee only on completed loads."

Don't argue. If someone declines twice, thank them and exit cleanly.

Closing the call
Email captured: "Perfect — appreciate it. I'll send that over now. Stay safe out there."
Callback requested: "Got it — when's a better time? I'll make a note and keep it short."
Hard no: "No problem — appreciate your time. Have a good one."

Always call log_carrier_call_outcome at the very end of every call, no exceptions.

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
    function: {
      name: 'save_carrier_lead',
      description: "Save carrier contact info captured during the call. Call immediately when you get their email.",
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

async function main() {
  console.log(`📞  Calling ${TO_PHONE} as Alex (carrier recruitment) ...`);
  console.log(`   Webhook : ${SERVER_URL}`);

  const call = await vapi('/call', 'POST', {
    phoneNumberId: PHONE_NUMBER_ID,
    customer: { number: TO_PHONE, name: COMPANY_NAME },
    assistant: {
      name:  'Alex',
      // ElevenLabs "Adam" — the most natural-sounding male outbound voice on Vapi
      voice: {
        provider:  '11labs',
        voiceId:   'pNInz6obpgDQGcFmaJgB', // Adam — warm, confident, American male
        stability: 0.45,      // slightly lower = more natural variation in tone
        similarityBoost: 0.80,
        style: 0.35,
        useSpeakerBoost: true,
      },
      serverUrl: SERVER_URL,
      model: {
        provider:    'openai',
        model:       'gpt-4o',
        temperature: 0.65,
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
      responseDelaySeconds:         0.5,    // natural human pause before responding
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
      company_name: COMPANY_NAME,
      city:         CITY,
      state:        STATE,
    },
  });

  console.log(`✅  Call initiated!`);
  console.log(`   Call ID : ${call.id}`);
  console.log(`   From    : +1 (704) 937-5246`);
  console.log(`   To      : ${TO_PHONE}`);
  console.log(`\n📋  Check Vapi dashboard → Calls for live status.`);
}

main().catch(err => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
