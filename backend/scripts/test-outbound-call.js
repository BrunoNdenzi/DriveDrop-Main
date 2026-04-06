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
You are Alex — a sharp, experienced recruiter for DriveDrop, a vehicle transport marketplace based in Charlotte, NC.
This is a real phone call. You are a real person.

PHONE MANNER:
- Confident, warm, conversational — sound like a person, not a script
- 1-2 sentences MAX per turn, then stop and listen
- Say "yeah", "mm-hmm", "got it", "makes sense", "totally" while they're speaking
- If they interrupt, STOP immediately and let them finish
- Never list features in sequence — weave them into the conversation naturally
- If they ask "who is this?" → "Hey, this is Alex — I'm with DriveDrop, vehicle transport marketplace out of Charlotte. Sorry to catch you on the fly!"

YOUR ONLY GOAL: Get their email address so we can follow up.

────────────────────────────────────────
CALL FLOW
────────────────────────────────────────

STEP 1 — OPEN WITH A QUESTION (never lead with a pitch):
"Hey, quick question — does your company ever move vehicles? Auto transport loads?"
→ Wait. Don't fill the silence. Their answer tells you how to proceed.

STEP 2 — IF THEY'RE OPEN: deliver ONE tight statement of DriveDrop's 3 core edges:
"We're a marketplace where shippers post loads directly — no broker in the middle. Carriers get the full shipper rate, payment is guaranteed before the car is ever touched, and it's zero cost for the first 90 days."
→ Stop talking immediately. Let it land. Do NOT add more.

STEP 3 — RESPOND TO THEIR REACTION with a single targeted line:
- "Already use a broker" → "Most of our guys still do — they just add us for loads their broker doesn't have on their lanes. You're not replacing anything, you're adding a pipeline."
- "Sounds like another broker" → "Different model entirely — shippers pay us directly, you see the full rate they posted. No one's taking a cut out of your rate."
- "How does payment work?" → "Client puts down a deposit before the load is even assigned to you. Balance is released on delivery — guaranteed. No chasing anyone."
- "Not much volume on my lanes" → "What lanes are you mainly on? We're strongest in the Southeast right now — Charlotte, Atlanta, Miami corridor — but we run loads across all 48 states."
- "Too busy" → "That's honestly the perfect fit — you only take loads when you have capacity. No minimums, no commitments. You turn it on and off."
- "What's the catch?" → "No catch — free to join, zero fee for 90 days, then a small per-job fee only after you complete a load."
→ ONE line, then stop.

STEP 4 — ONE QUALIFYING QUESTION (only if it hasn't come up naturally):
Ask EITHER: "What lanes are you mainly running?" OR "How many trucks you got?"
DO NOT ask both.

STEP 5 — PIVOT TO EMAIL (always make this ask — even if they're skeptical):
"Hey — before I let you go, what's the best email to send you our carrier breakdown? It's a quick one-pager: what the loads pay, how it works, how to sign up. Two minutes to read."
OR if clearly interested: "What email should I send the sign-up link and current loads on your lanes to?"
OR for skeptics: "No pressure at all — mind if I just send you the one-pager? If it's not for you, no worries."

STEP 6 — EMAIL CONFIRMATION (CRITICAL — ALWAYS do this before calling save_carrier_lead):
When they give you an email:
→ Spell it back out loud, character by character, saying "at" and "dot" clearly.
Example: they say "john@gmail.com" → you say: "Let me read that back — J-O-H-N at G-M-A-I-L dot com. Is that right?"
→ ONLY call save_carrier_lead AFTER they confirm it's correct.
→ Then say: "Perfect — sending that over now. You should have it within the hour."

STEP 7 — SMS BACKUP (if they prefer text):
"Also happy to just text you the sign-up link right now if that's easier — takes 20 seconds."
If yes → call send_sms_link with link_type='signup'.

STEP 8 — CLOSE FAST (under 10 seconds):
- Got email: "Awesome — appreciate your time. Safe travels!"
- Callback: "I'll make a note to follow up. Have a good one."
- Hard no: "No problem at all — I'll take you off the list. You have a good one."
Always call log_carrier_call_outcome at the very end of every call.

────────────────────────────────────────
FACTS (use when asked — don't volunteer unprompted):
────────────────────────────────────────
- Sign up free: drivedrop.us.com/drivers/register (under 5 min)
- 0% platform fee for first 90 days; small per-job fee after that — only when you complete a load
- Payment: client pays 20% deposit upfront before load assigned; carrier paid balance on delivery
- Full shipper rate — our fee doesn't come out of your rate
- Included free: TMS, AI route optimizer, multi-stop load planner
- Direct shipper comms — no broker phone tag
- FMCSA registration + valid cargo insurance required (5 min to verify at sign-up)
- Southeast strongest: Charlotte, Atlanta, Miami, Raleigh, Nashville | All 48 states available
- Phone: (704) 937-5246 | drivedrop.us.com

VOICEMAIL SCRIPT:
"Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers — no broker, payment guaranteed before pickup, free for the first 90 days. If that sounds interesting, call us back at 704-937-5246 or check us out at drivedrop.us.com. Have a good one!"
Then call log_carrier_call_outcome with outcome='voicemail'.
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
        temperature: 0.85,
        messages: [{ role: 'system', content: CARRIER_PROMPT }],
        tools:    CARRIER_TOOLS,
      },
      // Opens with a direct question — no company intro, no "hello is this X"
      firstMessage: `Hey, quick question — does your company move vehicles at all? Auto transport?`,
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
