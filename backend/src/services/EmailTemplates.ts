import { EmailTemplate, EmailTemplateType } from '../types/email.types';

const DRIVEDROP_BRAND = {
  primary: '#00B8A9',
  secondary: '#FF9800',
  dark: '#263238',
  light: '#F7F9FC',
};

const emailBaseStyle = `
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, ${DRIVEDROP_BRAND.primary} 0%, #008C7F 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 30px; color: ${DRIVEDROP_BRAND.dark}; line-height: 1.6; }
    .button { display: inline-block; background: ${DRIVEDROP_BRAND.primary}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #008C7F; }
    .info-box { background: ${DRIVEDROP_BRAND.light}; border-left: 4px solid ${DRIVEDROP_BRAND.primary}; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #666; font-size: 14px; }
    .footer a { color: ${DRIVEDROP_BRAND.primary}; text-decoration: none; }
    h2 { color: ${DRIVEDROP_BRAND.primary}; font-size: 24px; margin-top: 0; }
    .status-badge { display: inline-block; background: ${DRIVEDROP_BRAND.secondary}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  </style>
`;

export const EmailTemplates: Record<EmailTemplateType, EmailTemplate> = {
  // CLIENT EMAILS
  client_welcome: {
    subject: 'Welcome to DriveDrop - Your Vehicle Shipping Partner',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚗 Welcome to DriveDrop!</h1>
          </div>
          <div class="content">
            <h2>Hi {{firstName}},</h2>
            <p>Welcome to DriveDrop, Carolina' premier vehicle shipping platform! We're excited to help you ship vehicles safely and efficiently.</p>
            
            <div class="info-box">
              <strong>🎯 What you can do now:</strong>
              <ul>
                <li>Get instant quotes for vehicle shipments</li>
                <li>Track shipments in real-time with GPS</li>
                <li>Access our network of verified carriers</li>
                <li>Manage all shipments from one dashboard</li>
              </ul>
            </div>

            <p>Ready to ship your first vehicle?</p>
            <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>

            <p>Need help getting started? Our support team is here for you at <strong>support@drivedrop.us.com</strong></p>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            Vehicle Shipping Made Simple<br>
            <a href="mailto:support@drivedrop.us.com">support@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `Welcome to DriveDrop, {{firstName}}!\n\nWe're excited to help you ship vehicles safely and efficiently across Carolina.\n\nAccess your dashboard: {{dashboardUrl}}\n\nNeed help? Contact us at support@drivedrop.us.com`
  },

  shipment_created: {
    subject: 'Shipment Created - {{shipmentId}}',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Shipment Created</h1>
          </div>
          <div class="content">
            <h2>Shipment {{shipmentId}}</h2>
            <p>Hi {{firstName}},</p>
            <p>Your vehicle shipment has been created successfully!</p>

            <div class="info-box">
              <strong>Shipment Details:</strong><br>
              <strong>ID:</strong> {{shipmentId}}<br>
              <strong>Vehicle:</strong> {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}<br>
              <strong>From:</strong> {{pickupCity}}, {{pickupState}}<br>
              <strong>To:</strong> {{deliveryCity}}, {{deliveryState}}<br>
              <strong>Pickup Date:</strong> {{pickupDate}}<br>
              <strong>Status:</strong> <span class="status-badge">{{status}}</span>
            </div>

            <p>We're matching your shipment with the best available carriers. You'll receive a notification once a carrier is assigned.</p>

            <a href="{{trackingUrl}}" class="button">Track Shipment</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            <a href="{{trackingUrl}}">Track Your Shipment</a> | <a href="mailto:support@drivedrop.us.com">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `,
    textContent: `Shipment Created: {{shipmentId}}\n\nVehicle: {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}\nRoute: {{pickupCity}}, {{pickupState}} → {{deliveryCity}}, {{deliveryState}}\n\nTrack: {{trackingUrl}}`
  },

  carrier_assigned: {
    subject: 'Carrier Assigned - {{shipmentId}}',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚛 Carrier Assigned!</h1>
          </div>
          <div class="content">
            <h2>Great news, {{firstName}}!</h2>
            <p>A verified carrier has been assigned to your shipment.</p>

            <div class="info-box">
              <strong>Carrier Information:</strong><br>
              <strong>Company:</strong> {{carrierName}}<br>
              <strong>Driver:</strong> {{driverName}}<br>
              <strong>Phone:</strong> {{driverPhone}}<br>
              <strong>Rating:</strong> ⭐ {{driverRating}}/5.0<br><br>
              <strong>Pickup:</strong> {{pickupDate}} at {{pickupTime}}<br>
              <strong>Est. Delivery:</strong> {{deliveryDate}}
            </div>

            <p>Your driver will contact you 24 hours before pickup to confirm details.</p>

            <a href="{{trackingUrl}}" class="button">Track Live</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            Questions? Contact <a href="mailto:support@drivedrop.us.com">support@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  pickup_confirmed: {
    subject: 'Vehicle Picked Up - {{shipmentId}}',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Vehicle Picked Up</h1>
          </div>
          <div class="content">
            <h2>Your vehicle is on the way!</h2>
            <p>Hi {{firstName}},</p>
            <p>Your {{vehicleYear}} {{vehicleMake}} {{vehicleModel}} has been picked up and is now in transit.</p>

            <div class="info-box">
              <strong>Pickup Confirmation:</strong><br>
              <strong>Picked up:</strong> {{pickupTime}} on {{pickupDate}}<br>
              <strong>Location:</strong> {{pickupAddress}}<br>
              <strong>Driver:</strong> {{driverName}}<br>
              <strong>Est. Delivery:</strong> {{estimatedDelivery}}<br>
              <strong>Current Location:</strong> Live tracking available
            </div>

            <p>Track your vehicle's journey in real-time with GPS updates every 30 seconds.</p>

            <a href="{{trackingUrl}}" class="button">Track Live</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            Track 24/7: <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  delivery_confirmed: {
    subject: 'Vehicle Delivered - {{shipmentId}}',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Delivery Complete!</h1>
          </div>
          <div class="content">
            <h2>Your vehicle has been delivered!</h2>
            <p>Hi {{firstName}},</p>
            <p>Great news! Your {{vehicleYear}} {{vehicleMake}} {{vehicleModel}} has been successfully delivered.</p>

            <div class="info-box">
              <strong>Delivery Details:</strong><br>
              <strong>Delivered:</strong> {{deliveryTime}} on {{deliveryDate}}<br>
              <strong>Location:</strong> {{deliveryAddress}}<br>
              <strong>Received by:</strong> {{receiverName}}<br>
              <strong>Total Distance:</strong> {{totalMiles}} miles<br>
              <strong>Delivery Time:</strong> {{transitDays}} days
            </div>

            <p>Thank you for choosing DriveDrop! We'd love to hear about your experience.</p>

            <a href="{{reviewUrl}}" class="button">Leave a Review</a>

            <p>Need another shipment? We're here to help!</p>
            <a href="{{dashboardUrl}}">Create New Shipment</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            <a href="mailto:support@drivedrop.us.com">support@drivedrop.us.com</a> | <a href="{{dashboardUrl}}">Dashboard</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // DRIVER/CARRIER EMAILS
  driver_welcome: {
    subject: 'Welcome to DriveDrop Carrier Network',
    sender: 'driver',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚛 Welcome, Carrier!</h1>
          </div>
          <div class="content">
            <h2>Welcome to DriveDrop, {{firstName}}!</h2>
            <p>You're now part of Carolina' fastest-growing vehicle logistics network.</p>

            <div class="info-box">
              <strong>🎯 Get Started:</strong>
              <ul>
                <li>Browse available loads with AI matching</li>
                <li>Optimize routes with smart navigation</li>
                <li>Accept loads instantly</li>
                <li>Get paid fast with direct deposit</li>
              </ul>
            </div>

            <p><strong>Your carrier profile is live!</strong> Start accepting loads now.</p>

            <a href="{{dashboardUrl}}" class="button">View Available Loads</a>

            <p>Questions? Our carrier support team is here: <strong>carrier@drivedrop.us.com</strong></p>
          </div>
          <div class="footer">
            <p><strong>DriveDrop Carrier Network</strong><br>
            <a href="mailto:carrier@drivedrop.us.com">carrier@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  load_available: {
    subject: 'New Load Match - {{route}}',
    sender: 'driver',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 New Load Available</h1>
          </div>
          <div class="content">
            <h2>Perfect match for you, {{firstName}}!</h2>
            <p>Our AI has identified a high-value load that matches your route and schedule.</p>

            <div class="info-box">
              <strong>Load Details:</strong><br>
              <strong>Route:</strong> {{pickupCity}}, {{pickupState}} → {{deliveryCity}}, {{deliveryState}}<br>
              <strong>Distance:</strong> {{distance}} miles<br>
              <strong>Pickup:</strong> {{pickupDate}}<br>
              <strong>Vehicle:</strong> {{vehicleYear}} {{vehicleMake}} {{vehicleModel}}<br>
              <strong>Rate:</strong> <strong style="color: ${DRIVEDROP_BRAND.secondary}; font-size: 20px;">{{rate}}</strong><br>
              <strong>Load ID:</strong> {{loadId}}
            </div>

            <p><strong>⚡ Act fast!</strong> This load is being shown to multiple carriers.</p>

            <a href="{{loadUrl}}" class="button">View & Accept Load</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop Carrier Network</strong><br>
            <a href="{{loadUrl}}">View Load Details</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  load_assigned: {
    subject: 'Load Confirmed - {{loadId}}',
    sender: 'driver',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Load Confirmed!</h1>
          </div>
          <div class="content">
            <h2>You've got a new load, {{firstName}}!</h2>
            <p>Congratulations! Load {{loadId}} has been assigned to you.</p>

            <div class="info-box">
              <strong>Assignment Details:</strong><br>
              <strong>Load ID:</strong> {{loadId}}<br>
              <strong>Pickup:</strong> {{pickupAddress}}<br>
              <strong>Pickup Date:</strong> {{pickupDate}} at {{pickupTime}}<br>
              <strong>Delivery:</strong> {{deliveryAddress}}<br>
              <strong>Contact:</strong> {{customerName}} - {{customerPhone}}<br>
              <strong>Payment:</strong> {{rate}} (paid on delivery)
            </div>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Review pickup instructions</li>
              <li>Contact customer 24h before pickup</li>
              <li>Complete pickup verification</li>
              <li>Enable GPS tracking</li>
            </ol>

            <a href="{{loadDetailsUrl}}" class="button">View Full Details</a>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            Support: <a href="mailto:carrier@drivedrop.us.com">carrier@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // BROKER EMAILS
  broker_welcome: {
    subject: 'Welcome to DriveDrop Broker Network',
    sender: 'broker',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🤝 Welcome to DriveDrop</h1>
          </div>
          <div class="content">
            <h2>Welcome, {{firstName}}!</h2>
            <p>You're now connected to DriveDrop's broker network with Central Dispatch, Montway, and uShip integrations.</p>

            <div class="info-box">
              <strong>🎯 Broker Benefits:</strong>
              <ul>
                <li>Sync loads from multiple platforms</li>
                <li>AI-powered carrier matching</li>
                <li>Automated dispatch workflow</li>
                <li>Commission tracking & reporting</li>
              </ul>
            </div>

            <a href="{{dashboardUrl}}" class="button">Access Broker Dashboard</a>

            <p>Questions? Contact: <strong>broker@drivedrop.us.com</strong></p>
          </div>
          <div class="footer">
            <p><strong>DriveDrop Broker Network</strong><br>
            <a href="mailto:broker@drivedrop.us.com">broker@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // UTILITY EMAILS
  password_reset: {
    subject: 'Reset Your DriveDrop Password',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Reset your password</h2>
            <p>Hi {{firstName}},</p>
            <p>We received a request to reset your DriveDrop password.</p>

            <a href="{{resetUrl}}" class="button">Reset Password</a>

            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            <a href="mailto:support@drivedrop.us.com">support@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  email_verification: {
    subject: 'Verify Your DriveDrop Email',
    sender: 'client',
    htmlContent: `
      <!DOCTYPE html>
      <html>
      <head>${emailBaseStyle}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✉️ Verify Your Email</h1>
          </div>
          <div class="content">
            <h2>Almost there, {{firstName}}!</h2>
            <p>Please verify your email address to complete your DriveDrop registration.</p>

            <a href="{{verificationUrl}}" class="button">Verify Email Address</a>

            <p>This link expires in 24 hours.</p>
          </div>
          <div class="footer">
            <p><strong>DriveDrop</strong><br>
            <a href="mailto:support@drivedrop.us.com">support@drivedrop.us.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // Additional placeholder templates (can be expanded)
  quote_received: { subject: 'Quote Received', sender: 'client', htmlContent: '' },
  payment_received: { subject: 'Payment Received', sender: 'client', htmlContent: '' },
  pickup_reminder: { subject: 'Pickup Reminder', sender: 'driver', htmlContent: '' },
  delivery_reminder: { subject: 'Delivery Reminder', sender: 'driver', htmlContent: '' },
  payment_processed: { subject: 'Payment Processed', sender: 'driver', htmlContent: '' },
  broker_load_synced: { subject: 'Load Synced', sender: 'broker', htmlContent: '' },
  broker_load_matched: { subject: 'Load Matched', sender: 'broker', htmlContent: '' },
  commission_report: { subject: 'Commission Report', sender: 'broker', htmlContent: '' },
  admin_new_user: { subject: 'New User Registration', sender: 'admin', htmlContent: '' },
  admin_daily_summary: { subject: 'Daily Summary', sender: 'admin', htmlContent: '' },
};
