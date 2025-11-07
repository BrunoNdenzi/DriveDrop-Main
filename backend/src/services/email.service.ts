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
   * Check if recipient is Gmail and route accordingly
   */
  private isGmailAddress(email: string): boolean {
    return email.toLowerCase().endsWith('@gmail.com');
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

    // Check if recipient is Gmail and we have Gmail SMTP configured
    const recipientEmail = Array.isArray(options.to) ? options.to[0] : options.to;
    const useGmailSMTP = this.gmailConfigured && recipientEmail && this.isGmailAddress(recipientEmail);

    if (useGmailSMTP) {
      logger.info('📧 Routing to Gmail SMTP for Gmail recipient:', { to: recipientEmail });
      return this.sendViaGmail(options, sender);
    }

    // Use Brevo for non-Gmail recipients
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
}

// Export singleton instance
export const emailService = new EmailService();
