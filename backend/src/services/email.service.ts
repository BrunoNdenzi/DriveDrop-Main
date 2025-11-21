import * as brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
}

interface WelcomeEmailData {
  firstName: string;
  email: string;
}

interface PasswordResetData {
  firstName: string;
  resetLink: string;
  email: string;
}

interface ShipmentNotificationData {
  recipientName: string;
  shipmentId: string;
  status: string;
  trackingUrl?: string;
  email: string;
}

interface EmailVerificationData {
  firstName: string;
  verificationLink: string;
  email: string;
}

interface BookingConfirmationData {
  firstName: string;
  email: string;
  shipmentId: string;
  trackingUrl: string;
  
  // Shipment details
  pickupAddress: string;
  deliveryAddress: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string;
  estimatedDeliveryDate?: string;
  
  // Pricing breakdown
  distanceMiles: number;
  distanceBand: string; // 'short' | 'mid' | 'long'
  baseRate: number;
  rawPrice: number;
  deliverySpeedMultiplier: number;
  deliverySpeedType: string; // 'expedited' | 'standard' | 'flexible'
  fuelAdjustmentPercent: number;
  fuelPricePerGallon: number;
  bulkDiscountPercent: number;
  subtotal: number;
  totalPrice: number;
  
  // Payment details
  upfrontAmount: number; // 20%
  remainingAmount: number; // 80%
  paymentMethod: string; // last 4 digits
  chargedDate: string;
  
  // Receipt
  receiptNumber: string;
}

interface DeliveryReceiptData {
  // Client info
  firstName: string;
  email: string;
  
  // Shipment info
  shipmentId: string;
  trackingUrl: string;
  pickupAddress: string;
  deliveryAddress: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  
  // Pricing
  totalPrice: number;
  upfrontAmount: number;
  upfrontDate: string;
  finalAmount: number;
  finalDate: string;
  paymentMethod: string;
  
  // Delivery details
  deliveredDate: string;
  deliveredTime: string;
  driverName: string;
  deliveryPhotoUrls?: string[];
  
  // Receipt
  receiptNumber: string;
}

interface DriverPayoutData {
  firstName: string;
  email: string;
  shipmentId: string;
  totalPrice: number;
  platformFee: number; // 20%
  driverEarnings: number; // 80%
  payoutMethod: string;
  expectedPayoutDays: string;
  deliveredDate: string;
}

class EmailService {
  private apiInstance!: brevo.TransactionalEmailsApi;
  private gmailTransporter: nodemailer.Transporter | null = null;
  private defaultSender: { name: string; email: string };
  private isConfigured: boolean;
  private gmailConfigured: boolean;

  constructor() {
    this.isConfigured = false;
    this.gmailConfigured = false;
    // Using authenticated domain sender with verified mailbox
    this.defaultSender = {
      name: 'DriveDrop',
      email: 'support@drivedrop.us.com',
    };

    this.initializeBrevo();
    this.initializeGmailSMTP();
  }

  private initializeBrevo(): void {
    try {
      const apiKey = process.env['BREVO_API_KEY'];

      if (!apiKey) {
        logger.warn('⚠️ BREVO_API_KEY not found in environment variables. Brevo email service disabled.');
        return;
      }

      // Initialize Brevo API client
      this.apiInstance = new brevo.TransactionalEmailsApi();
      this.apiInstance.setApiKey(
        brevo.TransactionalEmailsApiApiKeys.apiKey,
        apiKey
      );

      this.isConfigured = true;
      logger.info('✅ Brevo email service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Brevo email service:', { error });
    }
  }

  private initializeGmailSMTP(): void {
    try {
      const gmailUser = process.env['GMAIL_USER'];
      const gmailAppPassword = process.env['GMAIL_APP_PASSWORD'];

      if (!gmailUser || !gmailAppPassword) {
        logger.warn('⚠️ Gmail SMTP not configured. Gmail delivery will use Brevo.');
        return;
      }

      // Initialize Gmail SMTP transporter
      this.gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      this.gmailConfigured = true;
      logger.info('✅ Gmail SMTP initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Gmail SMTP:', { error });
    }
  }

  /**
   * Send email via Gmail SMTP
   */
  private async sendViaGmail(options: EmailOptions, sender: { name: string; email: string }): Promise<boolean> {
    if (!this.gmailTransporter) {
      return false;
    }

    try {
      const recipientEmail = Array.isArray(options.to) ? options.to[0] : options.to;

      const mailOptions = {
        from: `${sender.name} <${process.env['GMAIL_USER']}>`,
        to: recipientEmail,
        subject: options.subject,
        html: options.htmlContent,
        text: options.textContent,
        replyTo: options.replyTo,
      };

      const info = await this.gmailTransporter.sendMail(mailOptions);

      logger.info('✅ Email sent via Gmail SMTP', {
        messageId: info.messageId,
        to: recipientEmail,
        subject: options.subject,
        sender: 'Gmail SMTP',
      });

      return true;
    } catch (error: any) {
      logger.error('❌ Failed to send email via Gmail SMTP:', {
        error: error.message,
        to: options.to,
      });
      return false;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Prepare sender
    const sender = {
      name: options.senderName || this.defaultSender.name,
      email: options.senderEmail || this.defaultSender.email,
    };

    const recipientEmail = Array.isArray(options.to) ? options.to[0] : options.to;

    // Try Gmail SMTP first if configured (works for all recipients, not just Gmail)
    if (this.gmailConfigured) {
      logger.info('📧 Attempting to send via Gmail SMTP:', { to: recipientEmail });
      const gmailResult = await this.sendViaGmail(options, sender);
      if (gmailResult) {
        return true;
      }
      logger.warn('⚠️ Gmail SMTP failed, falling back to Brevo...');
    }

    // Fallback to Brevo if Gmail SMTP not configured or failed
    if (!this.isConfigured) {
      logger.warn('⚠️ Email service not configured. Skipping email send.');
      return false;
    }

    try {
      // Prepare recipient list
      const recipients = Array.isArray(options.to)
        ? options.to.map(email => ({ email }))
        : [{ email: options.to }];

      // Prepare email data
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = sender;
      sendSmtpEmail.to = recipients;
      sendSmtpEmail.subject = options.subject;
      sendSmtpEmail.htmlContent = options.htmlContent;
      
      if (options.textContent) {
        sendSmtpEmail.textContent = options.textContent;
      }

      if (options.replyTo) {
        sendSmtpEmail.replyTo = { email: options.replyTo };
      }

      // Send email via Brevo
      const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      
      logger.info('✅ Email sent via Brevo', {
        messageId: (response as any).body?.messageId || 'unknown',
        to: options.to,
        subject: options.subject,
        sender: sender.email,
      });

      return true;
    } catch (error: any) {
      logger.error('❌ Failed to send email via Brevo:', {
        error: error.message,
        errorBody: error.response?.body || error.body || 'No error body',
        statusCode: error.response?.statusCode || error.statusCode,
        to: options.to,
        subject: options.subject,
        sender: sender.email,
      });
      return false;
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to DriveDrop</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to DriveDrop! 🚗📦</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for joining DriveDrop! We're excited to have you on board.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              DriveDrop is your trusted platform for convenient and reliable package delivery services. 
              Whether you're sending or receiving, we've got you covered.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="color: #00B8A9; margin-top: 0;">Getting Started</h2>
              <ul style="padding-left: 20px;">
                <li style="margin-bottom: 10px;">Complete your profile</li>
                <li style="margin-bottom: 10px;">Browse available drivers</li>
                <li style="margin-bottom: 10px;">Create your first shipment</li>
                <li style="margin-bottom: 10px;">Track your deliveries in real-time</li>
              </ul>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              If you have any questions, our support team is here to help!
            </p>
            
            <p style="font-size: 16px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      Welcome to DriveDrop!
      
      Hi ${data.firstName},
      
      Thank you for joining DriveDrop! We're excited to have you on board.
      
      DriveDrop is your trusted platform for convenient and reliable package delivery services.
      
      Getting Started:
      - Complete your profile
      - Browse available drivers
      - Create your first shipment
      - Track your deliveries in real-time
      
      If you have any questions, our support team is here to help!
      
      Best regards,
      The DriveDrop Team
      
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: '🎉 Welcome to DriveDrop!',
      htmlContent,
      textContent,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request 🔒</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              We received a request to reset your password for your DriveDrop account.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 30px;">
              Click the button below to reset your password. This link will expire in 1 hour.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetLink}" 
                 style="display: inline-block; background: #00B8A9; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you didn't request this password reset, you can safely ignore this email. 
              Your password will remain unchanged.
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:
              <br>
              <a href="${data.resetLink}" style="color: #00B8A9; word-break: break-all;">${data.resetLink}</a>
            </p>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      Password Reset Request
      
      Hi ${data.firstName},
      
      We received a request to reset your password for your DriveDrop account.
      
      Click the link below to reset your password. This link will expire in 1 hour.
      
      ${data.resetLink}
      
      If you didn't request this password reset, you can safely ignore this email.
      
      Best regards,
      The DriveDrop Team
      
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: '🔒 Reset Your DriveDrop Password',
      htmlContent,
      textContent,
    });
  }

  /**
   * Send shipment notification email
   */
  async sendShipmentNotification(data: ShipmentNotificationData): Promise<boolean> {
    const statusMessages: Record<string, string> = {
      pending: 'Your shipment has been created and is waiting for a driver.',
      accepted: 'A driver has accepted your shipment!',
      in_progress: 'Your driver is on the way to pick up your package.',
      picked_up: 'Your package has been picked up and is in transit.',
      in_transit: 'Your package is on its way to the destination.',
      delivered: '🎉 Your package has been delivered successfully!',
      cancelled: 'Your shipment has been cancelled.',
    };

    const message = statusMessages[data.status] || 'Your shipment status has been updated.';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Shipment Update</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Shipment Update 📦</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.recipientName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <p style="margin: 0; color: #666; font-size: 14px;">Shipment ID</p>
              <p style="margin: 5px 0 15px 0; font-size: 18px; font-weight: bold; color: #00B8A9;">${data.shipmentId}</p>
              
              <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">Status</p>
              <p style="margin: 5px 0; font-size: 16px; font-weight: bold; text-transform: capitalize;">${data.status.replace('_', ' ')}</p>
            </div>
            
            ${data.trackingUrl ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.trackingUrl}" 
                   style="display: inline-block; background: #00B8A9; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                  Track Shipment
                </a>
              </div>
            ` : ''}
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      Shipment Update
      
      Hi ${data.recipientName},
      
      ${message}
      
      Shipment ID: ${data.shipmentId}
      Status: ${data.status.replace('_', ' ')}
      
      ${data.trackingUrl ? `Track your shipment: ${data.trackingUrl}` : ''}
      
      Best regards,
      The DriveDrop Team
      
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: `📦 Shipment Update - ${data.status.replace('_', ' ')}`,
      htmlContent,
      textContent,
    });
  }

  /**
   * Send driver application notification
   */
  async sendDriverApplicationEmail(email: string, firstName: string, status: 'received' | 'approved' | 'rejected'): Promise<boolean> {
    const statusMessages = {
      received: {
        subject: '✅ Driver Application Received',
        title: 'Application Received',
        message: 'Thank you for applying to become a DriveDrop driver! We have received your application and will review it shortly. You will receive an email once we have made a decision.',
      },
      approved: {
        subject: '🎉 Driver Application Approved',
        title: 'Congratulations!',
        message: 'Your driver application has been approved! You can now start accepting shipments on DriveDrop. Log in to your account to get started.',
      },
      rejected: {
        subject: 'Driver Application Update',
        title: 'Application Status',
        message: 'Thank you for your interest in becoming a DriveDrop driver. Unfortunately, we are unable to approve your application at this time. You may reapply in the future.',
      },
    };

    const { subject, title, message } = statusMessages[status];

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${title}</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      htmlContent,
    });
  }

  /**
   * Send email verification link
   */
  async sendEmailVerification(data: EmailVerificationData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email 📧</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Welcome to DriveDrop! To complete your registration and start using our platform, 
              please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.verificationLink}" 
                 style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 14px; color: #00B8A9; word-break: break-all;">
              ${data.verificationLink}
            </p>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 30px; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⚠️ <strong>Security Notice:</strong> This verification link will expire in 24 hours. 
                If you didn't create a DriveDrop account, please ignore this email.
              </p>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      Verify Your Email
      
      Hi ${data.firstName},
      
      Welcome to DriveDrop! To complete your registration, please verify your email address by clicking the link below:
      
      ${data.verificationLink}
      
      Security Notice: This verification link will expire in 24 hours. If you didn't create a DriveDrop account, please ignore this email.
      
      Best regards,
      The DriveDrop Team
      
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: '📧 Verify Your DriveDrop Email Address',
      htmlContent,
      textContent,
    });
  }

  /**
   * Send booking confirmation with receipt (after 20% payment capture)
   */
  async sendBookingConfirmationEmail(data: BookingConfirmationData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Booking Confirmed!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Receipt #${data.receiptNumber}</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your vehicle transport has been successfully booked! We've received your upfront payment and your shipment is now being prepared.
            </p>

            <!-- Shipment Details -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00B8A9;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">📦 Shipment Details</h2>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Shipment ID</p>
              <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">${data.shipmentId}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Vehicle</p>
              <p style="margin: 0 0 15px 0; font-size: 16px;">${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">From</p>
              <p style="margin: 0 0 15px 0; font-size: 14px;">${data.pickupAddress}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">To</p>
              <p style="margin: 0 0 15px 0; font-size: 14px;">${data.deliveryAddress}</p>
              
              ${data.estimatedDeliveryDate ? `
                <p style="margin: 5px 0; color: #666; font-size: 14px;">Estimated Delivery</p>
                <p style="margin: 0; font-size: 16px; font-weight: bold; color: #00B8A9;">${data.estimatedDeliveryDate}</p>
              ` : ''}
            </div>

            <!-- Pricing Breakdown -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">💰 Pricing Breakdown</h2>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Distance</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.distanceMiles.toLocaleString()} miles</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Vehicle Type</td>
                  <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${data.vehicleType}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Distance Band</td>
                  <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${data.distanceBand}-distance</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Base Rate</td>
                  <td style="padding: 8px 0; text-align: right;">$${data.baseRate.toFixed(2)}/mile</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Raw Price</td>
                  <td style="padding: 8px 0; text-align: right;">$${data.rawPrice.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Delivery Speed</td>
                  <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${data.deliverySpeedType} (${data.deliverySpeedMultiplier}x)</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 8px 0; color: #666;">Fuel Adjustment</td>
                  <td style="padding: 8px 0; text-align: right;">${data.fuelAdjustmentPercent > 0 ? '+' : ''}${data.fuelAdjustmentPercent}% ($${ data.fuelPricePerGallon.toFixed(2)}/gal)</td>
                </tr>
                ${data.bulkDiscountPercent > 0 ? `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px 0; color: #666;">Bulk Discount</td>
                    <td style="padding: 8px 0; text-align: right; color: #00B8A9;">-${data.bulkDiscountPercent}%</td>
                  </tr>
                ` : ''}
                <tr style="border-bottom: 2px solid #00B8A9; background: #f0fffe;">
                  <td style="padding: 12px 0; font-weight: bold; font-size: 16px;">TOTAL</td>
                  <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px; color: #00B8A9;">$${data.totalPrice.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- Payment Details -->
            <div style="background: #e8f5f4; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00B8A9;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">💳 Payment Details</h2>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Upfront Payment (20%)</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #28a745;">$${data.upfrontAmount.toFixed(2)} ✓ Charged</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Remaining (80%)</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${data.remainingAmount.toFixed(2)} ⏳ Reserved</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment Method</td>
                  <td style="padding: 8px 0; text-align: right;">•••• ${data.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Charged On</td>
                  <td style="padding: 8px 0; text-align: right;">${data.chargedDate}</td>
                </tr>
              </table>

              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px; border-radius: 4px;">
                <p style="margin: 0; font-size: 13px; color: #856404;">
                  💡 <strong>Payment Info:</strong> The remaining 80% will be automatically charged when your vehicle is delivered.
                </p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.trackingUrl}" 
                 style="display: inline-block; background: #00B8A9; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 0 10px 10px 0;">
                Track Shipment
              </a>
            </div>

            <!-- What's Next -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">📋 What's Next?</h2>
              <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                <li>We'll match your shipment with a verified driver</li>
                <li>You'll receive a notification when a driver accepts</li>
                <li>Track your shipment in real-time via the app or website</li>
                <li>Remaining payment will be charged upon delivery</li>
                <li>You'll receive a final receipt after delivery</li>
              </ol>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
            </p>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Receipt #${data.receiptNumber} | ${data.chargedDate}</p>
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      BOOKING CONFIRMED - Receipt #${data.receiptNumber}
      
      Hi ${data.firstName},
      
      Your vehicle transport has been successfully booked!
      
      SHIPMENT DETAILS
      ━━━━━━━━━━━━━━━━━━━━━
      Shipment ID: ${data.shipmentId}
      Vehicle: ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}
      From: ${data.pickupAddress}
      To: ${data.deliveryAddress}
      ${data.estimatedDeliveryDate ? `Estimated Delivery: ${data.estimatedDeliveryDate}` : ''}
      
      PRICING BREAKDOWN
      ━━━━━━━━━━━━━━━━━━━━━
      Distance: ${data.distanceMiles.toLocaleString()} miles (${data.distanceBand}-distance)
      Base Rate: $${data.baseRate.toFixed(2)}/mile
      Raw Price: $${data.rawPrice.toFixed(2)}
      Delivery Speed: ${data.deliverySpeedType} (${data.deliverySpeedMultiplier}x)
      Fuel Adjustment: ${data.fuelAdjustmentPercent > 0 ? '+' : ''}${data.fuelAdjustmentPercent}%
      ${data.bulkDiscountPercent > 0 ? `Bulk Discount: -${data.bulkDiscountPercent}%` : ''}
      
      TOTAL: $${data.totalPrice.toFixed(2)}
      
      PAYMENT DETAILS
      ━━━━━━━━━━━━━━━━━━━━━
      Upfront Payment (20%): $${data.upfrontAmount.toFixed(2)} ✓ Charged
      Remaining (80%): $${data.remainingAmount.toFixed(2)} ⏳ Reserved
      Payment Method: •••• ${data.paymentMethod}
      Charged On: ${data.chargedDate}
      
      The remaining 80% will be automatically charged when your vehicle is delivered.
      
      Track your shipment: ${data.trackingUrl}
      
      Best regards,
      The DriveDrop Team
      
      Receipt #${data.receiptNumber} | ${data.chargedDate}
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: `✅ Booking Confirmed - Shipment #${data.shipmentId} | DriveDrop`,
      htmlContent,
      textContent,
    });
  }

  /**
   * Send delivery receipt (after 80% payment capture)
   */
  async sendDeliveryReceiptEmail(data: DeliveryReceiptData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Delivery Complete</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Delivery Complete!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Receipt #${data.receiptNumber}</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! Your ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel} has been successfully delivered. 
              Here's your final receipt.
            </p>

            <!-- Delivery Details -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #28a745;">
              <h2 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">✓ Delivery Confirmation</h2>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Delivered On</p>
              <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">${data.deliveredDate} at ${data.deliveredTime}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Driver</p>
              <p style="margin: 0 0 15px 0; font-size: 16px;">${data.driverName}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Shipment ID</p>
              <p style="margin: 0; font-size: 16px;">${data.shipmentId}</p>
            </div>

            <!-- Payment Summary -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">💳 Payment Summary</h2>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;">Total Amount</td>
                  <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: bold;">$${data.totalPrice.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee; background: #f9f9f9;">
                  <td style="padding: 12px 0; color: #666;">
                    Upfront Payment (20%)
                    <br><span style="font-size: 12px; color: #999;">Charged on ${data.upfrontDate}</span>
                  </td>
                  <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #666;">$${data.upfrontAmount.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 2px solid #28a745; background: #f0fff4;">
                  <td style="padding: 12px 0; color: #666;">
                    <span style="font-weight: bold; color: #28a745;">Final Payment (80%) ✓</span>
                    <br><span style="font-size: 12px; color: #999;">Charged on ${data.finalDate}</span>
                  </td>
                  <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 16px; color: #28a745;">$${data.finalAmount.toFixed(2)}</td>
                </tr>
              </table>

              <div style="margin-top: 15px; padding: 12px; background: #e8f5e9; border-radius: 4px; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                  ✓ <strong>Payment Complete</strong> - All charges processed successfully
                </p>
              </div>
              
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
                Payment Method: •••• ${data.paymentMethod}
              </p>
            </div>

            <!-- Route Summary -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">📍 Route Summary</h2>
              
              <div style="position: relative; padding-left: 20px; border-left: 3px solid #00B8A9;">
                <div style="margin-bottom: 20px;">
                  <div style="position: absolute; left: -9px; width: 14px; height: 14px; background: #00B8A9; border-radius: 50%; border: 3px solid white;"></div>
                  <p style="margin: 0; color: #666; font-size: 12px;">PICKUP</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">${data.pickupAddress}</p>
                </div>
                
                <div>
                  <div style="position: absolute; left: -9px; width: 14px; height: 14px; background: #28a745; border-radius: 50%; border: 3px solid white;"></div>
                  <p style="margin: 0; color: #666; font-size: 12px;">DELIVERY</p>
                  <p style="margin: 5px 0 0 0; font-size: 14px;">${data.deliveryAddress}</p>
                </div>
              </div>
            </div>

            ${data.deliveryPhotoUrls && data.deliveryPhotoUrls.length > 0 ? `
              <!-- Delivery Photos -->
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">📸 Delivery Photos</h2>
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <a href="${data.trackingUrl}" style="color: #00B8A9; text-decoration: none;">View delivery photos →</a>
                </p>
              </div>
            ` : ''}

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.trackingUrl}" 
                 style="display: inline-block; background: #00B8A9; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 0 10px 10px 0;">
                View Shipment Details
              </a>
            </div>

            <!-- Feedback Request -->
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⭐ <strong>How was your experience?</strong> We'd love to hear your feedback about ${data.driverName}'s service.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
            </p>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Thank you for choosing DriveDrop!</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Receipt #${data.receiptNumber} | ${data.finalDate}</p>
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      DELIVERY COMPLETE - Receipt #${data.receiptNumber}
      
      Hi ${data.firstName},
      
      Great news! Your ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel} has been successfully delivered.
      
      DELIVERY CONFIRMATION
      ━━━━━━━━━━━━━━━━━━━━━
      Delivered On: ${data.deliveredDate} at ${data.deliveredTime}
      Driver: ${data.driverName}
      Shipment ID: ${data.shipmentId}
      
      PAYMENT SUMMARY
      ━━━━━━━━━━━━━━━━━━━━━
      Total Amount: $${data.totalPrice.toFixed(2)}
      
      Upfront Payment (20%): $${data.upfrontAmount.toFixed(2)}
      Charged on ${data.upfrontDate}
      
      Final Payment (80%): $${data.finalAmount.toFixed(2)} ✓
      Charged on ${data.finalDate}
      
      Payment Method: •••• ${data.paymentMethod}
      ✓ Payment Complete - All charges processed successfully
      
      ROUTE SUMMARY
      ━━━━━━━━━━━━━━━━━━━━━
      From: ${data.pickupAddress}
      To: ${data.deliveryAddress}
      
      View shipment details: ${data.trackingUrl}
      
      Thank you for choosing DriveDrop!
      The DriveDrop Team
      
      Receipt #${data.receiptNumber} | ${data.finalDate}
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: `🎉 Delivery Complete - Receipt for Shipment #${data.shipmentId} | DriveDrop`,
      htmlContent,
      textContent,
    });
  }

  /**
   * Send driver payout notification (sent to driver after delivery)
   */
  async sendDriverPayoutNotification(data: DriverPayoutData): Promise<boolean> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payout on the Way</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">💰 Payout Confirmed!</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.firstName},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Congratulations on completing shipment <strong>#${data.shipmentId}</strong>! 
              Your earnings are being processed and will be sent to your account.
            </p>

            <!-- Earnings Breakdown -->
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #28a745;">
              <h2 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">💵 Your Earnings</h2>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;">Total Shipment Value</td>
                  <td style="padding: 12px 0; text-align: right; font-size: 16px;">$${data.totalPrice.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;">Platform Fee (20%)</td>
                  <td style="padding: 12px 0; text-align: right; color: #999;">-$${data.platformFee.toFixed(2)}</td>
                </tr>
                <tr style="border-bottom: 3px solid #28a745; background: #f0fff4;">
                  <td style="padding: 15px 0; font-weight: bold; font-size: 16px; color: #28a745;">Your Net Payout (80%)</td>
                  <td style="padding: 15px 0; text-align: right; font-weight: bold; font-size: 24px; color: #28a745;">$${data.driverEarnings.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- Payout Details -->
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 30px 0;">
              <h2 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">📅 Payout Details</h2>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Payout Method</p>
              <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">${data.payoutMethod}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Expected Arrival</p>
              <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold;">${data.expectedPayoutDays}</p>
              
              <p style="margin: 5px 0; color: #666; font-size: 14px;">Delivery Completed</p>
              <p style="margin: 0; font-size: 16px;">${data.deliveredDate}</p>
            </div>

            <!-- Info Box -->
            <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #0c5460;">
                ℹ️ <strong>Payment Processing:</strong> Payouts are processed via ${data.payoutMethod} and typically arrive within ${data.expectedPayoutDays}. You'll receive a notification once the transfer is complete.
              </p>
            </div>

            <!-- Keep Driving -->
            <div style="text-align: center; background: white; padding: 25px; border-radius: 8px; margin: 30px 0;">
              <h3 style="margin: 0 0 10px 0; color: #00B8A9; font-size: 18px;">🚗 Keep Driving!</h3>
              <p style="margin: 0; font-size: 14px; color: #666;">
                Check the app for new shipments available in your area.
              </p>
            </div>

            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Questions about your payout? Contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
            </p>
            
            <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Great job!</p>
            <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
            <p>Shipment #${data.shipmentId} | ${data.deliveredDate}</p>
            <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      PAYOUT CONFIRMED
      
      Hi ${data.firstName},
      
      Congratulations on completing shipment #${data.shipmentId}!
      
      YOUR EARNINGS
      ━━━━━━━━━━━━━━━━━━━━━
      Total Shipment Value: $${data.totalPrice.toFixed(2)}
      Platform Fee (20%): -$${data.platformFee.toFixed(2)}
      
      YOUR NET PAYOUT (80%): $${data.driverEarnings.toFixed(2)}
      
      PAYOUT DETAILS
      ━━━━━━━━━━━━━━━━━━━━━
      Payout Method: ${data.payoutMethod}
      Expected Arrival: ${data.expectedPayoutDays}
      Delivery Completed: ${data.deliveredDate}
      
      Payouts are processed via ${data.payoutMethod} and typically arrive within ${data.expectedPayoutDays}.
      
      Great job!
      The DriveDrop Team
      
      Shipment #${data.shipmentId} | ${data.deliveredDate}
      © ${new Date().getFullYear()} DriveDrop. All rights reserved.
    `;

    return this.sendEmail({
      to: data.email,
      subject: `💰 Payout Confirmed - $${data.driverEarnings.toFixed(2)} | DriveDrop`,
      htmlContent,
      textContent,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
