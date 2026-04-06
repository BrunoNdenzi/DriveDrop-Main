/**
 * Batch Carrier Outreach — Introduction Email
 * Sends the personalized introduction template to 10 real carriers from the CSV.
 * Bypasses the Express server — calls Brevo API directly.
 *
 * Usage:  node scripts/send-batch-outreach.js
 *         node scripts/send-batch-outreach.js --dry-run   (preview only, no sends)
 */
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 3000; // 3 seconds between sends — safe for Brevo warmup

const BASE_URL   = 'https://www.drivedrop.us.com';
const UTM_SOURCE = 'email';

// ─────────────────────────────────────────────────────────────────────────────
// 10 carriers selected from drivedrop_carriers_with_emails.csv
// Criteria: own-domain email, active auto transport business
// ─────────────────────────────────────────────────────────────────────────────
const CARRIERS = [
  {
    companyName: 'Sterling Auto Transport',
    city:  'Gilbert',
    state: 'AZ',
    email: 'corry@sterlingautocarriers.com',
  },
  {
    companyName: 'USA Auto Transport LLC',
    city:  'Peoria',
    state: 'AZ',
    email: 'info@usa-autotransport.com',
  },
  {
    companyName: 'Auto Transport Connection Inc',
    city:  'Brooksville',
    state: 'FL',
    email: 'jason@onlineautoconnection.com',
  },
  {
    companyName: 'Preowned Auto Logistics Inc',
    city:  'Peabody',
    state: 'MA',
    email: 'mike.scenna@preownedautologistics.com',
  },
  {
    companyName: 'Eagle Auto Transport LLC',
    city:  'Weehawken',
    state: 'NJ',
    email: 'info@eagleautotransport.com',
  },
  {
    companyName: 'Miller Auto Transport LLC',
    city:  'Moraine',
    state: 'OH',
    email: 'wmcanally@millertransgroup.com',
  },
  {
    companyName: 'Car Go Auto Transport Inc',
    city:  'Clearwater',
    state: 'FL',
    email: 'tom@cargoautotransport.com',
  },
  {
    companyName: 'Super Car Auto Transport Inc',
    city:  'Tampa',
    state: 'FL',
    email: 'support@superautotransport.com',
  },
  {
    companyName: 'Luxury Auto Transport Inc',
    city:  'Crystal Lake',
    state: 'IL',
    email: 'dispatch@luxuryautocarriers.com',
  },
  {
    companyName: 'A Plus Car Carriers Inc',
    city:  'Pineville',
    state: 'NC',
    email: 'dispatch@aplusautotransport.com',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HTML layout (identical to carrierOutreach.ts baseLayout)
// ─────────────────────────────────────────────────────────────────────────────
function baseLayout(content, unsubUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0; padding:0; background:#F4F4F4; font-family: Arial, sans-serif; }
    .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
    .header { background:#00B8A9; padding:24px 32px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:700; letter-spacing:1px; }
    .body { padding:32px; color:#333333; font-size:15px; line-height:1.6; }
    .body h2 { color:#00B8A9; margin-top:0; font-size:18px; }
    .cta { display:block; width:220px; margin:24px auto; padding:14px 28px; background:#FF9800; color:#ffffff !important; text-decoration:none; text-align:center; border-radius:6px; font-weight:700; font-size:15px; }
    .footer { background:#F9F9F9; padding:20px 32px; font-size:12px; color:#999999; text-align:center; border-top:1px solid #EEEEEE; }
    .footer a { color:#00B8A9; text-decoration:none; }
    @media only screen and (max-width:600px) {
      .wrapper { width:100% !important; }
      .body, .header, .footer { padding:20px !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>DriveDrop</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>DriveDrop &middot; Charlotte, NC<br/>
      You're receiving this because your company appears in FMCSA carrier records.<br/>
      <a href="${unsubUrl}">Unsubscribe</a> &nbsp;|&nbsp; <a href="${BASE_URL}">Visit DriveDrop</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build personalised introduction email for one carrier
// ─────────────────────────────────────────────────────────────────────────────
function buildEmail(carrier) {
  const { companyName, state, email } = carrier;
  const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=outreach&utm_campaign=carrier_intro`;
  const unsubUrl  = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}&src=carrier_intro`;

  const subject = `${companyName}: Get more loads + free TMS — DriveDrop`;

  const htmlBody = `
    <h2>Hey ${companyName} 👋</h2>
    <p style="font-size:15px;">We partner with carriers${state ? ` in ${state}` : ''} to deliver more vehicle shipments — with <strong>zero broker middlemen</strong> and tools to run your operation smarter.</p>

    <div style="background:#F0FAFA;border-left:4px solid #00B8A9;border-radius:4px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:14px;font-weight:bold;color:#00897B;">Everything below is completely free for carriers:</p>
    </div>

    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;width:28px;">🚗</td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;"><strong>Vehicle load board</strong> — direct shipper jobs, no broker cut</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">💰</td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;"><strong>Guaranteed payments</strong> — collected upfront before you move</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">🗺️</td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;"><strong>Free AI route planner</strong> — optimize multi-stop routes automatically</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">📋</td>
        <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;"><strong>Free TMS</strong> — manage jobs, digital BOLs, inspections &amp; earnings in one place</td>
      </tr>
      <tr>
        <td style="padding:10px 0;vertical-align:top;">📍</td>
        <td style="padding:10px 0;vertical-align:top;"><strong>Real-time GPS tracking</strong> — customers self-serve updates so you drive, not answer calls</td>
      </tr>
    </table>

    <p style="font-size:14px;">Takes <strong>under 5 minutes</strong> to set up. No credit card. No commitments.</p>
    <a href="${BASE_URL}/drivers/register?${utmParams}" class="cta">Start Hauling on DriveDrop →</a>
    <p style="font-size:13px;color:#888;margin-top:20px;">Questions? Just reply — we respond fast.</p>
  `;

  const textBody = `Hey ${companyName},

DriveDrop connects carriers${state ? ` in ${state}` : ''} directly with vehicle shippers — no broker middlemen.

What you get FREE:
- Vehicle load board (direct shipper jobs, no broker cut)
- Guaranteed upfront payments
- AI route planner with multi-stop optimization
- Free TMS: manage jobs, digital BOLs, inspections & earnings
- Real-time GPS tracking for customers

Takes under 5 minutes to sign up. No credit card.

Join now: ${BASE_URL}/drivers/register?${utmParams}

Questions? Reply to this email.

To unsubscribe: ${unsubUrl}`;

  return { subject, html: baseLayout(htmlBody, unsubUrl), text: textBody };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send one email via Brevo
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail(apiKey, senderEmail, senderName, carrier) {
  const { subject, html, text } = buildEmail(carrier);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: carrier.email, name: carrier.companyName }],
      subject,
      htmlContent: html,
      textContent: text,
      tags: ['carrier-outreach', 'introduction', 'batch-1'],
    }),
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, messageId: body.messageId, error: body.message };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const apiKey     = process.env['BREVO_API_KEY'];
  const sender     = process.env['BREVO_OUTREACH_SENDER'] || 'carrier@drivedrop.us.com';
  const senderName = process.env['BREVO_OUTREACH_NAME']   || 'DriveDrop Carrier Team';

  if (!apiKey) {
    console.error('❌  BREVO_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(62));
  console.log('  DriveDrop — Carrier Outreach Batch Send');
  console.log('═'.repeat(62));
  console.log(`  From    : ${senderName} <${sender}>`);
  console.log(`  Template: Introduction`);
  console.log(`  Total   : ${CARRIERS.length} carriers`);
  console.log(`  Mode    : ${DRY_RUN ? '🔍 DRY RUN (no emails sent)' : '🚀 LIVE'}`);
  console.log('═'.repeat(62) + '\n');

  const results = [];

  for (let i = 0; i < CARRIERS.length; i++) {
    const carrier = CARRIERS[i];
    const num = `[${i + 1}/${CARRIERS.length}]`;

    if (DRY_RUN) {
      console.log(`${num} 🔍 PREVIEW  ${carrier.companyName} (${carrier.state})`);
      console.log(`       To     : ${carrier.email}`);
      console.log(`       Subject: ${carrier.companyName}: Get more loads + free TMS — DriveDrop\n`);
      results.push({ carrier: carrier.companyName, email: carrier.email, status: 'dry-run' });
      continue;
    }

    try {
      process.stdout.write(`${num} Sending → ${carrier.companyName} (${carrier.email}) … `);
      const result = await sendEmail(apiKey, sender, senderName, carrier);

      if (result.status === 201) {
        console.log(`✅  sent  (${result.messageId})`);
        results.push({ carrier: carrier.companyName, email: carrier.email, status: 'sent', messageId: result.messageId });
      } else {
        console.log(`❌  failed  (HTTP ${result.status}: ${result.error})`);
        results.push({ carrier: carrier.companyName, email: carrier.email, status: 'failed', error: result.error });
      }
    } catch (err) {
      console.log(`❌  error  (${err.message})`);
      results.push({ carrier: carrier.companyName, email: carrier.email, status: 'error', error: err.message });
    }

    // Delay between sends (skip after last one)
    if (i < CARRIERS.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;

  console.log('\n' + '═'.repeat(62));
  console.log('  SUMMARY');
  console.log('═'.repeat(62));

  if (DRY_RUN) {
    console.log(`  ✅  ${results.length} emails previewed (dry run — nothing sent)`);
  } else {
    console.log(`  ✅  Sent    : ${sent}`);
    if (failed > 0) {
      console.log(`  ❌  Failed  : ${failed}`);
      results.filter(r => r.status !== 'sent').forEach(r => {
        console.log(`       - ${r.carrier} <${r.email}>  → ${r.error || r.status}`);
      });
    }
  }

  console.log('═'.repeat(62));
  console.log('  Monitor deliverability in Brevo dashboard:');
  console.log('  https://app.brevo.com/transactional-email/logs');
  console.log('═'.repeat(62) + '\n');
})();
