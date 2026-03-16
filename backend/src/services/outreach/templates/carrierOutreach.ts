/**
 * Carrier Outreach Email Templates
 * DriveDrop branding: Teal #00B8A9 / Orange #FF9800
 * Mobile-responsive with tracking pixel, unsubscribe link, UTM params.
 */

export interface TemplateVars {
  companyName: string;
  city?: string;
  state?: string;
  unsubUrl: string;
  trackingPixelUrl?: string;
  utmMedium?: string;
}

const BASE_URL = process.env['FRONTEND_URL'] || process.env['APP_URL'] || 'https://www.drivedrop.us.com';
const UTM_SOURCE = 'email';

function baseLayout(content: string, trackingPixel?: string): string {
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
      <a href="{{unsubUrl}}">Unsubscribe</a> | <a href="${BASE_URL}">Visit DriveDrop</a>
      </p>
    </div>
  </div>
  ${trackingPixel ? `<img src="${trackingPixel}" width="1" height="1" style="display:none" alt="" />` : ''}
</body>
</html>`;
}

export const emailTemplates: Record<string, (vars: TemplateVars) => { subject: string; html: string; text: string }> = {
  introduction: (vars) => {
    const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'outreach'}&utm_campaign=carrier_intro`;
    return {
      subject: `{{companyName}}: Get more loads + free TMS — DriveDrop`,
      html: baseLayout(
        `<h2>Hey {{companyName}} 👋</h2>
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
            <td style="padding:10px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;"><strong>Free TMS</strong> — manage jobs, digital BOLs, inspections & earnings in one place</td>
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
      text: `Hey {{companyName}},

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

To unsubscribe: {{unsubUrl}}`,
    };
  },

  followUp: (vars) => {
    const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'follow_up'}&utm_campaign=carrier_followup`;
    return {
      subject: `Still here if you're ready — loads waiting${vars.state ? ` in ${vars.state}` : ''} | DriveDrop`,
      html: baseLayout(
        `<h2>Quick follow-up, {{companyName}}</h2>
        <p style="font-size:15px;">We reached out about DriveDrop a little while back. Just wanted to check in — we have <strong>active vehicle shipments</strong>${vars.state ? ` in ${vars.state}` : ''} that need reliable carriers right now.</p>

        <div style="background:#FFF8E1;border:2px solid #FF9800;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#E65100;">Reminder — it's all free to join:</p>
          <p style="margin:0;font-size:14px;color:#555;">✔ Free TMS &nbsp;·&nbsp; ✔ Free AI route optimizer &nbsp;·&nbsp; ✔ Direct shipper payments &nbsp;·&nbsp; ✔ Digital BOL &amp; inspection tools</p>
        </div>

        <p style="font-size:14px;">Set your own rates. Pick the loads you want. No hidden fees.</p>
        <a href="${BASE_URL}/drivers/register?${utmParams}" class="cta">View Loads &amp; Sign Up Free →</a>
        <p style="font-size:13px;color:#888;margin-top:20px;">This is our last follow-up — we won't reach out again if it's not a fit. Just reply "remove" anytime.</p>`,
        vars.trackingPixelUrl
      ),
      text: `Hi {{companyName}},

Following up on DriveDrop — we have active vehicle shipments available${vars.state ? ` in ${vars.state}` : ''} right now.

Reminder — all free when you join:
- Free TMS, free AI route optimizer
- Direct shipper payments (no broker cut)
- Digital BOL & inspection tools

Set your own rates. No hidden fees.

Sign up free: ${BASE_URL}/drivers/register?${utmParams}

Reply "remove" to opt out.
To unsubscribe: {{unsubUrl}}`,
    };
  },

  specialOffer: (vars) => {
    const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'promo'}&utm_campaign=carrier_offer`;
    return {
      subject: `0% platform fees for 90 days — {{companyName}}, this one's for you`,
      html: baseLayout(
        `<h2>Special deal for {{companyName}} 🎉</h2>
        <p style="font-size:15px;">To make your first experience with DriveDrop a no-brainer, we're giving new carriers <strong>zero platform fees for 90 days</strong>. Keep every dollar you earn.</p>

        <div style="background:#FFF8E1;border:2px solid #FF9800;border-radius:8px;padding:18px;margin:20px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:bold;color:#E65100;">90 Days · 0% Platform Fees</p>
          <p style="margin:6px 0 0;font-size:13px;color:#888;">New carrier accounts only · No credit card required</p>
        </div>

        <p style="font-size:14px;margin-bottom:6px;">Plus you get all this free, forever:</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;width:26px;">✅</td>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">Free TMS — jobs, earnings, documents, all in one dashboard</td>
          </tr>
          <tr>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">✅</td>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">AI route planner &amp; multi-stop route optimization</td>
          </tr>
          <tr>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">✅</td>
            <td style="padding:7px 0;border-bottom:1px solid #EEEEEE;vertical-align:top;">Guaranteed upfront payments — zero invoice chasing</td>
          </tr>
          <tr>
            <td style="padding:7px 0;vertical-align:top;">✅</td>
            <td style="padding:7px 0;vertical-align:top;">Digital BOL, photo inspections &amp; 24/7 support</td>
          </tr>
        </table>

        <a href="${BASE_URL}/drivers/register?${utmParams}&promo=carrier90" class="cta">Claim Your 90-Day Deal →</a>
        <p style="font-size:12px;color:#aaa;margin-top:16px;">Offer expires soon. No commitment, no credit card.</p>`,
        vars.trackingPixelUrl
      ),
      text: `Hi {{companyName}},

Special offer: join DriveDrop as a carrier and pay ZERO platform fees for your first 90 days.

Free forever:
- Free TMS (jobs, earnings, documents)
- AI route planner & multi-stop optimization
- Guaranteed upfront payments
- Digital BOL & photo inspections

No credit card. No commitment.

Claim offer: ${BASE_URL}/drivers/register?${utmParams}&promo=carrier90

To unsubscribe: {{unsubUrl}}`,
    };
  },
};

export type TemplateName = keyof typeof emailTemplates;
