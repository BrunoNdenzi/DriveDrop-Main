import { EmailTemplate, EmailTemplateType } from '../types/email.types';

// ── Design System (matches website UI) ──────────────────────────────
const DD = {
  bg:      '#030712', // gray-950
  card:    '#ffffff',
  border:  '#e5e7eb', // gray-200
  muted:   '#f9fafb', // gray-50
  text:    '#111827', // gray-900
  sub:     '#6b7280', // gray-500
  blue:    '#3b82f6', // blue-500
  blueHi:  '#2563eb', // blue-600
  amber:   '#f59e0b', // amber-500
  teal:    '#14b8a6', // teal-500
  green:   '#22c55e', // green-500
  red:     '#ef4444', // red-500
  purple:  '#a855f7', // purple-500
};

// ── Shared base layout ──────────────────────────────────────────────
const emailBase = (title: string, body: string, footerExtra = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:${DD.card};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${DD.bg};padding:32px 40px;text-align:center;">
              <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                Drive<span style="color:${DD.blue};">Drop</span>
              </h1>
              <p style="margin:0;color:${DD.sub};font-size:13px;">${title}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;color:${DD.text};font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:${DD.muted};border-top:1px solid ${DD.border};text-align:center;color:${DD.sub};font-size:12px;">
              ${footerExtra}
              <p style="margin:8px 0 0;">
                <a href="https://drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">drivedrop.us.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a>
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} DriveDrop Inc. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── Reusable components ─────────────────────────────────────────────
const btn = (text: string, url: string, color = DD.blue) =>
  `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background-color:${color};color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${text}</a>
  </div>`;

const infoBox = (content: string, accent = DD.blue) =>
  `<div style="background-color:${DD.muted};border-left:3px solid ${accent};padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
    ${content}
  </div>`;

const badge = (text: string, bg = DD.blue) =>
  `<span style="display:inline-block;background-color:${bg};color:#ffffff;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;">${text}</span>`;

// ── Templates ───────────────────────────────────────────────────────
export const EmailTemplates: Record<EmailTemplateType, EmailTemplate> = {

  // ─── CLIENT EMAILS ──────────────────────────────────────────────
  client_welcome: {
    subject: 'Welcome to DriveDrop — Your Account is Ready',
    sender: 'client',
    htmlContent: emailBase('Welcome to DriveDrop', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Hi {{firstName}},</h2>
      <p>Welcome to DriveDrop — vehicle logistics, simplified. Your account is set up and ready to go.</p>

      ${infoBox(`
        <strong>What you can do:</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>Get instant quotes for vehicle shipments</li>
          <li>Track shipments in real-time with GPS</li>
          <li>Access a network of verified carriers</li>
          <li>Manage everything from one dashboard</li>
        </ul>
      `)}

      ${btn('Go to Dashboard', '{{dashboardUrl}}')}

      <p style="color:${DD.sub};font-size:13px;">Questions? Reach us at <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a></p>
    `),
    textContent: `Welcome to DriveDrop, {{firstName}}!\n\nYour account is ready. Access your dashboard: {{dashboardUrl}}\n\nNeed help? Contact support@drivedrop.us.com`
  },

  shipment_created: {
    subject: 'Shipment Created — {{shipmentId}}',
    sender: 'client',
    htmlContent: emailBase('Shipment Created', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Shipment {{shipmentId}}</h2>
      <p>Hi {{firstName}}, your vehicle shipment has been created.</p>

      ${infoBox(`
        <strong>Shipment Details</strong><br>
        <strong>ID:</strong> {{shipmentId}}<br>
        <strong>Vehicle:</strong> {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}<br>
        <strong>From:</strong> {{pickupCity}}, {{pickupState}}<br>
        <strong>To:</strong> {{deliveryCity}}, {{deliveryState}}<br>
        <strong>Pickup:</strong> {{pickupDate}}<br>
        <strong>Status:</strong> ${badge('{{status}}', DD.amber)}
      `)}

      <p>We're matching your shipment with the best available carriers. You'll be notified once one is assigned.</p>

      ${btn('Track Shipment', '{{trackingUrl}}')}
    `),
    textContent: `Shipment Created: {{shipmentId}}\n\nVehicle: {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}\nRoute: {{pickupCity}}, {{pickupState}} -> {{deliveryCity}}, {{deliveryState}}\n\nTrack: {{trackingUrl}}`
  },

  carrier_assigned: {
    subject: 'Carrier Assigned — {{shipmentId}}',
    sender: 'client',
    htmlContent: emailBase('Carrier Assigned', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Great news, {{firstName}}!</h2>
      <p>A verified carrier has been assigned to your shipment.</p>

      ${infoBox(`
        <strong>Carrier Details</strong><br>
        <strong>Company:</strong> {{carrierName}}<br>
        <strong>Driver:</strong> {{driverName}}<br>
        <strong>Phone:</strong> {{driverPhone}}<br>
        <strong>Rating:</strong> {{driverRating}}/5.0<br><br>
        <strong>Pickup:</strong> {{pickupDate}} at {{pickupTime}}<br>
        <strong>Est. Delivery:</strong> {{deliveryDate}}
      `)}

      <p>Your driver will contact you 24 hours before pickup to confirm details.</p>

      ${btn('Track Live', '{{trackingUrl}}')}
    `)
  },

  pickup_confirmed: {
    subject: 'Vehicle Picked Up — {{shipmentId}}',
    sender: 'client',
    htmlContent: emailBase('Vehicle Picked Up', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Your vehicle is on the way!</h2>
      <p>Hi {{firstName}}, your {{vehicleYear}} {{vehicleMake}} {{vehicleModel}} has been picked up and is now in transit.</p>

      ${infoBox(`
        <strong>Pickup Confirmation</strong><br>
        <strong>Picked up:</strong> {{pickupTime}} on {{pickupDate}}<br>
        <strong>Location:</strong> {{pickupAddress}}<br>
        <strong>Driver:</strong> {{driverName}}<br>
        <strong>Est. Delivery:</strong> {{estimatedDelivery}}
      `, DD.green)}

      <p>Track your vehicle's journey in real-time.</p>

      ${btn('Track Live', '{{trackingUrl}}', DD.green)}
    `)
  },

  delivery_confirmed: {
    subject: 'Vehicle Delivered — {{shipmentId}}',
    sender: 'client',
    htmlContent: emailBase('Delivery Complete', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Your vehicle has been delivered!</h2>
      <p>Hi {{firstName}}, your {{vehicleYear}} {{vehicleMake}} {{vehicleModel}} was delivered successfully.</p>

      ${infoBox(`
        <strong>Delivery Details</strong><br>
        <strong>Delivered:</strong> {{deliveryTime}} on {{deliveryDate}}<br>
        <strong>Location:</strong> {{deliveryAddress}}<br>
        <strong>Received by:</strong> {{receiverName}}<br>
        <strong>Total Distance:</strong> {{totalMiles}} miles<br>
        <strong>Transit Time:</strong> {{transitDays}} days
      `, DD.green)}

      <p>Thank you for choosing DriveDrop. We'd love your feedback.</p>

      ${btn('Leave a Review', '{{reviewUrl}}', DD.green)}

      <p style="color:${DD.sub};font-size:13px;">Need another shipment? <a href="{{dashboardUrl}}" style="color:${DD.blue};text-decoration:none;">Create one here</a>.</p>
    `)
  },

  // ─── DRIVER / CARRIER EMAILS ────────────────────────────────────
  driver_welcome: {
    subject: 'Welcome to DriveDrop Carrier Network',
    sender: 'driver',
    htmlContent: emailBase('Welcome, Carrier!', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Welcome, {{firstName}}!</h2>
      <p>You're now part of DriveDrop's vehicle logistics network.</p>

      ${infoBox(`
        <strong>Get started:</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>Browse available loads with AI matching</li>
          <li>Optimize routes with smart navigation</li>
          <li>Accept loads instantly</li>
          <li>Get paid fast with direct deposit</li>
        </ul>
      `, DD.amber)}

      <p>Your carrier profile is live — start accepting loads now.</p>

      ${btn('View Available Loads', '{{dashboardUrl}}', DD.amber)}

      <p style="color:${DD.sub};font-size:13px;">Questions? Contact <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a></p>
    `)
  },

  load_available: {
    subject: 'New Load Match — {{route}}',
    sender: 'driver',
    htmlContent: emailBase('New Load Available', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Match found, {{firstName}}!</h2>
      <p>Our AI identified a high-value load matching your route and schedule.</p>

      ${infoBox(`
        <strong>Load Details</strong><br>
        <strong>Route:</strong> {{pickupCity}}, {{pickupState}} &rarr; {{deliveryCity}}, {{deliveryState}}<br>
        <strong>Distance:</strong> {{distance}} miles<br>
        <strong>Pickup:</strong> {{pickupDate}}<br>
        <strong>Vehicle:</strong> {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}<br>
        <strong>Rate:</strong> <span style="color:${DD.amber};font-size:18px;font-weight:700;">{{rate}}</span><br>
        <strong>Load ID:</strong> {{loadId}}
      `, DD.amber)}

      <p><strong>Act fast</strong> — this load is visible to multiple carriers.</p>

      ${btn('View & Accept Load', '{{loadUrl}}', DD.amber)}
    `)
  },

  load_assigned: {
    subject: 'Load Confirmed — {{loadId}}',
    sender: 'driver',
    htmlContent: emailBase('Load Confirmed', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">You've got a new load, {{firstName}}!</h2>
      <p>Load {{loadId}} has been assigned to you.</p>

      ${infoBox(`
        <strong>Assignment Details</strong><br>
        <strong>Load ID:</strong> {{loadId}}<br>
        <strong>Pickup:</strong> {{pickupAddress}}<br>
        <strong>Pickup Date:</strong> {{pickupDate}} at {{pickupTime}}<br>
        <strong>Delivery:</strong> {{deliveryAddress}}<br>
        <strong>Contact:</strong> {{customerName}} &mdash; {{customerPhone}}<br>
        <strong>Payment:</strong> {{rate}} (paid on delivery)
      `, DD.green)}

      <p><strong>Next steps:</strong></p>
      <ol style="padding-left:18px;line-height:2;">
        <li>Review pickup instructions</li>
        <li>Contact customer 24h before pickup</li>
        <li>Complete pickup verification</li>
        <li>Enable GPS tracking</li>
      </ol>

      ${btn('View Full Details', '{{loadDetailsUrl}}', DD.amber)}
    `)
  },

  // ─── BROKER EMAILS ──────────────────────────────────────────────
  broker_welcome: {
    subject: 'Welcome to DriveDrop Broker Network',
    sender: 'broker',
    htmlContent: emailBase('Welcome, Broker!', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Welcome, {{firstName}}!</h2>
      <p>You're now connected to DriveDrop's broker network with Central Dispatch, Montway, and uShip integrations.</p>

      ${infoBox(`
        <strong>Broker benefits:</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>Sync loads from multiple platforms</li>
          <li>AI-powered carrier matching</li>
          <li>Automated dispatch workflow</li>
          <li>Commission tracking &amp; reporting</li>
        </ul>
      `, DD.teal)}

      ${btn('Access Broker Dashboard', '{{dashboardUrl}}', DD.teal)}

      <p style="color:${DD.sub};font-size:13px;">Questions? Contact <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a></p>
    `)
  },

  // ─── UTILITY EMAILS ─────────────────────────────────────────────
  password_reset: {
    subject: 'Reset Your DriveDrop Password',
    sender: 'client',
    htmlContent: emailBase('Password Reset', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Reset your password</h2>
      <p>Hi {{firstName}}, we received a request to reset your DriveDrop password.</p>

      ${btn('Reset Password', '{{resetUrl}}')}

      <p style="color:${DD.sub};font-size:13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `)
  },

  email_verification: {
    subject: 'Verify Your DriveDrop Email',
    sender: 'client',
    htmlContent: emailBase('Verify Your Email', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Almost there, {{firstName}}!</h2>
      <p>Verify your email address to complete your DriveDrop registration.</p>

      ${btn('Verify Email Address', '{{verificationUrl}}')}

      <p style="color:${DD.sub};font-size:13px;">This link expires in 24 hours.</p>
    `)
  },

  // ─── DRIVER APPLICATION EMAILS ──────────────────────────────────
  driver_application_received: {
    subject: 'Application Received — DriveDrop Carrier Network',
    sender: 'driver',
    htmlContent: emailBase('Application Received', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Thank you, {{firstName}}!</h2>
      <p>We've received your driver application for the DriveDrop carrier network.</p>

      ${infoBox(`
        <strong>Application Summary:</strong>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:6px 0;color:${DD.sub};width:40%;font-size:13px;"><strong>Application ID:</strong></td>
            <td style="padding:6px 0;font-size:13px;font-family:monospace;">{{applicationId}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${DD.sub};font-size:13px;"><strong>Full Name:</strong></td>
            <td style="padding:6px 0;font-size:13px;">{{fullName}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${DD.sub};font-size:13px;"><strong>Email:</strong></td>
            <td style="padding:6px 0;font-size:13px;">{{email}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${DD.sub};font-size:13px;"><strong>Phone:</strong></td>
            <td style="padding:6px 0;font-size:13px;">{{phone}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${DD.sub};font-size:13px;"><strong>License State:</strong></td>
            <td style="padding:6px 0;font-size:13px;">{{licenseState}}</td>
          </tr>
          {{dotNumberRow}}
        </table>
      `, DD.green)}

      ${infoBox(`
        <strong>What happens next?</strong>
        <ol style="margin:8px 0 0;padding-left:18px;line-height:1.8;">
          <li><strong>Background Check:</strong> We'll verify your license and driving record through our FCRA-compliant partner</li>
          <li><strong>Document Review:</strong> Our team will review your insurance and vehicle information</li>
          <li><strong>DOT Verification:</strong> If applicable, we'll verify your DOT number and carrier authority</li>
          <li><strong>Decision:</strong> You'll receive a response within <strong>3-5 business days</strong></li>
        </ol>
      `, DD.amber)}

      <div style="background-color:${DD.muted};padding:16px 20px;border-radius:6px;margin:24px 0;font-size:13px;">
        <p style="margin:0 0 8px;color:${DD.sub};"><strong style="color:${DD.text};">📧 Keep this email</strong></p>
        <p style="margin:0;color:${DD.sub};line-height:1.6;">
          Save your <strong>Application ID</strong> (above) for your records. You may need it if you contact support about your application status.
        </p>
      </div>

      <div style="background-color:#f0fdf4;border-left:3px solid ${DD.green};padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;line-height:1.7;">
        <strong style="color:#166534;">💰 What you'll earn:</strong><br>
        <span style="color:#166534;">Approved drivers earn <strong>90% of each shipment value</strong> with weekly direct deposits. Top drivers average $2,000-$5,000 per week.</span>
      </div>

      <p style="color:${DD.sub};font-size:13px;">
        Questions about your application? Contact us at <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a>
      </p>

      <p>Thank you for your interest in joining the DriveDrop carrier network!</p>
      <p style="margin-top:24px;"><strong>The DriveDrop Team</strong></p>
    `)
  },

  driver_application_approved: {
    subject: 'Application Approved — Welcome to DriveDrop! 🎉',
    sender: 'driver',
    htmlContent: emailBase('Application Approved', `
      <h2 style="margin:0 0 16px;color:${DD.text};font-size:20px;">Congratulations, {{firstName}}!</h2>
      <p>Your driver application has been <strong style="color:${DD.green};">approved</strong>! You can now start accepting shipments on DriveDrop.</p>

      ${infoBox(`
        <strong>Your Login Credentials</strong><br><br>
        <strong>Email:</strong><br>
        <span style="display:inline-block;font-family:monospace;background-color:#e5e7eb;padding:6px 12px;border-radius:4px;margin:4px 0 12px;">{{email}}</span><br>
        <strong>Temporary Password:</strong><br>
        <span style="display:inline-block;font-family:monospace;background-color:#e5e7eb;padding:6px 12px;border-radius:4px;margin:4px 0;word-break:break-all;">{{temporaryPassword}}</span>
      `, DD.green)}

      <div style="background-color:#fffbeb;border-left:3px solid ${DD.amber};padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;color:#92400e;">
        <strong>⚠️ Important — Temporary Password:</strong> This is a one-time temporary password. You will be asked to change it on your very first login. Please do not share your password with anyone.
      </div>

      ${btn('Log In Now', '{{loginUrl}}', DD.green)}

      ${infoBox(`
        <strong>Getting Started</strong>
        <ol style="margin:8px 0 0;padding-left:18px;">
          <li>Log in to your driver account</li>
          <li>Complete your profile setup</li>
          <li>Browse available shipments in your area</li>
          <li>Accept jobs and start earning!</li>
        </ol>
      `)}

      <div style="background-color:#f0fdf4;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#166534;">
        <strong>💰 Payment Info:</strong> You'll earn 90% of each shipment value. Payouts are processed weekly via your preferred method.
      </div>

      {{adminCommentHtml}}

      <p style="color:${DD.sub};font-size:13px;">
        Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};text-decoration:none;">support@drivedrop.us.com</a>
      </p>

      <p>Welcome to the team!<br><strong>The DriveDrop Team</strong></p>
    `)
  },

  admin_driver_application: {
    subject: '🚛 New Driver Application — {{fullName}} ({{licenseState}})',
    sender: 'admin',
    htmlContent: emailBase('New Driver Application Submitted', `
      <div style="background-color:#fef2f2;border-left:4px solid ${DD.red};padding:16px 20px;margin:0 0 24px;border-radius:0 6px 6px 0;">
        <strong style="color:#991b1b;font-size:15px;">⚠️ Action Required:</strong>
        <p style="margin:6px 0 0;color:#991b1b;font-size:13px;">A new driver application requires your review and approval.</p>
      </div>

      ${infoBox(`
        <strong style="font-size:16px;color:${DD.text};">Applicant Information</strong>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:8px 0;color:${DD.sub};width:40%;font-size:13px;"><strong>Full Name:</strong></td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;">{{fullName}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${DD.sub};font-size:13px;"><strong>Email:</strong></td>
            <td style="padding:8px 0;font-size:13px;"><a href="mailto:{{email}}" style="color:${DD.blue};text-decoration:none;">{{email}}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${DD.sub};font-size:13px;"><strong>Phone:</strong></td>
            <td style="padding:8px 0;font-size:13px;"><a href="tel:{{phone}}" style="color:${DD.blue};text-decoration:none;">{{phone}}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${DD.sub};font-size:13px;"><strong>Date of Birth:</strong></td>
            <td style="padding:8px 0;font-size:13px;">{{dateOfBirth}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${DD.sub};font-size:13px;"><strong>License #:</strong></td>
            <td style="padding:8px 0;font-size:13px;font-family:monospace;">{{licenseNumber}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:${DD.sub};font-size:13px;"><strong>License State:</strong></td>
            <td style="padding:8px 0;font-size:13px;">{{licenseState}}</td>
          </tr>
          {{dotNumberRow}}
          <tr>
            <td colspan="2" style="padding:12px 0 0;border-top:1px solid ${DD.border};"><strong style="color:${DD.sub};font-size:13px;">Application ID:</strong><br><span style="font-family:monospace;font-size:13px;color:${DD.text};">{{applicationId}}</span></td>
          </tr>
          <tr>
            <td colspan="2" style="padding:8px 0;"><strong style="color:${DD.sub};font-size:13px;">Submitted:</strong><br><span style="font-size:13px;color:${DD.text};">{{submittedAt}}</span></td>
          </tr>
        </table>
      `, DD.purple)}

      <div style="background-color:#fffbeb;border-left:3px solid ${DD.amber};padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;line-height:1.8;">
        <strong style="color:#92400e;">📋 Verification Status:</strong><br>
        <div style="margin-top:8px;">
          {{verificationStatus}}
        </div>
      </div>

      {{fcraConsentInfo}}

      ${btn('Review Application in Admin', '{{reviewUrl}}', DD.purple)}

      <div style="background-color:${DD.muted};padding:16px 20px;border-radius:6px;margin:24px 0 0;font-size:12px;color:${DD.sub};line-height:1.7;">
        <strong style="color:${DD.text};">Review Checklist:</strong>
        <ul style="margin:8px 0 0;padding-left:18px;">
          <li>Verify license is valid and not expired</li>
          <li>Check DOT number status (if applicable)</li>
          <li>Review MVR results for violations</li>
          <li>Confirm insurance coverage meets requirements</li>
          <li>Approve or reject within 3 business days</li>
        </ul>
      </div>

      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:24px;">This is an automated notification from the DriveDrop driver application system.</p>
    `)
  },

  service_lead: {
    subject: '🔔 New Lead: {{serviceName}} — {{contactName}}',
    sender: 'admin',
    htmlContent: emailBase('New Service Lead', `
      <p style="color:${DD.sub};font-size:14px;margin-top:0;">A new quote request from <strong style="color:${DD.text};">drivedrop.us.com/services</strong>.</p>

      ${infoBox(`
        <strong style="color:${DD.text};font-size:15px;">{{serviceName}}</strong>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:5px 0;color:${DD.sub};width:36%;font-size:13px;">Name</td>
            <td style="padding:5px 0;font-size:13px;font-weight:600;">{{contactName}}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:${DD.sub};font-size:13px;">Phone</td>
            <td style="padding:5px 0;font-size:13px;font-weight:600;">
              <a href="tel:{{phone}}" style="color:${DD.blue};text-decoration:none;">{{phone}}</a>
            </td>
          </tr>
          {{emailRow}}
        </table>
      `, DD.amber)}

      {{extrasHtml}}

      {{messageHtml}}

      ${btn('📞 Call {{contactName}} Back', 'tel:{{phone}}', DD.amber)}

      <p style="color:#9ca3af;font-size:12px;text-align:center;">Lead submitted {{submittedAt}} · Charlotte, NC</p>
    `)
  },

  document_status_updated: {
    subject: '{{statusEmoji}} Your document has been {{statusLabel}} — DriveDrop',
    sender: 'admin',
    htmlContent: emailBase('Document Review Update', `
      <p style="margin-top:0;color:${DD.sub};font-size:14px;">Hi <strong style="color:${DD.text};">{{firstName}}</strong>,</p>
      <p style="color:${DD.text};font-size:14px;">Your <strong>{{documentType}}</strong> document has been reviewed.</p>
      {{statusBlock}}
      <p style="color:${DD.sub};font-size:13px;margin-top:24px;">Questions? Email <a href="mailto:support@drivedrop.us.com" style="color:${DD.blue};">support@drivedrop.us.com</a></p>
      ${btn('Go to My Documents', '{{dashboardUrl}}', DD.blue)}
    `)
  },

  service_payment_confirmation: {
    subject: '✅ Payment Confirmed — {{serviceName}} (Ref: {{bookingRef}})',
    sender: 'admin',
    htmlContent: emailBase('Payment Confirmed', `
      <p style="margin-top:0;color:${DD.sub};font-size:14px;">Hi <strong style="color:${DD.text};">{{customerName}}</strong>,</p>
      <p style="color:${DD.text};font-size:14px;">Your payment has been received. Here are your booking details:</p>
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:5px 0;color:${DD.sub};width:40%;font-size:13px;">Service</td><td style="padding:5px 0;font-size:14px;font-weight:600;">{{serviceName}}</td></tr>
          <tr><td style="padding:5px 0;color:${DD.sub};font-size:13px;">Reference</td><td style="padding:5px 0;font-size:14px;font-weight:700;font-family:monospace;">{{bookingRef}}</td></tr>
          <tr><td style="padding:5px 0;color:${DD.sub};font-size:13px;">Amount Paid</td><td style="padding:5px 0;font-size:18px;font-weight:800;color:${DD.green};">{{amountFormatted}}</td></tr>
          <tr><td style="padding:5px 0;color:${DD.sub};font-size:13px;">Date</td><td style="padding:5px 0;font-size:13px;">{{paidAt}}</td></tr>
        </table>
      `, DD.green)}
      <p style="color:${DD.sub};font-size:13px;">Our team will confirm scheduling shortly. Call us: <a href="tel:+17042662317" style="color:${DD.blue};font-weight:600;">+1 (704) 266-2317</a></p>
    `)
  },

  // ─── Placeholders ───────────────────────────────────────────────
  quote_received:       { subject: 'Quote Received', sender: 'client', htmlContent: '' },
  payment_received:     { subject: 'Payment Received', sender: 'client', htmlContent: '' },
  pickup_reminder:      { subject: 'Pickup Reminder', sender: 'driver', htmlContent: '' },
  delivery_reminder:    { subject: 'Delivery Reminder', sender: 'driver', htmlContent: '' },
  payment_processed:    { subject: 'Payment Processed', sender: 'driver', htmlContent: '' },
  broker_load_synced:   { subject: 'Load Synced', sender: 'broker', htmlContent: '' },
  broker_load_matched:  { subject: 'Load Matched', sender: 'broker', htmlContent: '' },
  commission_report:    { subject: 'Commission Report', sender: 'broker', htmlContent: '' },
  admin_new_user:       { subject: 'New User Registration', sender: 'admin', htmlContent: '' },
  admin_daily_summary:  { subject: 'Daily Summary', sender: 'admin', htmlContent: '' },
};
