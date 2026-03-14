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

const BASE_URL = process.env['APP_URL'] || 'https://drivedrop.app';
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
      subject: `New shipment opportunities for {{companyName}} – DriveDrop`,
      html: baseLayout(
        `<h2>Hello {{companyName}} Team 👋</h2>
        <p>I hope this finds you well. My name is the DriveDrop team — we run a fast-growing vehicle transport marketplace connecting car dealers, fleet owners, and private sellers with reliable carriers like you.</p>
        <h3 style="color:#FF9800; font-size:16px;">Why DriveDrop?</h3>
        <ul>
          <li><strong>Load board with guaranteed payments</strong> — no more chasing invoices</li>
          <li><strong>No broker fees</strong> — you keep more of every haul</li>
          <li><strong>Real-time tracking</strong> — customers stay informed, you stay focused</li>
          <li><strong>Instant job matching</strong> in your service area${vars.state ? ` (${vars.state})` : ''}</li>
        </ul>
        <p>Getting started is free and takes under 5 minutes.</p>
        <a href="${BASE_URL}/carrier-signup?${utmParams}" class="cta">Join as a Carrier</a>
        <p style="font-size:13px;color:#888;">Questions? Just reply to this email — we're happy to chat.</p>`,
        vars.trackingPixelUrl
      ),
      text: `Hello {{companyName}} Team,

DriveDrop is a vehicle transport marketplace connecting shippers with carriers like you — guaranteed payments, no broker fees, and real-time job matching in your area.

Join free at ${BASE_URL}/carrier-signup?${utmParams}

Questions? Reply to this email.

To unsubscribe: {{unsubUrl}}`,
    };
  },

  followUp: (vars) => {
    const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'follow_up'}&utm_campaign=carrier_followup`;
    return {
      subject: `Following up — DriveDrop loads available in {{state}}`,
      html: baseLayout(
        `<h2>Still interested in more loads, {{companyName}}?</h2>
        <p>We reached out recently about DriveDrop — just following up in case the timing wasn't right.</p>
        <p>We currently have <strong>active shipments${vars.state ? ` in ${vars.state}` : ''}</strong> looking for qualified carriers. These include:</p>
        <ul>
          <li>Dealer trade loads (fast turnaround)</li>
          <li>Private party relocations</li>
          <li>Fleet transport contracts</li>
        </ul>
        <p>You can view available loads and set your own rates — no obligation.</p>
        <a href="${BASE_URL}/carrier-signup?${utmParams}" class="cta">View Available Loads</a>
        <p style="font-size:13px;color:#888;">This is our last follow-up. We won't bother you again if this isn't a fit.</p>`,
        vars.trackingPixelUrl
      ),
      text: `Hello {{companyName}},

Following up on our previous message about DriveDrop. We have active shipments available in your area.

View loads at ${BASE_URL}/carrier-signup?${utmParams}

To unsubscribe: {{unsubUrl}}`,
    };
  },

  specialOffer: (vars) => {
    const utmParams = `utm_source=${UTM_SOURCE}&utm_medium=${vars.utmMedium || 'promo'}&utm_campaign=carrier_offer`;
    return {
      subject: `Exclusive offer for {{companyName}} — $0 processing for 90 days`,
      html: baseLayout(
        `<h2>Limited-time offer for {{companyName}} 🎉</h2>
        <p>We want to make it easy for you to try DriveDrop, so we're offering <strong>zero transaction fees for your first 90 days</strong> as a new carrier partner.</p>
        <div style="background:#FFF8E1;border:2px solid #FF9800;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
          <p style="margin:0;font-size:18px;font-weight:bold;color:#E65100;">90 Days — 0% Platform Fees</p>
          <p style="margin:4px 0 0;font-size:13px;color:#888;">For new carriers joining before the offer expires</p>
        </div>
        <p>Here's what you get on DriveDrop:</p>
        <ul>
          <li>✅ Instant payment on delivery</li>
          <li>✅ Priority load matching in {{state}}</li>
          <li>✅ Digital BOL & inspection reports</li>
          <li>✅ 24/7 support</li>
        </ul>
        <a href="${BASE_URL}/carrier-signup?${utmParams}&promo=carrier90" class="cta">Claim Offer Now</a>
        <p style="font-size:12px;color:#aaa;">Offer valid for new carrier accounts only. No credit card required to sign up.</p>`,
        vars.trackingPixelUrl
      ),
      text: `Hello {{companyName}},

Special offer: join DriveDrop as a carrier and pay zero transaction fees for 90 days.

Claim offer at ${BASE_URL}/carrier-signup?${utmParams}&promo=carrier90

To unsubscribe: {{unsubUrl}}`,
    };
  },
};

export type TemplateName = keyof typeof emailTemplates;
