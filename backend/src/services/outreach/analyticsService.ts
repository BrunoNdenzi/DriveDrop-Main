/**
 * Campaign Analytics Service
 * Provides performance metrics, time-series data, geographic and engagement analytics.
 */
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { CampaignStats } from '../../types/campaigns.types';

interface CampaignPerformance extends CampaignStats {
  campaignId: string;
  campaignName: string;
  status: string;
  warmupMode: boolean;
  startedAt?: Date;
  completedAt?: Date;
  durationHours?: number;
}

interface TimeSeriesPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface GeoAnalytic {
  state: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
}

interface DeviceAnalytic {
  deviceType: string;
  opens: number;
  clicks: number;
  percentage: number;
}

interface EngagementFunnel {
  stage: string;
  count: number;
  rate: number;
}

interface LeaderboardEntry extends CampaignStats {
  campaignId: string;
  campaignName: string;
  status: string;
  createdAt: Date;
}

class AnalyticsService {
  /**
   * Get full performance metrics for a single campaign.
   */
  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformance> {
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

    let durationHours: number | undefined;
    if (c['started_at'] && c['completed_at']) {
      const ms = new Date(c['completed_at']).getTime() - new Date(c['started_at']).getTime();
      durationHours = Math.round((ms / 3600000) * 10) / 10;
    }

    return {
      campaignId: c['id'],
      campaignName: c['name'],
      status: c['status'],
      warmupMode: c['warmup_mode'] ?? true,
      ...(c['started_at'] && { startedAt: new Date(c['started_at']) }),
      ...(c['completed_at'] && { completedAt: new Date(c['completed_at']) }),
      ...(durationHours !== undefined && { durationHours }),
      totalRecipients: total,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      unsubscribed,
      conversions,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 10000) / 100 : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
      conversionRate: delivered > 0 ? Math.round((conversions / delivered) * 10000) / 100 : 0,
    };
  }

  /**
   * Get time-series data for a campaign (daily bucketed events).
   */
  async getTimeSeriesData(campaignId: string, days = 30): Promise<TimeSeriesPoint[]> {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('email_events')
      .select('event_type, event_time')
      .eq('campaign_id', campaignId)
      .gte('event_time', since)
      .order('event_time', { ascending: true });

    if (error) {
      logger.warn(`Time-series query failed: ${error.message}`);
      return [];
    }

    const buckets: Record<string, TimeSeriesPoint> = {};
    for (const evt of (data ?? []) as any[]) {
      const day = evt.event_time.substring(0, 10);
      if (!buckets[day]) {
        buckets[day] = { date: day, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      }
      const b = buckets[day];
      if (evt.event_type === 'sent') b.sent++;
      else if (evt.event_type === 'delivered') b.delivered++;
      else if (evt.event_type === 'opened') b.opened++;
      else if (evt.event_type === 'clicked') b.clicked++;
      else if (evt.event_type === 'bounced') b.bounced++;
    }

    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get geographic analytics: open/click rates by US state.
   */
  async getGeoAnalytics(campaignId: string): Promise<GeoAnalytic[]> {
    // Join recipients with carrier_contacts to get state
    const { data, error } = await supabaseAdmin
      .from('campaign_recipients')
      .select('status, carrier_contacts(state)')
      .eq('campaign_id', campaignId)
      .not('carrier_contacts', 'is', null);

    if (error) {
      logger.warn(`Geo analytics query failed: ${error.message}`);
      return [];
    }

    const stateMap: Record<string, { sent: number; opened: number; clicked: number }> = {};
    for (const rec of (data ?? []) as any[]) {
      const state: string = rec.carrier_contacts?.state || 'Unknown';
      if (!stateMap[state]) stateMap[state] = { sent: 0, opened: 0, clicked: 0 };
      if (['sent', 'delivered', 'opened', 'clicked'].includes(rec.status)) stateMap[state].sent++;
      if (['opened', 'clicked'].includes(rec.status)) stateMap[state].opened++;
      if (rec.status === 'clicked') stateMap[state].clicked++;
    }

    return Object.entries(stateMap)
      .map(([state, stats]) => ({
        state,
        sent: stats.sent,
        opened: stats.opened,
        clicked: stats.clicked,
        openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.opened - a.opened);
  }

  /**
   * Get device/platform analytics from email_events user_agent.
   */
  async getDeviceAnalytics(campaignId: string): Promise<DeviceAnalytic[]> {
    const { data, error } = await supabaseAdmin
      .from('email_events')
      .select('device_type, event_type')
      .eq('campaign_id', campaignId)
      .in('event_type', ['opened', 'clicked']);

    if (error) {
      logger.warn(`Device analytics failed: ${error.message}`);
      return [];
    }

    const totals: Record<string, { opens: number; clicks: number }> = {};
    let total = 0;
    for (const evt of (data ?? []) as any[]) {
      const dt: string = evt.device_type || 'unknown';
      if (!totals[dt]) totals[dt] = { opens: 0, clicks: 0 };
      if (evt.event_type === 'opened') { totals[dt].opens++; total++; }
      else if (evt.event_type === 'clicked') totals[dt].clicks++;
    }

    return Object.entries(totals).map(([deviceType, stats]) => ({
      deviceType,
      opens: stats.opens,
      clicks: stats.clicks,
      percentage: total > 0 ? Math.round((stats.opens / total) * 10000) / 100 : 0,
    }));
  }

  /**
   * Get engagement funnel: total → sent → delivered → opened → clicked → converted.
   */
  async getEngagementFunnel(campaignId: string): Promise<EngagementFunnel[]> {
    const perf = await this.getCampaignPerformance(campaignId);

    const steps = [
      { stage: 'Total Recipients', count: perf.totalRecipients },
      { stage: 'Sent', count: perf.sent },
      { stage: 'Delivered', count: perf.delivered },
      { stage: 'Opened', count: perf.opened },
      { stage: 'Clicked', count: perf.clicked },
      { stage: 'Converted', count: perf.conversions },
    ];

    const first = steps[0];
    return steps.map((step, i) => ({
      stage: step.stage,
      count: step.count,
      rate: i === 0 ? 100 : (first && first.count > 0) ? Math.round((step.count / first.count) * 10000) / 100 : 0,
    }));
  }

  /**
   * Get leaderboard of campaigns sorted by open rate.
   */
  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .in('status', ['completed', 'sending', 'paused'])
      .order('opened_count', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn(`Leaderboard query failed: ${error.message}`);
      return [];
    }

    return (data ?? []).map((c: any) => {
      const sent = c.sent_count || 0;
      const delivered = c.delivered_count || 0;
      const opened = c.opened_count || 0;
      const clicked = c.clicked_count || 0;
      const bounced = c.bounced_count || 0;

      return {
        campaignId: c.id,
        campaignName: c.name,
        status: c.status,
        createdAt: new Date(c.created_at),
        totalRecipients: c.total_recipients || 0,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        unsubscribed: c.unsubscribed_count || 0,
        conversions: c.conversion_count || 0,
        openRate: delivered > 0 ? Math.round((opened / delivered) * 10000) / 100 : 0,
        clickRate: opened > 0 ? Math.round((clicked / opened) * 10000) / 100 : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
        conversionRate: 0,
      };
    });
  }

  /**
   * Generate a JSON report for a campaign (CSV export can be built on top).
   */
  async exportCampaignReport(campaignId: string): Promise<Record<string, any>> {
    const [performance, timeSeries, geo, devices, funnel] = await Promise.all([
      this.getCampaignPerformance(campaignId),
      this.getTimeSeriesData(campaignId, 60),
      this.getGeoAnalytics(campaignId),
      this.getDeviceAnalytics(campaignId),
      this.getEngagementFunnel(campaignId),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      campaign: performance,
      timeSeries,
      geography: geo,
      devices,
      funnel,
    };
  }

  /**
   * Get overview stats across all campaigns.
   */
  async getOverview(): Promise<Record<string, any>> {
    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('status, sent_count, delivered_count, opened_count, clicked_count, bounced_count, unsubscribed_count, conversion_count');

    if (error) throw new Error(`Overview query failed: ${error.message}`);

    const rows = (data ?? []) as any[];
    const totals = rows.reduce((acc, c) => {
      acc.total++;
      acc.byStatus[c.status] = (acc.byStatus[c.status] || 0) + 1;
      acc.sent += c.sent_count || 0;
      acc.delivered += c.delivered_count || 0;
      acc.opened += c.opened_count || 0;
      acc.clicked += c.clicked_count || 0;
      acc.bounced += c.bounced_count || 0;
      acc.unsubscribed += c.unsubscribed_count || 0;
      return acc;
    }, { total: 0, byStatus: {} as Record<string, number>, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });

    return {
      ...totals,
      openRate: totals.delivered > 0 ? Math.round((totals.opened / totals.delivered) * 10000) / 100 : 0,
      clickRate: totals.opened > 0 ? Math.round((totals.clicked / totals.opened) * 10000) / 100 : 0,
      bounceRate: totals.sent > 0 ? Math.round((totals.bounced / totals.sent) * 10000) / 100 : 0,
    };
  }
}

export const analyticsService = new AnalyticsService();
