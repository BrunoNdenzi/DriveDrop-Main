/**
 * Analytics Routes
 * Campaign performance metrics, time-series, geo, device analytics and reports.
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { analyticsService } from '@services/outreach/analyticsService';

const router = Router();
router.use(authenticate, authorize(['admin']));

/**
 * GET /analytics/overview
 * Aggregate stats across all campaigns.
 */
router.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => {
    const overview = await analyticsService.getOverview();
    return res.json(successResponse(overview));
  })
);

/**
 * GET /analytics/campaigns/:id/performance
 * Full performance report for a single campaign.
 */
router.get(
  '/campaigns/:id/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const perf = await analyticsService.getCampaignPerformance(req.params['id']!);
    return res.json(successResponse(perf));
  })
);

/**
 * GET /analytics/campaigns/:id/timeline
 * Daily time-series events for a campaign.
 */
router.get(
  '/campaigns/:id/timeline',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(90, parseInt((req.query['days'] as string) || '30', 10));
    const data = await analyticsService.getTimeSeriesData(req.params['id']!, days);
    return res.json(successResponse(data));
  })
);

/**
 * GET /analytics/campaigns/:id/geography
 * Geographic breakdown by state.
 */
router.get(
  '/campaigns/:id/geography',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getGeoAnalytics(req.params['id']!);
    return res.json(successResponse(data));
  })
);

/**
 * GET /analytics/campaigns/:id/devices
 * Device/platform breakdown.
 */
router.get(
  '/campaigns/:id/devices',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getDeviceAnalytics(req.params['id']!);
    return res.json(successResponse(data));
  })
);

/**
 * GET /analytics/campaigns/:id/funnel
 * Engagement funnel from recipients to conversions.
 */
router.get(
  '/campaigns/:id/funnel',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getEngagementFunnel(req.params['id']!);
    return res.json(successResponse(data));
  })
);

/**
 * GET /analytics/leaderboard
 * Top campaigns by open rate.
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(50, parseInt((req.query['limit'] as string) || '10', 10));
    const data = await analyticsService.getLeaderboard(limit);
    return res.json(successResponse(data));
  })
);

/**
 * GET /analytics/export/:campaignId
 * Full JSON export report for a campaign.
 */
router.get(
  '/export/:campaignId',
  asyncHandler(async (req: Request, res: Response) => {
    const report = await analyticsService.exportCampaignReport(req.params['campaignId']!);
    // Support CSV via ?format=csv – simplistic implementation
    if (req.query['format'] === 'csv') {
      const timeSeries = (report['timeSeries'] as any[]) || [];
      const header = 'date,sent,delivered,opened,clicked,bounced\n';
      const rows = timeSeries.map((r: any) =>
        `${r.date},${r.sent},${r.delivered},${r.opened},${r.clicked},${r.bounced}`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="campaign_${req.params['campaignId']}.csv"`);
      return res.send(header + rows);
    }
    return res.json(successResponse(report));
  })
);

export default router;
