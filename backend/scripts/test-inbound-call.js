/**
 * Inbound experience test — simulates a client calling DriveDrop's line.
 * Benji answers as if the call was received on the DriveDrop number.
 *
 * Test scenarios to try when the call connects:
 *   1. "I want to ship my car from Charlotte to Atlanta"  → full booking flow
 *   2. "What's going on with my shipment?" [give a name] → status lookup
 *   3. "How much to move a 2022 Ford F-150 from NC to FL?" → price quote
 *   4. "I need to cancel my order" → cancellation policy
 *   5. "Can you send me the tracking link?" → SMS link test
 *
 * Run:  node backend/scripts/test-inbound-call.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY    = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;
const API_URL         = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL      = `${API_URL}/api/v1/voice/webhook`;

// The phone to call — whoever picks up will experience the Benji inbound persona
const TEST_PHONE = '+17045247921';

if (!VAPI_API_KEY || !PHONE_NUMBER_ID) {
  console.error('❌  VAPI_API_KEY and VAPI_PHONE_NUMBER_ID must be set in .env');
  process.exit(1);
}

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

// ── Benji inbound persona (mirrors VoiceAgentService client_support) ──────────
const BENJI_PROMPT = `
Your name is Benji, and you're DriveDrop's 24/7 client support voice assistant. DriveDrop is a vehicle transport marketplace based in Charlotte, NC. When clients call, you help them with anything related to shipping their vehicle.

Your goal: Help clients with tracking, quotes, booking, cancellations, payments, or general questions. Always sound like a calm, knowledgeable friend — not a robot support agent.

When a client calls:
1. Greet them warmly and ask how you can help.
2. If they mention a shipment, ask for their name or phone number to look it up.
3. Use the available tools to pull live data from the system.
4. Answer their question clearly, confirm they're satisfied, then end naturally.

BOOKING A SHIPMENT:
Follow these steps in order — never skip any:
1. Run get_price_quote first. You need: pickup location, delivery location, vehicle type.
2. Collect all details (one or two at a time, conversationally):
   - Full pickup address (city & state minimum)
   - Full delivery address (city & state minimum)
   - Vehicle year, make, and model (e.g. "2019 Ford F-150")
   - Vehicle type (sedan/SUV/pickup/luxury/motorcycle/heavy)
   - Is the vehicle operable? Default yes.
   - Their full name
   - Their email address (for confirmation — always verify verbally)
   - Their phone number
   - Preferred pickup date (optional)
3. Read back ALL details before booking: "Just to confirm — I'd be booking a [year] [make] [model] from [pickup] to [delivery], around [X] miles. Quoted price is $[quote]. Name: [name], confirmation to [email]. Does everything sound right?"
4. ONLY after explicit "yes" / "go ahead" / "confirmed" — call create_shipment.
5. Immediately after create_shipment succeeds, call send_confirmation_email.
6. Tell them: "You're all set! Booking reference is [first 8 of shipment_id], and I've sent a confirmation to [email]. We'll reach out as soon as a driver is assigned. Anything else?"

IMPORTANT rules:
- NEVER call create_shipment without explicit verbal approval.
- NEVER guess or assume the email — always confirm it verbally.
- If create_shipment fails: "Something didn't save on my end — you can book at drivedrop.us.com or I can have someone follow up."

Things you CAN do:
- Shipment status lookups
- Price quotes
- Book new shipments (with approval)
- Explain cancellation + refund policy
- Send SMS tracking/signup links
- Escalate to a human for damage claims, disputes, billing

Things you CANNOT do (escalate):
- Process refunds directly
- Handle active damage disputes
- Access payment card details
- Change a shipment already in transit

Escalate with: "Let me connect you with one of our team members — they'll be with you shortly."

TOOL FAILURES — never let them derail the call:
- get_price_quote fails → use ballpark: Sedan $200-450 under 600mi, $450-800 cross-country. SUV/truck +15%. Luxury +50%. Non-operable +35-50%. Say: "Our quote tool is having a moment — typically you're looking at around $[X]. Want me to have someone confirm the exact number?"
- get_shipment_status fails → "I'm having trouble pulling that up right now. Try drivedrop.us.com/track or call back in a few minutes."
- send_sms_link fails → NEVER say the text went through if it didn't. Say: "That didn't go through on my end — you can grab it at drivedrop.us.com, or give me your email."
- create_shipment fails → "Something went sideways — the booking didn't save. Book at drivedrop.us.com or give me your contact and someone will follow up within the hour."

NEVER confirm an action a tool reported as failed. Be honest, then offer an alternative immediately.

Cancellation policy:
- Before driver assigned: full refund
- After driver assigned, before pickup: $50 cancellation fee
- After pickup: no refund

Speech style:
- Warm, relaxed, genuine — like a knowledgeable friend
- Short turns — 1-3 sentences, then check in
- Use contractions (I'm, we'll, you'll)
- Never read URLs aloud — say "I'll send you the link by text"
- Acknowledge feelings first, then solve: "Got it — that sounds stressful. Let me pull that up right now."

Key facts (only answer when asked):
- Website: drivedrop.us.com | Carrier sign-up: drivedrop.us.com/drivers/register
- Clients pay upfront, DriveDrop assigns a verified FMCSA driver, delivered with GPS tracking and photo proof
- Typical transit: 1-7 days depending on distance
- Phone: (704) 937-5246
`.trim();

// ── Tools (full set matching the live webhook handler) ────────────────────────
const BENJI_TOOLS = [
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'get_shipment_status',
      description: 'Look up the current status of a shipment by client phone number or name.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: "Client's phone number" },
          name:  { type: 'string', description: "Client's full name or company name" },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'get_price_quote',
      description: 'Calculate a shipping price quote between two locations for a specific vehicle type.',
      parameters: {
        type: 'object',
        required: ['pickup_location', 'delivery_location', 'vehicle_type'],
        properties: {
          pickup_location:   { type: 'string', description: 'Pickup city, state or full address' },
          delivery_location: { type: 'string', description: 'Delivery city, state or full address' },
          vehicle_type:      { type: 'string', enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'heavy'] },
          is_operable:       { type: 'boolean', description: 'Whether the vehicle drives. Default true.' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'create_shipment',
      description: 'Book a new shipment after the client has explicitly confirmed all details.',
      parameters: {
        type: 'object',
        required: ['client_name', 'client_email', 'client_phone', 'pickup_address', 'delivery_address', 'vehicle_type', 'vehicle_make', 'vehicle_model', 'vehicle_year', 'quote_amount', 'distance_miles'],
        properties: {
          client_name:      { type: 'string' },
          client_email:     { type: 'string' },
          client_phone:     { type: 'string' },
          pickup_address:   { type: 'string' },
          delivery_address: { type: 'string' },
          vehicle_type:     { type: 'string', enum: ['sedan', 'suv', 'pickup', 'luxury', 'motorcycle', 'heavy'] },
          vehicle_make:     { type: 'string' },
          vehicle_model:    { type: 'string' },
          vehicle_year:     { type: 'number' },
          vehicle_vin:      { type: 'string' },
          is_operable:      { type: 'boolean' },
          quote_amount:     { type: 'number' },
          distance_miles:   { type: 'number' },
          pickup_date:      { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'send_confirmation_email',
      description: 'Send a booking confirmation email after create_shipment succeeds.',
      parameters: {
        type: 'object',
        required: ['shipment_id', 'client_email', 'client_name'],
        properties: {
          shipment_id:  { type: 'string' },
          client_email: { type: 'string' },
          client_name:  { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    messages: [{ type: 'request-start', content: '' }],
    function: {
      name: 'send_sms_link',
      description: 'Send an SMS with a tracking link, sign-up link, or app download link.',
      parameters: {
        type: 'object',
        required: ['to_phone', 'link_type'],
        properties: {
          to_phone:    { type: 'string' },
          link_type:   { type: 'string', enum: ['signup', 'tracking', 'navigation', 'app_download'] },
          shipment_id: { type: 'string' },
        },
      },
    },
  },
];

async function main() {
  console.log(`\n📞  Firing inbound experience test → ${TEST_PHONE}`);
  console.log(`   Webhook : ${SERVER_URL}`);
  console.log(`   Persona : Benji (client_support)\n`);
  console.log(`   Test scenarios to try:`);
  console.log(`   1. "I want to ship my car from Charlotte to Atlanta"`);
  console.log(`   2. "What's going on with my shipment?" [give a name]`);
  console.log(`   3. "How much to move a 2022 Ford F-150 from NC to FL?"`);
  console.log(`   4. "I need to cancel my order"`);
  console.log(`   5. "Can you send me the tracking link?"\n`);

  const call = await vapi('/call', 'POST', {
    phoneNumberId: PHONE_NUMBER_ID,
    customer: { number: TEST_PHONE, name: 'Inbound Test Client' },
    assistant: {
      name: 'Benji',
      voice: {
        provider:        '11labs',
        voiceId:         'EXAVITQu4vr4xnSDxMaL', // ElevenLabs "Bella" — warm, friendly female
        stability:       0.65,
        similarityBoost: 0.80,
        style:           0.15,
        speed:           0.95,
        useSpeakerBoost: false,
      },
      serverUrl: SERVER_URL,
      model: {
        provider:    'groq',
        model:       'llama-3.3-70b-versatile',
        temperature: 0.65,
        messages:    [{ role: 'system', content: BENJI_PROMPT }],
        tools:       BENJI_TOOLS,
      },
      firstMessage: "Hi, you've reached DriveDrop! I'm Benji — how can I help you today?",
      endCallFunctionEnabled:       true,
      recordingEnabled:             true,
      maxDurationSeconds:           600,
      backchannelingEnabled:        true,
      responseDelaySeconds:         0.3,
      numWordsToInterruptAssistant: 2,
      backgroundSound:              'off',   // clean — inbound is an office call
      silenceTimeoutSeconds:        30,
      messagePlan: {
        idleMessages:              ["Still there?", "Hey, you still with me?"],
        idleMessageMaxSpokenCount: 2,
        idleTimeoutSeconds:        15,
      },
      transcriber: {
        provider:    'deepgram',
        model:       'nova-2',
        language:    'en-US',
        smartFormat: true,
      },
    },
    metadata: {
      campaign:  'inbound_test',
      test_mode: true,
    },
  });

  console.log(`✅  Call initiated!`);
  console.log(`   Call ID : ${call.id}`);
  console.log(`   From    : +1 (704) 937-5246`);
  console.log(`   To      : ${TEST_PHONE}`);
  console.log(`\n📋  Check Vapi dashboard → Calls for live transcript.`);
}

main().catch(err => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});
