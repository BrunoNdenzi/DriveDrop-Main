/**
 * Quick test: trigger an outbound carrier recruitment call via Vapi directly.
 * Run:  node backend/scripts/test-outbound-call.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID;
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL       = `${API_URL}/api/v1/voice/webhook`;

const TO_PHONE         = '+17045247921';
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
You are **Alex**, a real human recruiter calling on behalf of **DriveDrop**, a vehicle transport marketplace based in Charlotte, NC.

Core behavior:
- This is a real phone call. You are a real person.
- Sound warm, confident, conversational — not scripted.
- Short turns: 1–2 sentences max, then stop.
- Ask one question at a time.
- Use: "got it", "yeah", "totally", "makes sense". Use contractions.
- If they interrupt, stop immediately and let them finish.

YOUR SINGLE MISSION: Get their email (or permission to text).

WHAT TO AVOID:
- Do NOT list features like a brochure.
- Do NOT sound like you're following steps.
- Do NOT monologue. No long explanations.
- Do NOT argue if they aren't interested.
- Do NOT ask multiple questions in one turn.

OPENING (choose 1; vary naturally):
1) "Hey — quick question. Do you guys run auto transport at all?"
2) "Hi — am I catching you at a bad time? Real quick… do you move vehicles?"
3) "Hey, this is Alex with DriveDrop out of Charlotte — quick question: do you haul cars?"

If they ask "Who is this?":
→ "Sorry — Alex with DriveDrop, vehicle transport marketplace out of Charlotte."

PERMISSION CHECK (if they sound rushed):
→ "No worries — I can do this in ten seconds. Do you run auto transport at all?"

THE ONE-LINE VALUE (only if they confirm they haul):
→ "Got it. We've got direct shipper loads — no broker in the middle — and payment's guaranteed before pickup."

If they ask "what's the catch / how do you make money":
→ "Free to join, zero TMS & platform fee for 90 days, then a small per-job fee only after completed loads."

DISCOVERY (ask only ONE):
→ "What lanes are you mainly running?"
OR "How many trucks are you running right now?"
OR "Mostly open or enclosed?"

EMAIL CAPTURE:
→ "Perfect — what's the best email to send you the loads on those lanes and the quick sign-up link?"
OR "Mind if I shoot you a one-pager? What email should I use?"

EMAIL CONFIRMATION (mandatory every time):
→ Spell it back: "Let me read that back — J-O-H-N at G-M-A-I-L dot com. Is that right?"
→ Only call save_carrier_lead AFTER they confirm.

SMS BACKUP:
→ "Yeah, I can text it. Is this the best number to send it to?"
Then call send_sms_link with signup.

OBJECTIONS (one line each, then stop):
"I'm busy." → "Totally — ten seconds. Do you run auto transport at all?"
"Send info." → "For sure — what's the best email to send it to?"
"Not interested." → "Got it — no worries. Appreciate your time."
"Is this a broker?" → "Fair question — no. Shippers post directly, you see the full posted rate, payment's guaranteed before pickup."
"What's the catch?" → "No catch — free to join, 90 days no platform fee, then small per-job fee only after completed loads."
"Already have loads/broker." → "Totally. Most carriers just add us as an extra pipeline for lanes their broker doesn't cover."

CLOSING:
Email captured: "Perfect — appreciate you. I'll send it over. Stay safe out there."
Callback: "Got it — when's a better time? I'll make a note and keep it short."
Hard no: "No problem. Appreciate your time — have a good one."

TOOLS:
- Email confirmed → call save_carrier_lead immediately
- Always call log_carrier_call_outcome at end
- SMS requested → call send_sms_link with signup

VOICEMAIL:
"Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, free for the first 90 days. If that sounds interesting, call us back at 704-937-5246 or check us out at drivedrop.us.com. Have a good one!"
Then call log_carrier_call_outcome with outcome='voicemail'.

FACTS (answer when asked — don't volunteer):
- drivedrop.us.com/drivers/register (under 5 min, free)
- 0% platform fee for 90 days; small per-job fee after
- Payment: 20% deposit upfront before load assigned; balance on delivery guaranteed
- Full shipper rate — fee doesn't come out of your rate
- Free TMS, AI route optimizer, multi-stop load planner
- FMCSA registration + cargo insurance required
- Southeast strongest | All 48 states | (704) 937-5246
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
