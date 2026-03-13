/**
 * Outreach Orchestrator
 * Coordinates the full outreach workflow:
 *   1. Contact search (Hunter → Apollo → Snov)
 *   2. Email verification (Hunter → Snov)
 *   3. Company enrichment (SerpAPI → Apollo)
 *   4. Campaign sending via Brevo (rate-limited, warmup-aware, compliance-logged)
 *
 * WARMUP MODE: when OUTREACH_WARMUP=true (default), all .send() calls are dry-run only.
 * Set OUTREACH_WARMUP=false when you're ready to send real emails.
 *
 * DAILY LIMIT: controlled by OUTREACH_DAILY_LIMIT env var (default: 10).
 */
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { hunterService, HunterVerifyResult } from './hunterService';
import { serpService, CompanyInfo } from './serpService';
import { apolloService } from './apolloService';
import { snovService, SnovVerifyResult } from './snovService';
import { brevoOutreachService, OutreachEmailParams } from './brevoOutreachService';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ContactSearchParams {
  companyName: string;
  domain?: string;
  state?: string;
  targetTitles?: string[];
}

export interface FoundContact {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  confidence: number; // 0-100
  source: 'hunter' | 'apollo' | 'snov' | 'manual';
  phone?: string;
  linkedin?: string;
  verificationStatus?: 'verified' | 'risky' | 'invalid' | 'unverified';
}

export interface VerifyParams {
  email: string;
  source?: 'hunter' | 'snov' | 'auto';
}

export interface VerifyResult {
  email: string;
  safe: boolean; // true = deliverable, low bounce risk
  score: number;
  details: HunterVerifyResult | SnovVerifyResult | null;
  source: string;
}

export interface CampaignSendParams {
  campaignId: string;
  leadId: string;
  to: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
}

export interface OutreachStats {
  warmupMode: boolean;
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  totalSent: number;
  totalDryRun: number;
  totalFailed: number;
  totalBounced: number;
  deliveryRate: number; // 0-1
  brevoStats: any;
}

// ----------------------------------------------------------------
// Orchestrator
// ----------------------------------------------------------------

class OutreachOrchestrator {
  private get dailyLimit(): number {
    return parseInt(process.env['OUTREACH_DAILY_LIMIT'] || '10', 10);
  }

  private get warmupMode(): boolean {
    // Default to warmup=true (safe) unless explicitly set to 'false'
    return process.env['OUTREACH_WARMUP'] !== 'false';
  }

  // ----------------------------------------------------------------
  // 1. Contact Search
  // ----------------------------------------------------------------

  /**
   * Find contacts for a company using all available services.
   * Hunter is primary; falls back to Apollo then Snov.
   */
  async findContacts(params: ContactSearchParams): Promise<FoundContact[]> {
    const contacts: FoundContact[] = [];
    const seen = new Set<string>();

    const addContact = (c: FoundContact) => {
      const key = c.email.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        contacts.push(c);
      }
    };

    // --- Hunter.io domain search ---
    if (hunterService.isEnabled && params.domain) {
      const result = await hunterService.domainSearch(params.domain, 10);
      if (result) {
        for (const e of result.emails) {
          if (this.matchesTargetTitle(e.position, params.targetTitles)) {
            const contact: FoundContact = {
              email: e.email,
              firstName: e.firstName,
              lastName: e.lastName,
              title: e.position,
              confidence: e.confidence,
              source: 'hunter',
            };
            if (e.phone_number) contact.phone = e.phone_number;
            if (e.linkedin_url) contact.linkedin = e.linkedin_url;
            addContact(contact);
          }
        }
      }
    }

    // --- Apollo.io people search ---
    if (apolloService.isEnabled && contacts.length < 3) {
      const domains = params.domain ? [params.domain] : undefined;
      const result = await apolloService.searchPeople({
        ...(domains && { q_organization_domains: domains }),
        ...(params.domain ? {} : { q_keywords: params.companyName }),
        ...(params.targetTitles && { person_titles: params.targetTitles }),
        person_seniorities: ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'],
        perPage: 5,
      });
      for (const c of result.contacts) {
        if (c.email) {
          const contact: FoundContact = {
            email: c.email,
            firstName: c.firstName,
            lastName: c.lastName,
            title: c.title,
            confidence: c.emailStatus === 'verified' ? 90 : 60,
            source: 'apollo',
          };
          if (c.phone) contact.phone = c.phone;
          if (c.linkedin) contact.linkedin = c.linkedin;
          addContact(contact);
        }
      }
    }

    // --- Snov.io domain search ---
    if (snovService.isEnabled && contacts.length < 3 && params.domain) {
      const prospects = await snovService.findEmailsByDomain(params.domain, 5);
      for (const p of prospects) {
        if (p.email && this.matchesTargetTitle(p.position, params.targetTitles)) {
          addContact({
            email: p.email,
            firstName: p.firstName,
            lastName: p.lastName,
            title: p.position,
            confidence: 70,
            source: 'snov',
          });
        }
      }
    }

    return contacts;
  }

  // ----------------------------------------------------------------
  // 2. Email Verification
  // ----------------------------------------------------------------

  /**
   * Verify an email address using available services.
   * Hunter is default; Snov as fallback.
   * Returns safe=true only for clearly deliverable addresses.
   */
  async verifyEmail(params: VerifyParams): Promise<VerifyResult> {
    const { email } = params;
    const source = params.source || 'auto';

    // Hunter first
    if ((source === 'hunter' || source === 'auto') && hunterService.isEnabled) {
      const result = await hunterService.verifyEmail(email);
      if (result) {
        return {
          email,
          safe: result.result === 'deliverable',
          score: result.score,
          details: result,
          source: 'hunter',
        };
      }
    }

    // Snov fallback
    if ((source === 'snov' || source === 'auto') && snovService.isEnabled) {
      const result = await snovService.verifyEmail(email);
      if (result) {
        return {
          email,
          safe: result.valid && result.mx,
          score: result.valid ? (result.smtp ? 85 : 60) : 0,
          details: result,
          source: 'snov',
        };
      }
    }

    // No service available
    return {
      email,
      safe: false,
      score: 0,
      details: null,
      source: 'none',
    };
  }

  /**
   * Verify a batch of emails, returning only those deemed safe
   */
  async verifyBatch(emails: string[]): Promise<VerifyResult[]> {
    // Snov supports true batch; Hunter is one-at-a-time
    if (snovService.isEnabled) {
      const results = await snovService.verifyBatch(emails);
      return results.map((r): VerifyResult => ({
        email: r.email,
        safe: r.valid && r.mx,
        score: r.valid ? (r.smtp ? 85 : 60) : 0,
        details: r,
        source: 'snov',
      }));
    }

    // Fallback: sequential Hunter verification
    const results: VerifyResult[] = [];
    for (const email of emails) {
      results.push(await this.verifyEmail({ email }));
    }
    return results;
  }

  // ----------------------------------------------------------------
  // 3. Company Enrichment
  // ----------------------------------------------------------------

  /**
   * Enrich a company's profile using SerpAPI + Apollo
   */
  async enrichCompany(params: {
    name: string;
    domain?: string;
    state?: string;
  }): Promise<{ serpInfo: CompanyInfo | null; apolloInfo: any | null }> {
    const [serpInfo, apolloInfo] = await Promise.all([
      serpService.enrichCompany(params.name, params.state),
      params.domain && apolloService.isEnabled
        ? apolloService.enrichOrganization(params.domain)
        : Promise.resolve(null),
    ]);

    return { serpInfo, apolloInfo };
  }

  // ----------------------------------------------------------------
  // 4. Campaign Sending (rate-limited)
  // ----------------------------------------------------------------

  /**
   * Send a single outreach email.
   * Checks daily limit → verifies email → sends (or dry-runs in warmup mode).
   *
   * Returns an error string if the limit is hit or email is unsafe.
   */
  async sendCampaignEmail(params: CampaignSendParams): Promise<{
    sent: boolean;
    dryRun: boolean;
    skipped: boolean;
    reason?: string;
    messageId?: string;
  }> {
    // Check daily limit
    const sentToday = await this.getSentTodayCount();
    if (sentToday >= this.dailyLimit) {
      const reason = `Daily limit of ${this.dailyLimit} reached (${sentToday} sent today)`;
      logger.warn(`[Outreach] ${reason}`);
      await this.logSkipped(params, reason);
      return { sent: false, dryRun: false, skipped: true, reason };
    }

    const isDryRun = this.warmupMode;

    const sendParams: OutreachEmailParams = {
      to: params.to,
      subject: params.subject,
      htmlContent: params.htmlContent,
      campaignId: params.campaignId,
      leadId: params.leadId,
      tags: [`campaign_${params.campaignId}`],
      dryRun: isDryRun,
    };
    if (params.textContent) sendParams.textContent = params.textContent;
    if (params.replyTo) sendParams.replyTo = params.replyTo;

    const result = await brevoOutreachService.send(sendParams);

    if (result.success) {
      const out: { sent: boolean; dryRun: boolean; skipped: boolean; reason?: string; messageId?: string } = {
        sent: !isDryRun,
        dryRun: isDryRun,
        skipped: false,
      };
      if (result.messageId) out.messageId = result.messageId;
      return out;
    }

    const failOut: { sent: boolean; dryRun: boolean; skipped: boolean; reason?: string; messageId?: string } = {
      sent: false,
      dryRun: isDryRun,
      skipped: false,
    };
    if (result.error) failOut.reason = result.error;
    return failOut;
  }

  // ----------------------------------------------------------------
  // 5. Stats
  // ----------------------------------------------------------------

  async getStats(): Promise<OutreachStats> {
    const today = new Date().toISOString().split('T')[0]!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().split('T')[0]!;

    const [todayResult, totalsResult, brevoStats] = await Promise.all([
      supabaseAdmin
        .from('outreach_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', `${today}T00:00:00Z`)
        .lte('sent_at', `${today}T23:59:59Z`),
      supabaseAdmin
        .from('outreach_log')
        .select('status')
        .in('status', ['sent', 'dry_run', 'failed', 'bounced']),
      brevoOutreachService.getSendingStats(thirtyDaysAgo, today),
    ]);

    const sentToday = todayResult.count || 0;
    const rows: { status: string }[] = totalsResult.data || [];

    const totalSent = rows.filter(r => r.status === 'sent').length;
    const totalDryRun = rows.filter(r => r.status === 'dry_run').length;
    const totalFailed = rows.filter(r => r.status === 'failed').length;
    const totalBounced = rows.filter(r => r.status === 'bounced').length;
    const deliveryRate = totalSent > 0 ? (totalSent - totalBounced) / totalSent : 0;

    return {
      warmupMode: this.warmupMode,
      dailyLimit: this.dailyLimit,
      sentToday,
      remainingToday: Math.max(0, this.dailyLimit - sentToday),
      totalSent,
      totalDryRun,
      totalFailed,
      totalBounced,
      deliveryRate,
      brevoStats,
    };
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  private matchesTargetTitle(title: string, targets?: string[]): boolean {
    if (!targets || targets.length === 0) return true;
    const t = title.toLowerCase();
    return targets.some(target => t.includes(target.toLowerCase()));
  }

  private async getSentTodayCount(): Promise<number> {
    const today = new Date().toISOString().split('T')[0]!;
    const { count } = await supabaseAdmin
      .from('outreach_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', `${today}T00:00:00Z`)
      .lte('sent_at', `${today}T23:59:59Z`);
    return count || 0;
  }

  private async logSkipped(params: CampaignSendParams, reason: string) {
    await supabaseAdmin.from('outreach_log').insert({
      lead_id: params.leadId,
      campaign_id: params.campaignId,
      channel: 'email',
      direction: 'outbound',
      to_email: params.to.email,
      subject: params.subject,
      status: 'skipped',
      metadata: { reason },
      created_at: new Date().toISOString(),
    });
  }
}

export const outreachOrchestrator = new OutreachOrchestrator();
