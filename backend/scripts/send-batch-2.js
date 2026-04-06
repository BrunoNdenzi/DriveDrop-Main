/**
 * Batch 2 — Carrier Outreach (22 fresh carriers from CSV batch)
 * Sender: carrier@drivedrop.us.com (via Brevo API)
 * Usage:
 *   node backend/scripts/send-batch-2.js              ← live send
 *   node backend/scripts/send-batch-2.js --dry-run    ← preview only
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const DRY_RUN  = process.argv.includes('--dry-run');
const DELAY_MS = 4000; // 4s between sends
const BASE_URL = 'https://www.drivedrop.us.com';

// ─── 22 fresh carriers from FMCSA CSV (batch 1 excluded) ───────────────────
const CARRIERS = [
  { companyName: 'Day One Auto Transport LLC',          city: 'Cocoa',              state: 'FL', email: 'matt@roadrunnerautotransport.com' },
  { companyName: 'Rightaway Auto Carriers Inc',         city: 'Westampton',         state: 'NJ', email: 'paul@wrightwayautocarriers.com' },
  { companyName: 'Acme Auto Transport LLC',             city: 'Brunswick',          state: 'GA', email: 'scott@acmecarshipping.com' },
  { companyName: 'E-Man Auto Transportation',           city: 'Cincinnati',         state: 'OH', email: 'info@rapidautoshipping.com' },
  { companyName: "Tom's Auto Transport Inc",            city: 'Dallas',             state: 'TX', email: 'info@tomsautotransport.net' },
  { companyName: 'E & S Auto Transport Services',       city: 'Orlando',            state: 'FL', email: 'craig@eshiptransport.com' },
  { companyName: 'Performance Auto Carrier Inc',        city: 'Chesapeake',         state: 'VA', email: 'info@performanceautocarrier.com' },
  { companyName: 'Classic Car Carrier Inc',             city: 'Elkridge',           state: 'MD', email: 'tsleeman@reliablecarriers.com' },
  { companyName: 'Franco Auto Transport Inc',           city: 'Baldwin Park',       state: 'CA', email: 'customerservice@frankstransport.com' },
  { companyName: 'Choice One Auto Transport',           city: 'Stanwood',           state: 'MI', email: 'info@otrucking.com' },
  { companyName: 'Guaranteed Auto Transport LLC',       city: 'Indianapolis',       state: 'IN', email: 'chriss@asaptransportsolutions.com' },
  { companyName: 'Vision Auto Transporters Inc',        city: 'Marietta',           state: 'GA', email: 'aruiz@visionautotransport.com' },
  { companyName: 'S3 Auto Transport Corp',              city: 'Saint Cloud',        state: 'FL', email: 'admin@s3autotrans.com' },
  { companyName: 'All-States Auto Transport',           city: 'Lehigh Acres',       state: 'FL', email: 'sales@all-statesautotransport.com' },
  { companyName: 'Speed Auto Transporters LLC',         city: 'Sainte Genevieve',   state: 'MO', email: 'sales@speedycarshipping.com' },
  { companyName: 'Majestic Auto Transport Inc',         city: 'Huntington Station', state: 'NY', email: 'info@majestictrucklines.com' },
  { companyName: 'Best In West Auto Transport LLC',     city: 'Granada Hills',      state: 'CA', email: 'info@westcoastautotransport.com' },
  { companyName: 'All South Auto Transport LLC',        city: 'Moncks Corner',      state: 'SC', email: 'info@southwestautotransport.com' },
  { companyName: 'Get It Done Auto Transport',          city: 'Buena Park',         state: 'CA', email: 'joseph@getitdonetransportation.com' },
  { companyName: 'Large Car Transport Inc',             city: 'Poughkeepsie',       state: 'NY', email: 'info@wichitacartransport.com' },
  { companyName: 'South Beach Auto Transport Inc',      city: 'Pembroke Pines',     state: 'FL', email: 'nicole@southbeachtransport.com' },
  { companyName: 'USA Auto Transport LLC',              city: 'Peoria',             state: 'AZ', email: 'info@usa-autotransport.com' },
];

// ─── Email builder ──────────────────────────────────────────────────────────
function buildEmail(carrier) {
  const { companyName, state, email } = carrier;
  const utmParams  = 'utm_source=email&utm_medium=outreach&utm_campaign=carrier_batch2';
  const unsubUrl   = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}&src=carrier_batch2`;
  const ctaUrl     = `${BASE_URL}/drivers/register?${utmParams}`;
  const subject    = `${companyName}: more loads, zero broker fees — DriveDrop`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
  body{margin:0;padding:0;background:#F4F4F4;font-family:Arial,sans-serif;}
  .wrap{max-width:600px;margin:0 auto;background:#fff;}
  .hdr{background:#00B8A9;padding:24px 32px;text-align:center;}
  .hdr h1{color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:1px;}
  .body{padding:32px;color:#333;font-size:15px;line-height:1.7;}
  .body h2{color:#00B8A9;margin-top:0;font-size:18px;}
  .cta{display:block;width:220px;margin:24px auto;padding:14px 28px;background:#FF9800;color:#fff!important;text-decoration:none;text-align:center;border-radius:6px;font-weight:700;font-size:15px;}
  .ftr{background:#F9F9F9;padding:20px 32px;font-size:12px;color:#999;text-align:center;border-top:1px solid #EEE;}
  .ftr a{color:#00B8A9;text-decoration:none;}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>DriveDrop</h1></div>
  <div class="body">
    <h2>Hey ${companyName} 👋</h2>
    <p>We help auto transport carriers${state ? ` in ${state}` : ''} get more vehicle shipments — <strong>direct from shippers, with no broker in the middle taking a cut.</strong></p>
    <div style="background:#F0FAFA;border-left:4px solid #00B8A9;border-radius:4px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:14px;font-weight:bold;color:#00897B;">Everything below is 100% free for carriers:</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EEE;width:28px;vertical-align:top;">🚗</td><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;"><strong>Direct shipper jobs</strong> — you keep the full rate, we charge a small platform fee only on completion</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;">💰</td><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;"><strong>Guaranteed payments</strong> — collected upfront before you move</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;">🗺️</td><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;"><strong>Free AI route planner</strong> — multi-stop route optimizer built in</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;">📋</td><td style="padding:10px 0;border-bottom:1px solid #EEE;vertical-align:top;"><strong>Free TMS</strong> — digital BOLs, inspections, job management &amp; earnings in one place</td></tr>
      <tr><td style="padding:10px 0;vertical-align:top;">⭐</td><td style="padding:10px 0;vertical-align:top;"><strong>First 90 days: 0% platform fee</strong> for new carriers</td></tr>
    </table>
    <p style="font-size:14px;">Takes <strong>under 5 minutes</strong> to sign up. No credit card. No commitment.</p>
    <a href="${ctaUrl}" class="cta">Join DriveDrop Free →</a>
    <p style="font-size:13px;color:#888;margin-top:20px;">Questions? Just reply to this email — we respond fast.</p>
  </div>
  <div class="ftr">
    <p>DriveDrop &middot; Charlotte, NC<br/>
    You're receiving this because your company appears in FMCSA carrier records.<br/>
    <a href="${unsubUrl}">Unsubscribe</a> &nbsp;|&nbsp; <a href="${BASE_URL}">Visit DriveDrop</a></p>
  </div>
</div>
</body></html>`;

  const textContent = `Hey ${companyName},

DriveDrop connects auto transport carriers${state ? ` in ${state}` : ''} directly with shippers — no broker middlemen.

FREE for carriers:
• Direct shipper jobs — keep the full rate
• Guaranteed upfront payments
• Free AI route planner (multi-stop optimizer)
• Free TMS: digital BOLs, inspections, job management
• First 90 days: 0% platform fee

Takes under 5 minutes to sign up. No credit card.

Join now: ${ctaUrl}

Questions? Reply to this email.
Unsubscribe: ${unsubUrl}`;

  return { subject, htmlContent, textContent };
}

async function sendEmail(apiKey, from, fromName, carrier) {
  const { subject, htmlContent, textContent } = buildEmail(carrier);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender:      { name: fromName, email: from },
      to:          [{ email: carrier.email, name: carrier.companyName }],
      subject,
      htmlContent,
      textContent,
      tags:        ['carrier-outreach', 'batch-2'],
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, messageId: body.messageId, error: body.message };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const apiKey   = process.env['BREVO_API_KEY'];
  const from     = process.env['BREVO_OUTREACH_SENDER'] || 'carrier@drivedrop.us.com';
  const fromName = process.env['BREVO_OUTREACH_NAME']   || 'DriveDrop Carrier Team';

  if (!apiKey) { console.error('❌  BREVO_API_KEY not set'); process.exit(1); }

  console.log('\n' + '═'.repeat(64));
  console.log('  DriveDrop — Carrier Outreach Batch 2');
  console.log('═'.repeat(64));
  console.log(`  From   : ${fromName} <${from}>`);
  console.log(`  Count  : ${CARRIERS.length} carriers`);
  console.log(`  Mode   : ${DRY_RUN ? '🔍 DRY RUN (no emails sent)' : '🚀 LIVE SEND'}`);
  console.log('═'.repeat(64) + '\n');

  const results = [];

  for (let i = 0; i < CARRIERS.length; i++) {
    const carrier = CARRIERS[i];
    const tag = `[${i + 1}/${CARRIERS.length}]`;

    if (DRY_RUN) {
      console.log(`${tag} 🔍 ${carrier.companyName} (${carrier.state})`);
      console.log(`      → ${carrier.email}`);
      results.push({ ...carrier, status: 'dry-run' });
      continue;
    }

    process.stdout.write(`${tag} → ${carrier.companyName} <${carrier.email}> … `);
    try {
      const r = await sendEmail(apiKey, from, fromName, carrier);
      if (r.status === 201) {
        console.log(`✅  sent  (${r.messageId})`);
        results.push({ ...carrier, status: 'sent', messageId: r.messageId });
      } else {
        console.log(`❌  HTTP ${r.status}  ${r.error}`);
        results.push({ ...carrier, status: 'failed', error: r.error });
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      results.push({ ...carrier, status: 'error', error: err.message });
    }

    if (i < CARRIERS.length - 1) await sleep(DELAY_MS);
  }

  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status !== 'sent' && r.status !== 'dry-run').length;

  console.log('\n' + '═'.repeat(64));
  if (DRY_RUN) {
    console.log(`  ✅  ${results.length} previewed (dry run — nothing sent)`);
  } else {
    console.log(`  ✅  Sent   : ${sent}`);
    if (failed) {
      console.log(`  ❌  Failed : ${failed}`);
      results.filter(r => r.status !== 'sent').forEach(r =>
        console.log(`       - ${r.companyName} <${r.email}> → ${r.error}`));
    }
  }
  console.log('\n  📊  Monitor: https://app.brevo.com/transactional-email/logs');
  console.log('═'.repeat(64) + '\n');
})();
