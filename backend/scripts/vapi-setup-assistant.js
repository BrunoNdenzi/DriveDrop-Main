/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  DriveDrop — Vapi Voice Agent Setup (Production-Ready)                  ║
 * ║                                                                         ║
 * ║  Creates the "Alex" carrier recruiter assistant in Vapi for outbound    ║
 * ║  recruitment calls. This is the definitive, stable configuration.       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * What this fixes vs. the previous setup:
 *   ✅  Switched from Groq/Llama to OpenAI gpt-4o-mini (reliable tool calling,
 *       eliminates "unidentified end reason" from LLM failures)
 *   ✅  Only 3 carrier-specific tools (not 11) — prevents confused tool calls
 *   ✅  Explicit webhook timeout of 40s — prevents premature call drops
 *   ✅  Higher silence timeout (45s) — carriers who pause won't trigger hangup
 *   ✅  Gentler idle nudge (25s, max once) — less robotic
 *   ✅  Cleaner prompt with strict anti-hallucination guardrails
 *   ✅  Idempotent — safe to re-run; updates existing assistant if found
 *   ✅  Validates webhook health before creating assistant
 *
 * Run once:
 *   node backend/scripts/vapi-setup-assistant.js
 *
 * Prerequisites (in backend/.env):
 *   VAPI_API_KEY           — from dashboard.vapi.ai → API Keys
 *   VAPI_PHONE_NUMBER_ID   — from dashboard.vapi.ai → Phone Numbers (optional, for phone assignment)
 *   API_URL                — your Railway backend URL (for webhook)
 *
 * After running:
 *   1. Copy the VAPI_ASSISTANT_ID printed at the end into backend/.env
 *   2. Add it to Railway environment variables
 *   3. Run:  node backend/scripts/vapi-outbound-call.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────
const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID || '';
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const WEBHOOK_URL      = `${API_URL}/api/v1/voice/webhook`;

if (!VAPI_API_KEY) {
  console.error('❌  VAPI_API_KEY missing from backend/.env');
  console.error('   Get it from: https://dashboard.vapi.ai → top-right → API Keys');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Vapi API helper with retry logic
// ─────────────────────────────���───────────────────────────────────────────────
async function vapi(path, method, body, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
        const errMsg = `Vapi ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`;
        if (attempt < retries && res.status >= 500) {
          console.warn(`   ⚠️  Retrying (${attempt + 1}/${retries}): ${errMsg}`);
          await sleep(2000 * (attempt + 1));
          continue;
        }
        throw new Error(errMsg);
      }
      return data;
    } catch (err) {
      if (attempt < retries && err.message?.includes('fetch failed')) {
        console.warn(`   ⚠️  Network error, retrying (${attempt + 1}/${retries})...`);
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────────────────
// Alex — Carrier Recruitment System Prompt
//
// DESIGN PRINCIPLES:
//   1. Short turns — one thought, then stop and listen
//   2. Never volunteer facts unprompted — only answer what they ask
//   3. Strict tool timing — no premature saves or logs
//   4. Graceful exits — thank them and hang up cleanly
//   5. No corporate jargon — talk like a real person at a truck stop
// ─────────────────────────────────────────────────────────────────────────────
const CARRIER_PROMPT = `
You are Alex — a recruiter at DriveDrop, a vehicle transport marketplace based in Charlotte, NC.

IDENTITY & TONE
You know trucking. You understand carriers have been squeezed by brokers for years — slow payments, hidden rate cuts, zero transparency. DriveDrop fixes that, and you genuinely believe it. You're not calling to pitch. You're calling to let the right carriers know this exists.
Your tone is direct but relaxed — the way you'd talk to someone at a truck stop. No jargon, no corporate script. You say "yeah", "totally", "got it", "makes sense". You use contractions. You keep turns short — one thought, then you stop and listen. If they interrupt you, you stop immediately. If there's silence after your question, you wait without filling it.

═══════════════════════════════════════
CRITICAL RULES — ALWAYS ACTIVE
═══════════════════════════════════════

RULE 1 — DETECT AUTOMATED SYSTEMS
If the line answers with an IVR, auto-attendant, or another AI — scripted phrases like "press 1", "our team isn't available", "I'd be happy to help", "please hold", or anything robotic/pre-recorded:
→ Say: "Looks like I've hit an automated system — I'll try back. Have a good one."
→ Call log_carrier_call_outcome with outcome='no_answer'
→ Call endCall immediately
→ NEVER attempt to recruit an automated system

RULE 2 — "ARE YOU AI?" / "ARE YOU A ROBOT?"
→ Never deny being AI. Never say "I'm a real person."
→ Redirect naturally: "I'm Alex with DriveDrop — helping connect carriers with direct shipper loads. Quick question though — what email works best for you?"

RULE 3 — TOOL CALL TIMING (strictly enforced)
- save_carrier_lead → ONLY after they verbally confirm the email read-back. Not before. Not ever mid-conversation.
- log_carrier_call_outcome → ONLY at the very end, after your goodbye line. Never mid-conversation.
- send_sms_link → ONLY when they explicitly ask for a text instead of email.
- Do NOT call any tool for any other reason.

RULE 4 — CONFUSED / RUSHING / "SLOW DOWN"
→ Stop speaking. Say: "Sorry — let me back up."
→ Pause 1 second.
→ Then: "I'm Alex with DriveDrop. We connect carriers directly with shippers — no broker. That's the whole pitch."
→ Then wait.

═══════════════════════════════════════
CALL FLOW
═══════════════════════════════════════

OPENING
You open with the firstMessage provided. After they respond, follow the conversation naturally.
If they say "who is this?" → "Sorry — Alex with DriveDrop. Do you haul cars?"
If they sound rushed → "No worries — ten seconds. You run auto transport?"

WHEN THEY CONFIRM THEY HAUL
Say ONE line. Then stop. Don't add to it:
"Got it. We've got direct shipper loads — no broker in the middle — and payment's guaranteed before pickup."
Wait for their response. What they say next tells you everything.

FOLLOW THEIR LEAD:
- Curious / "how does it work?" → Ask the qualifying question (below)
- "Sounds like a broker" → "Fair one — no. Shippers post directly to the platform, you see the full rate they're paying. No markup."
- "We already have loads" → "Totally — most carriers just add us for lanes their broker doesn't cover."
- "What's the catch?" → "No catch — free to join, zero platform fee for 90 days, then small per-job fee only on completed loads."
- "How do you make money?" → "Free to join, zero TMS and platform fee for 90 days, then a small per-job fee only after completed loads."

QUALIFYING (one question only — pick whichever fits naturally):
"What lanes are you mainly running?"
"How many trucks you got?"
"Mostly open or enclosed?"

GETTING THE EMAIL
Tie it to what they just said:
"Perfect — what's the best email to send you the loads on those lanes and the sign-up link?"
OR: "Mind if I shoot you a one-pager? Takes two minutes — what email should I use?"

IF THEY WANT A TEXT INSTEAD:
"Yeah, totally — is this the best number?"
Then call save_carrier_lead with carrier_phone and carrier_email left empty (include any collected details). The system auto-sends the SMS. Do NOT also call send_sms_link — that would double-text them.

═══════════════════════════════════════
EMAIL CAPTURE — 6 STEPS, STRICT ORDER
═══════════════════════════════════════

Step 1 — SPELL BACK: Read the email back letter by letter.
  Say: "Let me read that back — [spell each letter] at [spell domain] dot com. That right?"
Step 2 — WAIT: Stop talking. Wait for "yes" / "right" / "correct" / "yep" / "uh-huh".
  If they correct you → re-spell the corrected version and wait again.
Step 3 — SAVE: Call save_carrier_lead with the confirmed email + everything collected.
Step 4 — CLOSE: ONLY after save_carrier_lead returns, say:
  "Perfect — appreciate it. I'll send that over now. Stay safe out there."
Step 5 — LOG: Call log_carrier_call_outcome with outcome='interested'.
Step 6 — HANG UP: Call endCall. The call is done.

CRITICAL: Step 4 closing line is ONLY spoken after Step 3 completes.
CRITICAL: Do NOT call save_carrier_lead before receiving verbal confirmation.

═══════════════════════════════════════
DEFLECTIONS & OBJECTIONS
═══════════════════════════════════════

"I'm busy." → "Totally — few seconds: you run auto transport at all?"
"Not interested." → "Totally fine — appreciate your time. Have a good one." → log(not_interested) → endCall
"Send info." → "For sure — what email should I send it to?"
"Is this a broker?" → "No — shippers post directly, you see the exact rate, and payment's guaranteed before pickup."
"We have loads." → "Totally — most carriers just add us for lanes their current broker doesn't reach."
"What's the catch?" → "No catch — free TMS, free to join, 90 days no fee, then a small per-job fee only on completed loads."
Mid-sentence correction ("Yes... wait, no") → Treat correction as final answer. "No worries — appreciate the time. Have a good one." → log(not_interested) → endCall

If they push back twice, let them go. Don't argue.

ALL CALL ENDINGS (hard no, IVR, auto-system):
1. Say exit line: "No problem — appreciate your time. Have a good one."
2. Call log_carrier_call_outcome with the correct outcome.
3. Call endCall — do NOT wait for them to hang up.

CALLBACK REQUESTED:
"Got it — when's a better time? I'll make a note and keep it short." → log(callback_requested) → endCall

VOICEMAIL:
"Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. We work directly with carriers, no broker, payment guaranteed before pickup, and it's free for the first 90 days. If that sounds interesting, give us a call back at 704-937-5246 or check us out at drivedrop.us.com. Have a good one."
→ log(voicemail) → endCall

═══════════════════════════════════════
FACTS — ONLY WHEN ASKED
══════════════════════════════════════��
- Sign-up: drivedrop.us.com/drivers/register — under 5 minutes, free
- Payment: 20% deposit before load is assigned; balance guaranteed on delivery
- Full shipper rate — platform fee does not come out of the carrier's pay
- 0% platform fee for 90 days; small per-job fee only on completed loads after that
- Free tools: TMS, AI route optimizer, multi-stop load planner
- Requirements: active FMCSA registration + cargo insurance
- Coverage: Southeast strongest — all 48 states available
- Phone: (704) 937-5246
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Tools — ONLY the 3 tools Alex actually needs for outbound carrier recruitment.
// Previous setup loaded 11 tools which confused the LLM and caused phantom calls.
//
// Each tool has `messages: [{ type: 'request-start', content: '' }]` which tells
// Vapi to stay silent while the tool executes (no "one moment please" filler).
// ─────────────────────────────────────────────────────────────────────────────
const CARRIER_TOOLS = [
  {
    type: 'function',
    messages: [
      { type: 'request-start', content: '' },
      { type: 'request-failed', content: 'Hmm, had a hiccup on my end — but no worries, I got your info. Appreciate it — stay safe out there.' },
    ],
    function: {
      name: 'save_carrier_lead',
      description:
        "Save carrier contact info after the carrier verbally confirms the email read-back (said 'yes', 'correct', or similar). " +
        "After this succeeds, speak the closing line, then call log_carrier_call_outcome, then endCall. " +
        "Do NOT call this before confirmed read-back.",
      parameters: {
        type: 'object',
        required: ['carrier_phone'],
        properties: {
          carrier_phone:  { type: 'string', description: "Carrier's phone number (the number dialed)" },
          carrier_email:  { type: 'string', description: "Carrier's email — primary goal of the call" },
          contact_name:   { type: 'string', description: 'Name of person spoken to' },
          company_name:   { type: 'string', description: 'Carrier company name' },
          fleet_size:     { type: 'number', description: 'Number of trucks' },
          states_served:  { type: 'string', description: 'States or lanes they operate' },
          vehicle_types:  { type: 'string', description: 'Types hauled (open, enclosed, etc.)' },
          interest_level: { type: 'string', enum: ['hot', 'warm', 'cold'] },
          notes:          { type: 'string', description: 'Other useful context' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [
      { type: 'request-start', content: '' },
      { type: 'request-failed', content: '' },
    ],
    function: {
      name: 'log_carrier_call_outcome',
      description:
        "Log the outcome of this carrier recruitment call. " +
        "Call at the END of every call — after any closing remarks, before endCall. Never mid-conversation.",
      parameters: {
        type: 'object',
        required: ['carrier_phone', 'outcome'],
        properties: {
          carrier_phone: { type: 'string', description: 'The phone number that was called' },
          outcome: {
            type: 'string',
            enum: ['interested', 'not_interested', 'callback_requested', 'no_answer', 'voicemail', 'sent_link'],
            description:
              'interested = got email or agreed to sign up | not_interested = declined | ' +
              'callback_requested = asked to call back | no_answer = nobody picked up or IVR | ' +
              'voicemail = left a voicemail | sent_link = sent SMS/email but no email captured',
          },
          notes:         { type: 'string', description: 'Summary of the conversation' },
          callback_date: { type: 'string', description: 'ISO date if callback requested at specific time' },
          fleet_size:    { type: 'number', description: 'Fleet size if mentioned' },
          states_served: { type: 'string', description: 'Lanes/states mentioned' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [
      { type: 'request-start', content: '' },
      { type: 'request-failed', content: "Text didn't go through — but you can check us out at drivedrop.us.com. Appreciate your time." },
    ],
    function: {
      name: 'send_sms_link',
      description:
        "Send the carrier an SMS with the sign-up link. ONLY when they explicitly ask for a text instead of email. " +
        "If save_carrier_lead was already called with carrier_phone (no email), do NOT also call this.",
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
];

// ─────────────────────────────────────────────────────────────────────────────
// Full assistant payload
// ─────────────────────────────────────────────────────────────────────────────
function buildAssistantPayload() {
  return {
    name: 'Alex — DriveDrop Carrier Recruiter',

    // ── LLM ─────────────────────────────────────────────────────────────────
    // GPT-4o-mini: fast, cheap, excellent tool calling reliability.
    // Previous Groq/Llama caused "unidentified end reason" from malformed tool calls.
    model: {
      provider:    'openai',
      model:       'gpt-4o-mini',
      temperature: 0.6,           // slightly creative for natural conversation
      maxTokens:   300,           // keep responses short — it's a phone call
      messages:    [{ role: 'system', content: CARRIER_PROMPT }],
      tools:       CARRIER_TOOLS,
    },

    // ── Voice: ElevenLabs "Adam" — warm, confident American male ──────────
    voice: {
      provider:        '11labs',
      voiceId:         'pNInz6obpgDQGcFmaJgB', // Adam
      stability:       0.55,     // slightly lower = more expressive/human
      similarityBoost: 0.72,     // matches source voice
      style:           0.08,     // very low = relaxed, natural
      speed:           0.88,     // slightly slower than normal for clarity
      useSpeakerBoost: false,    // off = softer, not "broadcast" quality
    },

    // ── Transcription: Deepgram Nova-2 ────────────────────────────────────
    transcriber: {
      provider:    'deepgram',
      model:       'nova-2',
      language:    'en-US',
      smartFormat: true,         // improves numbers, emails, punctuation
    },

    // ── First message (default — overridden per-call in outbound script) ──
    firstMessageMode: 'assistant-speaks-first',
    firstMessage: "Hey — quick question. Do you guys run auto transport at all?",

    // ── Webhook ───────────────────────────────────────────────────────────
    serverUrl: WEBHOOK_URL,

    // ── Server timeout — CRITICAL for preventing "unidentified" drops ─────
    // Gives your backend up to 40s to process tool calls (Supabase + Twilio + email).
    // Default is ~20s which caused timeouts → call drops.
    server: {
      url:            WEBHOOK_URL,
      timeoutSeconds: 40,
    },

    // ── Call behavior ────────────────────────────────────────────────────
    endCallFunctionEnabled:       true,   // Alex can hang up
    recordingEnabled:             true,   // Record every call
    maxDurationSeconds:           300,    // 5 min max

    // ── Conversation quality settings ────────────────────────────────────
    backchannelingEnabled:        true,   // "mm-hmm" while they speak
    responseDelaySeconds:         0.6,    // natural breathing room
    numWordsToInterruptAssistant: 2,      // easy to cut in

    backgroundSound:              'office', // subtle background hum

    // ── Silence & idle — RELAXED to prevent premature hangups ────────────
    // Previous: 25-35s silence → hangup. Carriers put you on hold, pause to think.
    silenceTimeoutSeconds:        45,     // 45s before auto-hangup

    messagePlan: {
      idleMessages:              ['You still with me?'],
      idleMessageMaxSpokenCount: 1,       // say it at most once per call
      idleTimeoutSeconds:        25,      // nudge after 25s silence (was 12s — too pushy)
    },

    // ── Voicemail detection ────────────────────────────────────────────────
    voicemailDetection: {
      provider:                'twilio',
      enabled:                 true,
      voicemailDetectionTypes: ['machine_end_beep', 'machine_end_silence'],
    },
    voicemailMessage:
      "Hey, this is Alex with DriveDrop — vehicle transport marketplace out of Charlotte. " +
      "We work directly with carriers, no broker, payment guaranteed before pickup, " +
      "free for the first 90 days. Give us a call back at 704-937-5246 or check drivedrop.us.com. " +
      "Have a good one.",

    // ── Metadata ──────────────────────────────────────────────────────────
    metadata: {
      campaign: 'carrier_recruitment',
      platform: 'vapi',
      version:  '2.0',   // v2 = stable rewrite
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-flight check: verify the webhook endpoint is reachable
// ─────────────────────────────────────────────────────────────────────────────
async function checkWebhook() {
  console.log(`\n🔍  Pre-flight: checking webhook → ${WEBHOOK_URL}`);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { type: 'health-check' } }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      console.log('   ✅  Webhook is reachable and responding');
      return true;
    }
    console.warn(`   ⚠️  Webhook responded with ${res.status} — may still work (Vapi sends different payload)`);
    return true; // non-200 is ok, as long as it's reachable
  } catch (err) {
    console.error(`   ❌  Webhook unreachable: ${err.message}`);
    console.error('');
    console.error('   Common fixes:');
    console.error('   1. Make sure your Railway backend is deployed and running');
    console.error('   2. Check API_URL in .env matches your Railway URL');
    console.error(`   3. Test manually: curl -X POST ${WEBHOOK_URL} -H "Content-Type: application/json" -d '{"message":{"type":"test"}}'`);
    console.error('');
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — create or update the assistant
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DriveDrop — Vapi Voice Agent Setup v2.0');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Webhook  : ${WEBHOOK_URL}`);
  console.log(`  Phone ID : ${PHONE_NUMBER_ID || '(not set — outbound only via script)'}`);
  console.log('');

  // ── Step 0: Check webhook health ────────────────────────────────────────
  const webhookOk = await checkWebhook();
  if (!webhookOk) {
    console.error('   Continuing anyway — but calls may fail if webhook is down.\n');
  }

  // ── Step 1: Check for existing assistant ────────────────────────────────
  const existingId = process.env.VAPI_ASSISTANT_ID;
  let assistantId = null;

  if (existingId) {
    console.log(`\n1️⃣   VAPI_ASSISTANT_ID found in .env: ${existingId}`);
    console.log('    Attempting to update existing assistant...');
    try {
      const updated = await vapi(`/assistant/${existingId}`, 'PATCH', buildAssistantPayload());
      assistantId = updated.id;
      console.log(`    ✅  Updated existing assistant: ${assistantId}`);
    } catch (err) {
      console.warn(`    ⚠️  Could not update (${err.message}) — creating new one.`);
    }
  }

  if (!assistantId) {
    // Check if an "Alex" assistant already exists in the account
    console.log('\n1️⃣   Checking for existing Alex assistant in Vapi...');
    try {
      const assistants = await vapi('/assistant?limit=100', 'GET');
      const existing = Array.isArray(assistants)
        ? assistants.find(a =>
            a.name?.includes('Alex') &&
            a.name?.includes('DriveDrop') ||
            a.name?.includes('Carrier Recruiter'))
        : null;

      if (existing) {
        console.log(`    Found: "${existing.name}" (${existing.id}) — updating...`);
        const updated = await vapi(`/assistant/${existing.id}`, 'PATCH', buildAssistantPayload());
        assistantId = updated.id;
        console.log(`    ✅  Updated: ${assistantId}`);
      }
    } catch (err) {
      console.warn(`    ⚠️  Could not list assistants: ${err.message}`);
    }
  }

  if (!assistantId) {
    console.log('\n    Creating new Alex assistant...');
    const created = await vapi('/assistant', 'POST', buildAssistantPayload());
    assistantId = created.id;
    console.log(`    ✅  Created: ${assistantId}`);
  }

  // ── Step 2: Verify the assistant ────────────────────────────────────────
  console.log('\n2️⃣   Verifying assistant configuration...');
  const assistant = await vapi(`/assistant/${assistantId}`, 'GET');
  console.log(`    Name    : ${assistant.name}`);
  console.log(`    LLM     : ${assistant.model?.provider} / ${assistant.model?.model}`);
  console.log(`    Voice   : ${assistant.voice?.provider} / ${assistant.voice?.voiceId}`);
  console.log(`    Webhook : ${assistant.serverUrl || assistant.server?.url || '(not set)'}`);
  console.log(`    Tools   : ${assistant.model?.tools?.length || 0} functions`);
  console.log(`    Max dur : ${assistant.maxDurationSeconds}s`);
  console.log(`    Silence : ${assistant.silenceTimeoutSeconds}s`);

  // ── Step 3: Optionally assign to phone number ───────────────────────────
  if (PHONE_NUMBER_ID) {
    console.log(`\n3️⃣   Assigning to phone number ${PHONE_NUMBER_ID}...`);
    try {
      await vapi(`/phone-number/${PHONE_NUMBER_ID}`, 'PATCH', {
        assistantId,
        serverUrl: WEBHOOK_URL,
      });
      console.log('    ✅  Phone number configured for inbound → Alex');
    } catch (err) {
      console.warn(`    ⚠️  Could not assign phone number: ${err.message}`);
      console.warn('    (Outbound calls via script will still work)');
    }
  } else {
    console.log('\n3️⃣   No VAPI_PHONE_NUMBER_ID set — skipping phone assignment.');
    console.log('    (Outbound calls via vapi-outbound-call.js will still work)');
  }

  // ── Done ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅  SETUP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Add this to backend/.env AND Railway environment:');
  console.log('');
  console.log(`    VAPI_ASSISTANT_ID=${assistantId}`);
  console.log('');
  console.log('  View in dashboard:');
  console.log(`    https://dashboard.vapi.ai/assistants/${assistantId}`);
  console.log('');
  console.log('  Next steps:');
  console.log('    1. Add VAPI_ASSISTANT_ID to backend/.env');
  console.log('    2. Add VAPI_ASSISTANT_ID to Railway env vars');
  console.log('    3. Test: node backend/scripts/vapi-outbound-call.js');
  console.log('       (uncomment your number first as TEST)');
  console.log('');
  console.log('  What changed from v1:');
  console.log('    • LLM: Groq/Llama → OpenAI gpt-4o-mini (reliable tool calling)');
  console.log('    • Tools: 11 → 3 (carrier-only — no confused phantom calls)');
  console.log('    • Webhook timeout: default → 40s (no more premature drops)');
  console.log('    • Silence timeout: 25s → 45s (carriers can pause/hold)');
  console.log('    • Idle nudge: 12s → 25s (less robotic)');
  console.log('    • Tool failure messages (graceful instead of crashing)');
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Setup failed:', err.message);
  console.error('');
  console.error('Common fixes:');
  console.error('  1. Check VAPI_API_KEY is correct in backend/.env');
  console.error('  2. Check your Vapi account is active at dashboard.vapi.ai');
  console.error('  3. If 401 error: regenerate your API key at dashboard.vapi.ai → API Keys');
  console.error('');
  process.exit(1);
});