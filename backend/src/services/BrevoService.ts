import * as SibApiV3Sdk from '@getbrevo/brevo';
import { createClient } from '@supabase/supabase-js';
import {
  SendEmailParams,
  EmailLog,
  EmailRole,
  EmailTemplateType,
  EmailRecipient,
  EmailTemplateData
} from '../types/email.types';
import { EmailTemplates } from './EmailTemplates';

class BrevoService {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  private supabase: ReturnType<typeof createClient>;
  private enabled: boolean;

  private senderEmails: Record<EmailRole, string> = {
    client: process.env['BREVO_SENDER_SUPPORT'] || 'support@drivedrop.us.com',
    driver: process.env['BREVO_SENDER_CARRIER'] || 'carrier@drivedrop.us.com',
    broker: process.env['BREVO_SENDER_BROKER'] || 'broker@drivedrop.us.com',
    admin: process.env['BREVO_SENDER_ADMIN'] || 'admin@drivedrop.us.com',
  };

  constructor() {
    this.enabled = process.env['BREVO_ENABLED'] === 'true';
    
    // Initialize Supabase for logging (always needed)
    this.supabase = createClient(
      process.env['SUPABASE_URL'] || '',
      process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
    );

    // Initialize Brevo API using setApiKey method
    this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, 
      process.env['BREVO_API_KEY'] || ''
    );

    if (!this.enabled) {
      console.warn('⚠️  Brevo emails are DISABLED');
    } else {
      console.log('✅ Brevo Service initialized');
    }
  }

  /**
   * Send email using template
   */
  async sendEmail(params: SendEmailParams): Promise<boolean> {
    if (!this.enabled) {
      console.log('📧 Email would be sent:', {
        to: params.to[0]?.email,
        type: params.templateType
      });
      return true;
    }

    try {
      const template = EmailTemplates[params.templateType];
      if (!template) {
        throw new Error(`Template ${params.templateType} not found`);
      }

      // Replace template variables
      const htmlContent = this.replaceVariables(template.htmlContent, params.templateData);
      const subject = this.replaceVariables(template.subject, params.templateData);
      const textContent = template.textContent 
        ? this.replaceVariables(template.textContent, params.templateData)
        : undefined;

      // Get sender email based on role
      const senderEmail = this.senderEmails[template.sender];
      const senderName = 'DriveDrop';

      // Prepare email data
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.sender = { email: senderEmail, name: senderName };
      sendSmtpEmail.to = params.to.map(recipient => ({
        email: recipient.email,
        name: recipient.name
      }));
      
      if (params.cc) {
        sendSmtpEmail.cc = params.cc.map(recipient => ({
          email: recipient.email,
          name: recipient.name
        }));
      }

      if (params.bcc) {
        sendSmtpEmail.bcc = params.bcc.map(recipient => ({
          email: recipient.email,
          name: recipient.name
        }));
      }

      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      
      if (textContent) {
        sendSmtpEmail.textContent = textContent;
      }

      if (params.replyTo) {
        sendSmtpEmail.replyTo = { email: params.replyTo };
      }

      if (params.attachments) {
        sendSmtpEmail.attachment = params.attachments;
      }

      // Send email via Brevo
      const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      // Log success
      await this.logEmail({
        recipientEmail: params.to[0]?.email || '',
        senderEmail: senderEmail,
        emailType: params.templateType,
        subject: subject,
        status: 'sent',
        brevoMessageId: (response.body as any)?.messageId || undefined,
        metadata: {
          templateData: params.templateData,
          recipients: params.to.length
        }
      });

      console.log(`✅ Email sent: ${params.templateType} to ${params.to[0]?.email}`);
      return true;

    } catch (error: any) {
      console.error('❌ Brevo email error:', error.message);

      const template = EmailTemplates[params.templateType];
      // Log failure
      await this.logEmail({
        recipientEmail: params.to[0]?.email || '',
        senderEmail: template ? this.senderEmails[template.sender] : '',
        emailType: params.templateType,
        subject: template?.subject || '',
        status: 'failed',
        errorMessage: error.message,
        metadata: { error: error.response?.body || error.message }
      });

      return false;
    }
  }

  /**
   * Send welcome email based on role
   */
  async sendWelcomeEmail(
    recipient: EmailRecipient,
    role: 'client' | 'driver' | 'broker',
    data: EmailTemplateData
  ): Promise<boolean> {
    const templateMap = {
      client: 'client_welcome' as EmailTemplateType,
      driver: 'driver_welcome' as EmailTemplateType,
      broker: 'broker_welcome' as EmailTemplateType,
    };

    return this.sendEmail({
      to: [recipient],
      templateType: templateMap[role],
      templateData: {
        firstName: data['firstName'],
        dashboardUrl: data['dashboardUrl'] || `${process.env['FRONTEND_URL']}/dashboard/${role}`,
        ...data
      }
    });
  }

  /**
   * Send shipment notification
   */
  async sendShipmentNotification(
    recipient: EmailRecipient,
    type: 'shipment_created' | 'carrier_assigned' | 'pickup_confirmed' | 'delivery_confirmed',
    shipmentData: EmailTemplateData
  ): Promise<boolean> {
    return this.sendEmail({
      to: [recipient],
      templateType: type,
      templateData: {
        ...shipmentData,
        trackingUrl: `${process.env['FRONTEND_URL']}/track/${shipmentData['shipmentId']}`,
      }
    });
  }

  /**
   * Send load notification to driver
   */
  async sendLoadNotification(
    driver: EmailRecipient,
    type: 'load_available' | 'load_assigned',
    loadData: EmailTemplateData
  ): Promise<boolean> {
    return this.sendEmail({
      to: [driver],
      templateType: type,
      templateData: {
        ...loadData,
        loadUrl: `${process.env['FRONTEND_URL']}/dashboard/driver/loads/${loadData['loadId']}`,
        loadDetailsUrl: `${process.env['FRONTEND_URL']}/dashboard/driver/loads/${loadData['loadId']}`,
      }
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    recipient: EmailRecipient,
    resetToken: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: [recipient],
      templateType: 'password_reset',
      templateData: {
        firstName: recipient.name.split(' ')[0],
        resetUrl: `${process.env['FRONTEND_URL']}/reset-password?token=${resetToken}`,
      }
    });
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(
    recipient: EmailRecipient,
    verificationToken: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: [recipient],
      templateType: 'email_verification',
      templateData: {
        firstName: recipient.name.split(' ')[0],
        verificationUrl: `${process.env['FRONTEND_URL']}/verify-email?token=${verificationToken}`,
      }
    });
  }

  /**
   * Replace template variables with actual data
   */
  private replaceVariables(template: string, data: EmailTemplateData): string {
    let result = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, data[key]?.toString() || '');
    });

    return result;
  }

  /**
   * Log email to database
   */
  private async logEmail(log: EmailLog): Promise<void> {
    try {
      await this.supabase
        .from('email_logs')
        .insert({
          user_id: log.userId,
          email_type: log.emailType,
          recipient_email: log.recipientEmail,
          sender_email: log.senderEmail,
          subject: log.subject,
          status: log.status,
          brevo_message_id: log.brevoMessageId,
          error_message: log.errorMessage,
          metadata: log.metadata,
        });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(userId?: string, days: number = 30): Promise<any> {
    try {
      let query = this.supabase
        .from('email_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        total: data?.length || 0,
        sent: data?.filter((e: any) => e.status === 'sent').length || 0,
        failed: data?.filter((e: any) => e.status === 'failed').length || 0,
        bounced: data?.filter((e: any) => e.status === 'bounced').length || 0,
      };
    } catch (error) {
      console.error('Failed to get email stats:', error);
      return { total: 0, sent: 0, failed: 0, bounced: 0 };
    }
  }
}

// Export singleton instance
export const brevoService = new BrevoService();
export default brevoService;
