/**
 * Buy a Retell-managed 704 (Charlotte, NC) phone number and assign Alex to it.
 *
 * Run AFTER adding a payment method to your Retell account:
 *   dashboard.retellai.com → Settings → Billing → Add Payment Method
 *
 * Then run:
 *   node backend/scripts/retell-buy-number.js
 *
 * After running:
 *   - Copy the RETELL_PHONE_NUMBER printed at the end into backend/.env
 *   - Also add it to Railway environment variables
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

if (!RETELL_API_KEY)  { console.error('❌  RETELL_API_KEY missing from backend/.env'); process.exit(1); }
if (!RETELL_AGENT_ID) { console.error('❌  RETELL_AGENT_ID missing — run setup-retell-agent.js first'); process.exit(1); }

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

async function main() {
  console.log('📞  Buying Retell phone number (area code 704 — Charlotte, NC)...\n');

  const phone = await retell('/create-phone-number', 'POST', {
    area_code:    704,
    nickname:     'Alex — DriveDrop Carrier Recruiter',
    outbound_agents: [{ agent_id: RETELL_AGENT_ID, weight: 1 }],
    inbound_agents:  [{ agent_id: RETELL_AGENT_ID, weight: 1 }],
    allowed_outbound_country_list: ['US', 'CA'],
    allowed_inbound_country_list:  ['US', 'CA'],
  });

  console.log(`✅  Number purchased: ${phone.phone_number}  (${phone.phone_number_pretty})`);
  console.log(`   Type    : ${phone.phone_number_type}`);
  console.log(`   Agent   : ${RETELL_AGENT_ID}`);

  console.log('\n' + '═'.repeat(60));
  console.log('  Add this to backend/.env AND Railway env variables:');
  console.log('═'.repeat(60));
  console.log(`RETELL_PHONE_NUMBER=${phone.phone_number}`);
  console.log('═'.repeat(60));
  console.log('\nNext step:  node backend/scripts/retell-outbound-call.js');
}

main().catch(err => {
  if (err.message.includes('card on file') || err.message.includes('payment')) {
    console.error('❌  No payment method on file.');
    console.error('   ➜  Go to dashboard.retellai.com → Settings → Billing → Add Payment Method');
    console.error('   ➜  Then re-run this script.');
  } else {
    console.error('❌  Error:', err.message);
  }
  process.exit(1);
});
