/**
 * Direct Brevo send test — bypasses the Express server entirely.
 * Confirms API key, sender domain, and IP authorization are all valid.
 */
require('dotenv').config();

const apiKey = process.env['BREVO_API_KEY'];
const sender = process.env['BREVO_OUTREACH_SENDER'] || 'carrier@drivedrop.us.com';

console.log('API key prefix:', apiKey?.slice(0, 20) + '…');
console.log('Sender        :', sender);
console.log('Target        : brunondenzi80@gmail.com');
console.log('Calling Brevo …\n');

fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': apiKey,
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
  body: JSON.stringify({
    sender: { name: 'DriveDrop Carrier Team', email: sender },
    to: [{ email: 'brunondenzi80@gmail.com', name: 'Bruno' }],
    subject: '[TEST] New shipment opportunities – DriveDrop',
    htmlContent: [
      '<h2>Hello Bruno!</h2>',
      '<p>This is a <strong>live test email</strong> from the DriveDrop outreach system.</p>',
      '<p>If you received this, Brevo delivery is confirmed working end-to-end.</p>',
      '<p style="color:#888;font-size:12px;">Sent via DriveDrop carrier outreach pipeline.</p>',
    ].join(''),
    textContent: 'Hello Bruno — live test from the DriveDrop outreach system. If you received this, delivery is working.',
    tags: ['test', 'outreach-verification'],
  }),
})
  .then(async (r) => {
    const body = await r.json().catch(() => ({}));
    if (r.status === 201) {
      console.log('✅ Email sent successfully!');
      console.log('   Message ID:', body.messageId);
    } else {
      console.error('❌ Brevo returned HTTP', r.status);
      console.error(JSON.stringify(body, null, 2));
    }
  })
  .catch((e) => console.error('Network error:', e.message));
