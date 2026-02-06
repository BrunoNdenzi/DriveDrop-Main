export type EmailRole = 'client' | 'driver' | 'broker' | 'admin';

export interface EmailRecipient {
  email: string;
  name: string;
}

export interface EmailTemplateData {
  [key: string]: any;
}

export type EmailTemplateType =
  | 'client_welcome'
  | 'driver_welcome'
  | 'broker_welcome'
  | 'shipment_created'
  | 'quote_received'
  | 'carrier_assigned'
  | 'pickup_confirmed'
  | 'delivery_confirmed'
  | 'payment_received'
  | 'load_available'
  | 'load_assigned'
  | 'pickup_reminder'
  | 'delivery_reminder'
  | 'payment_processed'
  | 'broker_load_synced'
  | 'broker_load_matched'
  | 'commission_report'
  | 'password_reset'
  | 'email_verification'
  | 'admin_new_user'
  | 'admin_daily_summary';

export interface EmailTemplate {
  templateId?: number;
  subject: string;
  htmlContent: string;
  textContent?: string;
  sender: EmailRole;
}

export interface SendEmailParams {
  to: EmailRecipient[];
  templateType: EmailTemplateType;
  templateData: EmailTemplateData;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: string;
  attachments?: Array<{
    content: string;
    name: string;
  }>;
}

export interface EmailLog {
  userId?: string;
  emailType: EmailTemplateType;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  brevoMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}
