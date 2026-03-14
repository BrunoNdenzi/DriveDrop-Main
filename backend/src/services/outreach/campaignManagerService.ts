/**
 * Campaign Manager Service
 * Manages the email campaign lifecycle: create, schedule, send, pause, complete.
 * Enforces daily rate limits, warmup mode gating, and suppression list checks.
 */
import crypto from 'crypto';
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { brevoOutreachService } from './brevoOutreachService';
import { Campaign, CampaignStats, TargetAudience, BrevoWebhookEvent } from '../../types/campaigns.types';

const WARMUP = process.env['OUTREACH_WARMUP'] !== 'false';
const DAILY_LIMIT = parseInt(process.env['OUTREACH_DAILY_LIMIT'] || '10', 10);
const SEND_INTERVAL_MS = 2000; // 1 email per 2 sec = 30/min

/**
 * Generate an unsubscribe token for a given email + campaign.
 */
function generateUnsubToken(email: string, campaignId: string): string {
  const secret = process.env['BREVO_WEBHOOK_SECRET'] || 'dd-campaign-secret';
  return crypto.createHmac('sha256', secret).update(`${email}::${campaignId}`).digest('hex');
}

/**
 * Verify an unsubscribe token.
 */
function verifyUnsubToken(token: string, email: string, campaignId: string): boolean {
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(generateUnsubToken(email, campaignId), 'hex')
  );
}

class CampaignManagerService {
  /**
   * Create a new campaign in draft status.
   */
  async createCampaign(params: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    targetAudience?: TargetAudience;
    dailyLimit?: number;
    scheduledAt?: Date;
    tags?: string[];
    notes?: string;
    createdBy: string;
  }): Promise<Campaign> {
    const row: Record<string, any> = {
      name: params.name,
      subject: params.subject,
      html_content: params.htmlContent,
      daily_limit: params.dailyLimit ?? DAILY_LIMIT,
      warmup_mode: WARMUP,
      created_by: params.createdBy,
    };
    if (params.textContent) row['text_content'] = params.textContent;
    if (params.targetAudience) row['target_audience'] = params.targetAudience;
    if (params.scheduledAt) row['scheduled_at'] = params.scheduledAt.toISOString();
    if (params.tags) row['tags'] = params.tags;
    if (params.notes) row['notes'] = params.notes;

    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .insert(row)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create campaign: ${error.message}`);
    return this.mapCampaign(data as Record<string, any>);
  }

  /**
   * Start sending a campaign. Queues recipients, then begins send loop.
   */
  async startCampaign(campaignId: string): Promise<void> {
    // Fetch campaign
    const { data: camp, error: cErr } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (cErr || !camp) throw new Error(`Campaign not found: ${campaignId}`);
    if (!['draft', 'paused', 'scheduled'].includes((camp as any).status)) {
      throw new Error(`Cannot start campaign in status: ${(camp as any).status}`);
    }

    // Update status to "sending"
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    // Queue recipients from carrier_contacts matching target_audience
    await this.queueRecipients(campaignId, (camp as any).target_audience);

    // Fire async send loop (non-blocking)
    this.runSendLoop(campaignId).catch(err =>
      logger.error(`Send loop error for campaign ${campaignId}: ${err.message}`)
    );
  }

  /**
   * Pause a running campaign.
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', campaignId)
      .in('status', ['sending', 'scheduled']);
    if (error) throw new Error(`Failed to pause campaign: ${error.message}`);
  }

  /**
   * Retrieve computed campaign statistics.
   */
  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();
    if (error || !data) throw new Error(`Campaign not found: ${campaignId}`);
    const c = data as Record<string, any>;

    const total = c['total_recipients'] || 0;
    const sent = c['sent_count'] || 0;
    const delivered = c['delivered_count'] || 0;
    const opened = c['opened_count'] || 0;
    const clicked = c['clicked_count'] || 0;
    const bounced = c['bounced_count'] || 0;
    const unsubscribed = c['unsubscribed_count'] || 0;
    const conversions = c['conversion_count'] || 0;

    return {
      totalRecipients: total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      unsubscribed,
      conversions,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
      conversionRate: delivered > 0 ? (conversions / delivered) * 100 : 0,
    };
  }

  /**
   * Record an email event (Brevo webhook or internal).
   */
  async trackEvent(event: BrevoWebhookEvent, campaignId?: string): Promise<void> {
    const eventMap: Record<string, string> = {
      delivered: 'delivered',
      opened: 'opened',
      clicks: 'clicked',
      click: 'clicked',
      hard_bounce: 'bounced',
      soft_bounce: 'bounced',
      spam: 'spam',
      unsubscribed: 'unsubscribed',
    };
    const eventType = eventMap[event.event];
    if (!eventType) return;

    // Find recipient by email + campaign
    let recipientId: string | null = null;
    if (campaignId) {
      const { data: rec } = await supabaseAdmin
        .from('campaign_recipients')
        .select('id, carrier_contact_id')
        .eq('campaign_id', campaignId)
        .eq('email', event.email)
        .limit(1)
        .single();
      if (rec) recipientId = (rec as any).id;
    }

    const eventRow: Record<string, any> = {
      event_type: eventType,
      event_time: event.date || new Date().toISOString(),
    };
    if (campaignId) eventRow['campaign_id'] = campaignId;
    if (recipientId) eventRow['recipient_id'] = recipientId;
    if (event.link) eventRow['link_url'] = event.link;

    await supabaseAdmin.from('email_events').insert(eventRow);

    // Increment campaign counter
    if (campaignId) {
      const fnMap: Record<string, string> = {
        delivered: 'increment_campaign_delivered',
        opened: 'increment_campaign_opened',
        clicked: 'increment_campaign_clicked',
        bounced: 'increment_campaign_bounced',
        unsubscribed: 'increment_campaign_unsubscribed',
      };
      const fn = fnMap[eventType];
      if (fn) {
        await supabaseAdmin.rpc(fn, { campaign_id: campaignId });
      }
    }

    // Update recipient status
    if (recipientId) {
      const statusMap: Record<string, string> = {
        delivered: 'delivered',
        opened: 'opened',
        clicked: 'clicked',
        bounced: 'bounced',
        spam: 'bounced',
        unsubscribed: 'unsubscribed',
      };
      const newStatus = statusMap[eventType];
      if (newStatus) {
        const updateRow: Record<string, any> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (eventType === 'delivered') updateRow['delivered_at'] = eventRow['event_time'];
        if (eventType === 'opened') {
          updateRow['opened_at'] = eventRow['event_time'];
          updateRow['last_opened_at'] = eventRow['event_time'];
          await supabaseAdmin.rpc('increment', { table: 'campaign_recipients', field: 'open_count', id: recipientId });
        }
        if (eventType === 'clicked') {
          updateRow['clicked_at'] = eventRow['event_time'];
          updateRow['last_clicked_at'] = eventRow['event_time'];
        }
        if (eventType === 'bounced') {
          updateRow['bounced_at'] = eventRow['event_time'];
          updateRow['bounce_type'] = event.event;
        }
        await supabaseAdmin.from('campaign_recipients').update(updateRow).eq('id', recipientId);
      }
    }

    // Hard bounce / spam → add to suppression list
    if (['hard_bounce', 'spam'].includes(event.event)) {
      await this.handleBounce(event.email, event.event as 'hard_bounce' | 'spam');
    }
  }

  /**
   * Process an unsubscribe request.
   */
  async handleUnsubscribe(email: string, campaignId: string, token: string): Promise<boolean> {
    if (!verifyUnsubToken(token, email, campaignId)) return false;

    const row: Record<string, any> = {
      email,
      reason: 'unsubscribed',
      source: 'recipient',
    };
    if (campaignId) row['campaign_id'] = campaignId;

    await supabaseAdmin
      .from('email_suppression_list')
      .upsert(row, { onConflict: 'email' });

    logger.info(`Unsubscribed: ${email} from campaign ${campaignId}`);
    return true;
  }

  /**
   * Add an email to the suppression list on bounce.
   */
  async handleBounce(email: string, bounceType: 'hard_bounce' | 'spam'): Promise<void> {
    const row: Record<string, any> = {
      email,
      reason: bounceType === 'spam' ? 'spam_complaint' : 'hard_bounce',
      source: 'automatic',
    };
    await supabaseAdmin.from('email_suppression_list').upsert(row, { onConflict: 'email' });
    logger.info(`Added ${email} to suppression list: ${bounceType}`);
  }

  /**
   * Personalize HTML content with carrier data.
   */
  personalize(html: string, vars: Record<string, string | undefined>): string {
    return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }

  /**
   * Generate an unsubscribe token for embedding in emails.
   */
  getUnsubToken(email: string, campaignId: string): string {
    return generateUnsubToken(email, campaignId);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async queueRecipients(campaignId: string, audience?: TargetAudience): Promise<number> {
    let query = supabaseAdmin
      .from('carrier_contacts')
      .select('id, email, company_name, state, power_units, email_verified')
      .not('email', 'is', null);

    if (audience?.states && audience.states.length > 0) {
      query = query.in('state', audience.states);
    }
    if (audience?.minPowerUnits !== undefined) {
      query = query.gte('power_units', audience.minPowerUnits);
    }
    if (audience?.maxPowerUnits !== undefined) {
      query = query.lte('power_units', audience.maxPowerUnits);
    }
    if (audience?.emailVerified) {
      query = query.eq('email_verified', true);
    }

    const { data: contacts, error } = await query;
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`);
    if (!contacts || contacts.length === 0) return 0;

    // Exclude suppressed emails
    const { data: suppressed } = await supabaseAdmin
      .from('email_suppression_list')
      .select('email')
      .eq('active', true);
    const suppressedSet = new Set((suppressed ?? []).map((s: any) => s.email as string));

    // Exclude already-queued recipients for this campaign
    const { data: existing } = await supabaseAdmin
      .from('campaign_recipients')
      .select('email')
      .eq('campaign_id', campaignId);
    const existingSet = new Set((existing ?? []).map((e: any) => e.email as string));

    const rows = contacts
      .filter((c: any) => !suppressedSet.has(c.email) && !existingSet.has(c.email))
      .map((c: any) => ({
        campaign_id: campaignId,
        carrier_contact_id: c.id,
        email: c.email,
        status: 'pending',
      }));

    if (rows.length === 0) return 0;

    // Insert in batches of 1000
    for (let i = 0; i < rows.length; i += 1000) {
      await supabaseAdmin.from('campaign_recipients').insert(rows.slice(i, i + 1000));
    }

    // Update total_recipients on campaign
    await supabaseAdmin
      .from('email_campaigns')
      .update({ total_recipients: rows.length, updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    return rows.length;
  }

  private async runSendLoop(campaignId: string): Promise<void> {
    const BATCH = 50;
    let sentToday = 0;

    while (true) {
      // Check if campaign is still sending
      const { data: camp } = await supabaseAdmin
        .from('email_campaigns')
        .select('status, daily_limit, warmup_mode, subject, html_content, text_content')
        .eq('id', campaignId)
        .single();
      if (!camp || (camp as any).status !== 'sending') break;

      const dailyLimit = (camp as any).daily_limit || DAILY_LIMIT;
      if (sentToday >= dailyLimit) {
        logger.info(`Campaign ${campaignId}: daily limit ${dailyLimit} reached, stopping today`);
        break;
      }

      // Fetch pending recipients
      const remaining = Math.min(BATCH, dailyLimit - sentToday);
      const { data: recipients, error: rErr } = await supabaseAdmin
        .from('campaign_recipients')
        .select('id, email, carrier_contact_id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .limit(remaining);

      if (rErr || !recipients || recipients.length === 0) {
        // No more pending → complete campaign
        await supabaseAdmin.from('email_campaigns').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', campaignId);
        break;
      }

      // Fetch carrier data for personalization
      for (const rec of recipients as any[]) {
        const { data: contact } = await supabaseAdmin
          .from('carrier_contacts')
          .select('company_name, city, state')
          .eq('id', rec.carrier_contact_id)
          .single();

        const vars: Record<string, string | undefined> = {
          companyName: (contact as any)?.company_name ?? '',
          city: (contact as any)?.city ?? '',
          state: (contact as any)?.state ?? '',
          unsubUrl: `${process.env['APP_URL'] || 'https://drivedrop.app'}/api/v1/email-webhooks/unsubscribe/${this.getUnsubToken(rec.email, campaignId)}?email=${encodeURIComponent(rec.email)}&campaign=${campaignId}`,
        };

        const personalizedHtml = this.personalize((camp as any).html_content, vars);
        const textContent = (camp as any).text_content
          ? this.personalize((camp as any).text_content, vars)
          : undefined;

        const isWarmup = (camp as any).warmup_mode || WARMUP;

        const sendResult = await brevoOutreachService.send({
          to: { email: rec.email },
          subject: this.personalize((camp as any).subject, vars),
          htmlContent: personalizedHtml,
          ...(textContent && { textContent }),
          campaignId,
          dryRun: isWarmup,
        });

        // Update recipient status
        const updateRow: Record<string, any> = {
          status: sendResult.success ? 'sent' : 'failed',
          updated_at: new Date().toISOString(),
        };
        if (sendResult.success) updateRow['sent_at'] = new Date().toISOString();
        if (sendResult.error) updateRow['error_message'] = sendResult.error;
        await supabaseAdmin.from('campaign_recipients').update(updateRow).eq('id', rec.id);

        if (sendResult.success) {
          await supabaseAdmin.rpc('increment_campaign_sent', { campaign_id: campaignId });
          sentToday++;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, SEND_INTERVAL_MS));
      }
    }

    logger.info(`Campaign ${campaignId}: send loop exited, sent ${sentToday} today`);
  }

  private mapCampaign(row: Record<string, any>): Campaign {
    return {
      id: row['id'],
      name: row['name'],
      subject: row['subject'],
      htmlContent: row['html_content'],
      ...(row['text_content'] && { textContent: row['text_content'] }),
      status: row['status'],
      ...(row['scheduled_at'] && { scheduledAt: new Date(row['scheduled_at']) }),
      ...(row['started_at'] && { startedAt: new Date(row['started_at']) }),
      ...(row['completed_at'] && { completedAt: new Date(row['completed_at']) }),
      ...(row['target_audience'] && { targetAudience: row['target_audience'] }),
      totalRecipients: row['total_recipients'] || 0,
      dailyLimit: row['daily_limit'] || DAILY_LIMIT,
      sendRatePerHour: row['send_rate_per_hour'] || 30,
      warmupMode: row['warmup_mode'] ?? true,
      sentCount: row['sent_count'] || 0,
      deliveredCount: row['delivered_count'] || 0,
      openedCount: row['opened_count'] || 0,
      clickedCount: row['clicked_count'] || 0,
      bouncedCount: row['bounced_count'] || 0,
      unsubscribedCount: row['unsubscribed_count'] || 0,
      conversionCount: row['conversion_count'] || 0,
      createdBy: row['created_by'],
      tags: row['tags'] || [],
      ...(row['notes'] && { notes: row['notes'] }),
      createdAt: new Date(row['created_at']),
      updatedAt: new Date(row['updated_at']),
    };
  }
}

export const campaignManagerService = new CampaignManagerService();
export { generateUnsubToken, verifyUnsubToken };
