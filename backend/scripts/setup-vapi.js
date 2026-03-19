/**
 * One-time Vapi setup script
 * Creates/updates the DriveDrop-Benji assistant and assigns it to your phone number.
 * Run: node backend/scripts/setup-vapi.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const VAPI_API_KEY     = process.env.VAPI_API_KEY;
const PHONE_NUMBER_ID  = process.env.VAPI_PHONE_NUMBER_ID;
const API_URL          = process.env.API_URL || 'https://drivedrop-main-production.up.railway.app';
const SERVER_URL       = `${API_URL}/api/v1/voice/webhook`;

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

const SYSTEM_PROMPT = `
You are Benji, DriveDrop's friendly 24/7 voice assistant. DriveDrop is a vehicle transport marketplace based in Charlotte, NC.

KEY FACTS:
- Website: www.drivedrop.us.com | Carrier sign-up: www.drivedrop.us.com/drivers/register
- Clients book & pay upfront, DriveDrop assigns a verified FMCSA-registered driver, vehicle is transported with GPS tracking, delivered with photo proof
- Shipment statuses: pending → driver assigned → driver en route → driver arrived → picked up → in transit → delivered
- Typical pricing: Sedan $150-800, SUV/pickup 10-15% more, Luxury +50%, Motorcycle $150-500, Expedited +25%
- Cancellation: full refund before driver assigned, $50 fee after assignment, no refund once picked up
- All drivers are FMCSA-registered, background-checked, carry cargo insurance

PERSONALITY:
- Warm and natural — sound like a real person, not a robot
- Keep answers short — this is a voice call
- Use contractions (I'm, we'll, you'll)
- Never read out URLs — say "I'll text you the link right now"
- If you can't help, offer to connect them with the team

When a client calls: greet warmly, ask how you can help, use tools to look up live data, confirm satisfaction before ending.
`.trim();

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_shipment_status',
      description: 'Look up shipment status by client phone number or name.',
      parameters: { type: 'object', properties: {
        phone: { type: 'string', description: "Client phone number" },
        name:  { type: 'string', description: "Client full name" },
      }},
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_price_quote',
      description: 'Get a shipping price quote.',
      parameters: { type: 'object', required: ['pickup_location','delivery_location','vehicle_type'], properties: {
        pickup_location:   { type: 'string' },
        delivery_location: { type: 'string' },
        vehicle_type:      { type: 'string', enum: ['sedan','suv','pickup','luxury','motorcycle','heavy'] },
        is_operable:       { type: 'boolean' },
      }},
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_sms_link',
      description: 'Send an SMS link to the caller.',
      parameters: { type: 'object', required: ['to_phone','link_type'], properties: {
        to_phone:    { type: 'string' },
        link_type:   { type: 'string', enum: ['signup','tracking','navigation','app_download'] },
        shipment_id: { type: 'string' },
      }},
    },
  },
];

async function main() {
  console.log('🔧  DriveDrop Vapi Setup');
  console.log(`   Server URL → ${SERVER_URL}`);
  console.log(`   Phone ID   → ${PHONE_NUMBER_ID}\n`);

  // 1. Check if DriveDrop-Benji already exists (or the old DriveDrop-Maya to upgrade)
  console.log('1. Checking for existing DriveDrop-Benji assistant...');
  const assistants = await vapi('/assistant?limit=100', 'GET');
  const existing = Array.isArray(assistants) ? assistants.find(a => a.name === 'DriveDrop-Benji' || a.name === 'DriveDrop-Maya') : null;

  const payload = {
    name:      'DriveDrop-Benji',
    voice:     { provider: 'openai', voiceId: 'shimmer' },
    serverUrl: SERVER_URL,
    model: {
      provider: 'openai',
      model:    'gpt-4o',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
      tools:    TOOLS,
    },
    firstMessage: "Hi, you've reached DriveDrop! I'm Benji. How can I help you today — are you looking to ship a vehicle, or checking on an existing order?",
    endCallFunctionEnabled: true,
    recordingEnabled:       true,
    maxDurationSeconds:     600,
  };

  let assistantId;
  if (existing) {
    console.log(`   Found existing assistant: ${existing.id} — updating...`);
    const updated = await vapi(`/assistant/${existing.id}`, 'PATCH', payload);
    assistantId = updated.id;
    console.log(`✅  Updated → DriveDrop-Benji (${assistantId})`);
  } else {
    console.log('   No existing assistant — creating new...');
    const created = await vapi('/assistant', 'POST', payload);
    assistantId = created.id;
    console.log(`✅  Created DriveDrop-Benji (${assistantId})`);
  }

  // 2. Assign assistant + server URL to the phone number
  console.log(`\n2. Assigning Benji to phone number ${PHONE_NUMBER_ID}...`);
  await vapi(`/phone-number/${PHONE_NUMBER_ID}`, 'PATCH', {
    assistantId,
    serverUrl: SERVER_URL,
  });
  console.log('✅  Phone number configured\n');

  console.log('🎉  Setup complete!');
  console.log(`   Assistant ID: ${assistantId}`);
  console.log(`   Phone number +1 (704) 937-5246 → Benji assistant`);
  console.log(`   Webhook: ${SERVER_URL}`);
  console.log('\n📞  Call +1 (704) 937-5246 to test!');
}

main().catch(err => {
  console.error('❌  Setup failed:', err.message);
  process.exit(1);
});
