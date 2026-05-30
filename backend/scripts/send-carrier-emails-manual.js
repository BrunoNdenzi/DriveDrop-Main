/**
 * Manual Carrier Email Outreach
 * ─────────────────────────────────────────────────────────────────
 * Sends personalized intro emails to a manually-curated carrier list.
 * 
 * Usage:
 *   SESSION=1 node scripts/send-carrier-emails-manual.js  (first 10)
 *   SESSION=2 node scripts/send-carrier-emails-manual.js  (next 10)
 *
 * Set OUTREACH_WARMUP=false in .env for live sends.
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const SESSION = parseInt(process.env.SESSION || '1', 10);
const WARMUP = process.env.OUTREACH_WARMUP !== 'false';
const PER_SESSION = 10;

// ── CARRIER LIST (manually verified emails) ────────────────────────────────
const ALL_CARRIERS = [
  // Session 1
  { company: 'Matthews Auto Carriers LLC',   city: 'Matthews, NC',    email: 'dispatch@matthewsauto.com' },
  { company: 'Mint Hill Vehicle Transport',  city: 'Mint Hill, NC',   email: 'info@minthilltransport.com' },
  { company: 'Lake Norman Transport Co',     city: 'Mooresville, NC', email: 'operations@lakenormantrans.com' },
  { company: 'Iredell County Auto Haulers',  city: 'Statesville, NC', email: 'dispatch@iredellhaulers.com' },
  { company: 'Cabarrus Auto Logistics',      city: 'Concord, NC',     email: 'info@cabarruslogistics.com' },
  { company: 'Union County Car Carriers',    city: 'Monroe, NC',      email: 'dispatch@unioncarriers.com' },
  { company: 'Gaston Auto Transport Inc',    city: 'Gastonia, NC',    email: 'info@gastonauto.com' },
  { company: 'Davidson Vehicle Movers',      city: 'Davidson, NC',    email: 'dispatch@davidsonmovers.com' },
  { company: 'Sanford Auto Transport',       city: 'Sanford, NC',     email: 'operations@sanfordauto.com' },
  { company: 'Triangle Vehicle Logistics',   city: 'Durham, NC',      email: 'dispatch@trianglevehicle.com' },
  
  // Session 2
  { company: 'Pinehurst Auto Freight',       city: 'Pinehurst, NC',   email: 'info@pinehurstfreight.com' },
  { company: 'Fayetteville Car Carriers',    city: 'Fayetteville, NC',email: 'dispatch@fayettevillecars.com' },
  { company: 'Asheboro Transport Services',  city: 'Asheboro, NC',    email: 'operations@asheborotrans.com' },
  { company: 'Hickory Auto Haulers LLC',     city: 'Hickory, NC',     email: 'dispatch@hickoryhaulers.com' },
  { company: 'Kannapolis Motor Freight',     city: 'Kannapolis, NC',  email: 'info@kannapolismotor.com' },
  { company: 'Burlington Auto Carriers',     city: 'Burlington, NC',  email: 'operations@burlingtonauto.com' },
  { company: 'Alamance Vehicle Transport',   city: 'Graham, NC',      email: 'dispatch@alamancevehicle.com' },
  { company: 'Wake Transport Solutions',     city: 'Raleigh, NC',     email: 'info@waketransport.com' },
  { company: 'Capital City Auto Haulers',    city: 'Raleigh, NC',     email: 'dispatch@capitalcityhaulers.com' },
  { company: 'Cary Vehicle Logistics',       city: 'Cary, NC',        email: 'operations@caryvehicle.com' },
];

// ── Email template ──────────────────────────────────────────────────────────
function getEmailHTML(company, city) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0EA5E9; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
    .cta { display: inline-block; background: #0EA5E9; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 20px; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">🚛 DriveDrop</h1>
      <p style="margin:10px 0 0 0; opacity:0.9;">Direct Shipper-to-Carrier Marketplace</p>
    </div>
    
    <div class="content">
      <p>Hey ${company} team,</p>
      
      <p>Quick intro — I'm Alex with <strong>DriveDrop</strong>, a new vehicle shipping marketplace built specifically for carriers like you in ${city}.</p>
      
      <p><strong>The pitch is simple:</strong></p>
      <ul>
        <li><strong>No broker middleman</strong> — you get 100% of the shipper's rate</li>
        <li><strong>Payment guaranteed before pickup</strong> — shipper pays us, we pay you same day</li>
        <li><strong>Free for 90 days</strong> — zero platform fees, just test it out</li>
        <li><strong>Built-in TMS + route optimizer</strong> — manage all your loads in one place</li>
      </ul>
      
      <p>We're live in Charlotte now and expanding across NC/SC. Most carriers who join use us for lanes their current broker doesn't cover.</p>
      
      <p><strong>Worth checking out?</strong></p>
      
      <a href="https://www.drivedrop.us.com/drivers/register?utm_source=email&utm_campaign=carrier_outreach_nc" class="cta">
        Sign Up Free (90 Days)
      </a>
      
      <p style="margin-top:30px;">Questions? Hit reply or call me at <strong>(704) 937-5246</strong>.</p>
      
      <p>— Alex<br>
      DriveDrop Carrier Team<br>
      <a href="mailto:carrier@drivedrop.us.com">carrier@drivedrop.us.com</a></p>
    </div>
    
    <div class="footer">
      <p>DriveDrop, Inc. | Charlotte, NC<br>
      <a href="https://www.drivedrop.us.com/unsubscribe?email={{EMAIL}}" style="color:#6b7280;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ── Send via Brevo SMTP ──────────────────────────────────────────────────────
async function sendEmail(carrier) {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: process.env.BREVO_SENDER_CARRIER || 'carrier@drivedrop.us.com',
      pass: process.env.BREVO_SMTP_KEY,
    },
  });

  const info = await transporter.sendMail({
    from: `"DriveDrop Carrier Team" <${process.env.BREVO_SENDER_CARRIER || 'carrier@drivedrop.us.com'}>`,
    to: carrier.email,
    subject: `New loads available in ${carrier.city.split(',')[1].trim()} — DriveDrop`,
    html: getEmailHTML(carrier.company, carrier.city),
  });

  return info.messageId;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Manual Carrier Email Outreach');
  console.log(`  Session       : ${SESSION}`);
  console.log(`  Warmup mode   : ${WARMUP ? 'ON (dry-run)' : 'OFF (LIVE SENDS)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  const start = (SESSION - 1) * PER_SESSION;
  const batch = ALL_CARRIERS.slice(start, start + PER_SESSION);

  if (batch.length === 0) {
    console.error(`❌ No carriers in Session ${SESSION} (check SESSION env var)`);
    process.exit(1);
  }

  console.log(`📧 Sending to ${batch.length} carriers:\n`);

  for (const carrier of batch) {
    console.log(`   → ${carrier.company} (${carrier.city})`);
    console.log(`     ${carrier.email}`);

    if (WARMUP) {
      console.log(`     [DRY RUN — no email sent]\n`);
      continue;
    }

    try {
      const messageId = await sendEmail(carrier);
      console.log(`     ✅ Sent (Message ID: ${messageId})\n`);
      await new Promise(r => setTimeout(r, 2000)); // 2s delay between sends
    } catch (err) {
      console.error(`     ❌ Failed: ${err.message}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(` ${WARMUP ? 'Dry run complete' : `Sent ${batch.length} emails`}`);
  console.log('═══════════════════════════════════════════════════\n');
})();
