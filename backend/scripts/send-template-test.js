/**
 * Send the real carrier outreach introduction template to a test address.
 * Bypasses the Express server — calls Brevo API directly.
 * Usage: node scripts/send-template-test.js
 */
require('dotenv').config();

// ---------------------------------------------------------------------------
// Template vars — realistic preview data
// ---------------------------------------------------------------------------
const TEST_VARS = {
  companyName: 'Carolina Express Logistics',
  city: 'Charlotte',
  state: 'NC',
  unsubUrl: 'https://www.drivedrop.us.com/unsubscribe?token=preview_token',
  trackingPixelUrl: null,
  utmMedium: 'outreach',
};

const TARGET_EMAIL = 'brunondenzi80@gmail.com';
const TARGET_NAME  = 'Bruno';

// ---------------------------------------------------------------------------
// Template (mirrors carrierOutreach.ts — introduction)
// ---------------------------------------------------------------------------
const BASE_URL  = 'https://www.drivedrop.us.com';
const UTM_SOURCE = 'email';

function baseLayout(content, trackingPixel) {
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
    .header img { height:40px; }
    .header h1 { color:#ffffff; margin:8px 0 0; font-size:20px; font-weight:700; }
    .body { padding:32px; color:#333333; font-size:15px; line-height:1.6; }
    .body h2 { color:#00B8A9; margin-top:0; font-size:18px; }
    .cta { display:block; width:200px; margin:24px auto; padding:14px 28px; background:#FF9800; color:#ffffff; text-decoration:none; text-align:center; border-radius:6px; font-weight:700; font-size:15px; }
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
    <div class="header">
      <h1>DriveDrop</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>DriveDrop · Charlotte, NC<br/>
      You're receiving this because your company appears in FMCSA carrier records.<br/>
      <a href="${TEST_VARS.unsubUrl}">Unsubscribe</a> | <a href="${BASE_URL}">Visit DriveDrop</a>
      </p>
    </div>
  </div>
  ${trackingPixel ? `<img src="${trackingPixel}" width="1" height="1" style="display:none" alt="" />` : ''}
</body>
</html>`;
}

function buildIntroduction(vars) {
  const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'outreach'}&utm_campaign=carrier_intro`;
  return {
    subject: `${vars.companyName}: Get more loads + free TMS — DriveDrop`,
    html: baseLayout(
      `<h2>Hey ${vars.companyName} 👋</h2>
      <p style="font-size:15px;">We partner with carriers${vars.state ? ` in ${vars.state}` : ''} to deliver more vehicle shipments — with <strong>zero broker middlemen</strong> and tools to run your operation smarter.</p>

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
      <p style="font-size:13px;color:#888;margin-top:20px;">Questions? Just reply — we respond fast.</p>`,
      vars.trackingPixelUrl
    ),
    text: `Hey ${vars.companyName},

DriveDrop connects carriers${vars.state ? ` in ${vars.state}` : ''} directly with vehicle shippers — no broker middlemen.

What you get FREE:
- Vehicle load board (direct shipper jobs, no broker cut)
- Guaranteed upfront payments
- AI route planner with multi-stop optimization
- Free TMS: manage jobs, digital BOLs, inspections & earnings
- Real-time GPS tracking for customers

Takes under 5 minutes to sign up. No credit card.

Join now: ${BASE_URL}/drivers/register?${utmParams}

Questions? Reply to this email.

To unsubscribe: ${vars.unsubUrl}`,
  };
}

// ---------------------------------------------------------------------------
// Main — render + send
// ---------------------------------------------------------------------------
(async () => {
  const apiKey = process.env['BREVO_API_KEY'];
  const sender = process.env['BREVO_OUTREACH_SENDER'] || 'carrier@drivedrop.us.com';
  const senderName = process.env['BREVO_OUTREACH_NAME'] || 'DriveDrop Carrier Team';

  if (!apiKey) {
    console.error('❌ BREVO_API_KEY not found in .env');
    process.exit(1);
  }

  const { subject, html, text } = buildIntroduction(TEST_VARS);

  console.log('\n📧 Sending template preview email');
  console.log('   To      :', TARGET_EMAIL);
  console.log('   From    :', `${senderName} <${sender}>`);
  console.log('   Subject :', subject);
  console.log('   Company :', TEST_VARS.companyName);
  console.log('   State   :', TEST_VARS.state);
  console.log('\nCalling Brevo API…\n');

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: sender },
      to: [{ email: TARGET_EMAIL, name: TARGET_NAME }],
      subject,
      htmlContent: html,
      textContent: text,
      tags: ['template-preview', 'introduction'],
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 201) {
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', body.messageId);
    console.log('\n   Check your inbox at', TARGET_EMAIL);
  } else {
    console.error('❌ Brevo returned HTTP', res.status);
    console.error(JSON.stringify(body, null, 2));
  }
})();
