/**
 * Brevo Outreach Service
 * Enhanced email sending for B2B outreach campaigns using raw SMTP API.
 * IMPORTANT: All sends are gated behind the outreachOrchestrator's daily limit.
 * The orchestrator calls this; never invoke directly for campaign sends.
 */
import * as SibApiV3Sdk from '@getbrevo/brevo';
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';

export interface OutreachEmailParams {
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderEmail?: string;
  senderName?: string;
  replyTo?: string;
  campaignId?: string;
  leadId?: string;
  tags?: string[];
  /** When true the message is logged but NOT sent (warmup/dry-run mode) */
  dryRun?: boolean;
}

export interface OutreachSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  dryRun: boolean;
}

class BrevoOutreachService {
  private api: SibApiV3Sdk.TransactionalEmailsApi;
  private defaultSender: { email: string; name: string };

  constructor() {
    this.api = new SibApiV3Sdk.TransactionalEmailsApi();
    this.api.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
      process.env['BREVO_API_KEY'] || ''
    );
    this.defaultSender = {
      email: process.env['BREVO_OUTREACH_SENDER'] || process.env['BREVO_SENDER_ADMIN'] || 'outreach@drivedrop.us.com',
      name: process.env['BREVO_OUTREACH_NAME'] || 'DriveDrop Team',
    };
  }

  /**
   * Send a single outreach email.
   * Always logs to outreach_log; only hits Brevo API when dryRun === false.
   */
  async send(params: OutreachEmailParams): Promise<OutreachSendResult> {
    const sender = {
      email: params.senderEmail || this.defaultSender.email,
      name: params.senderName || this.defaultSender.name,
    };

    // Always insert a log row
    await this.log({
      lead_id: params.leadId,
      campaign_id: params.campaignId,
      channel: 'email',
      direction: 'outbound',
      to_email: params.to.email,
      from_email: sender.email,
      subject: params.subject,
      status: params.dryRun ? 'dry_run' : 'pending',
      metadata: { tags: params.tags },
    });

    if (params.dryRun) {
      logger.info(`[Outreach DRY-RUN] would send to ${params.to.email}: "${params.subject}"`);
      return { success: true, dryRun: true };
    }

    try {
      const email = new SibApiV3Sdk.SendSmtpEmail();
      email.sender = sender;
      const toEntry: { email: string; name?: string } = { email: params.to.email };
      if (params.to.name) toEntry.name = params.to.name;
      email.to = [toEntry];
      email.subject = params.subject;
      email.htmlContent = params.htmlContent;
      if (params.textContent) email.textContent = params.textContent;
      if (params.replyTo) email.replyTo = { email: params.replyTo };
      // Brevo tags for tracking open/click rates per campaign
      if (params.tags?.length) email.tags = params.tags;

      const result = await this.api.sendTransacEmail(email);
      const messageId = (result.body as any)?.messageId || undefined;

      await this.updateLogStatus(params.to.email, params.subject, 'sent', messageId);
      logger.info(`[Outreach] sent to ${params.to.email} — messageId: ${messageId}`);

      return { success: true, messageId, dryRun: false };
    } catch (err: any) {
      const errMsg = err.response?.body?.message || err.message;
      logger.error(`[Outreach] send failed to ${params.to.email}: ${errMsg}`);
      await this.updateLogStatus(params.to.email, params.subject, 'failed', undefined, errMsg);
      return { success: false, error: errMsg, dryRun: false };
    }
  }

  /**
   * Get Brevo sending stats for a date range
   */
  async getSendingStats(startDate: string, endDate: string) {
    try {
      // Brevo doesn't expose per-day stats via the TS SDK here, so we call REST
      const url = `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, {
        headers: {
          'api-key': process.env['BREVO_API_KEY'] || '',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get bounce/spam complaint data from Brevo
   */
  async getBounceReport(startDate: string, endDate: string) {
    try {
      const url = `https://api.brevo.com/v3/smtp/statistics/events?startDate=${startDate}&endDate=${endDate}&event=bounces&limit=100`;
      const response = await fetch(url, {
        headers: {
          'api-key': process.env['BREVO_API_KEY'] || '',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { events: [] };
      return await response.json();
    } catch {
      return { events: [] };
    }
  }

  private async log(entry: Record<string, any>) {
    const { error } = await supabaseAdmin
      .from('outreach_log')
      .insert({
        ...entry,
        created_at: new Date().toISOString(),
      });
    if (error) logger.error('Failed to insert outreach_log:', error.message);
  }

  private async updateLogStatus(
    toEmail: string,
    subject: string,
    status: string,
    messageId?: string,
    errorMessage?: string
  ) {
    const update: Record<string, any> = { status };
    if (messageId) update['brevo_message_id'] = messageId;
    if (errorMessage) update['error_message'] = errorMessage;
    if (status === 'sent') update['sent_at'] = new Date().toISOString();

    // Update the most recent pending/dry_run log row for this recipient+subject
    await supabaseAdmin
      .from('outreach_log')
      .update(update)
      .eq('to_email', toEmail)
      .eq('subject', subject)
      .in('status', ['pending', 'dry_run'])
      .order('created_at', { ascending: false })
      .limit(1);
  }
}

export const brevoOutreachService = new BrevoOutreachService();
