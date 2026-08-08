/**
 * Pricing Intelligence API Routes
 * Phase 3: Operational Memory Infrastructure
 * 
 * Purpose: Expose operational memory to Benji and admin tools
 * Pattern: REST endpoints for read-only access to performance metrics, analytics, recommendations
 * 
 * INFRASTRUCTURE ONLY:
 * - GET /performance - Read performance metrics
 * - GET /analytics/route/:key - Read route analytics
 * - GET /recommendations - Read policy recommendations
 * - POST /feedback/record - Write feedback events
 * - GET /performance/by-route - Read performance breakdown by route
 * 
 * All endpoints are read-only except /feedback/record
 * No pricing behavior changes or policy modifications
 */

import express, { type Request, type Response } from 'express';
import { logger } from '@utils/logger';
import { pricingPerformanceService } from '@benji/intelligence/pricing-performance.service';
import { pricingAnalyticsService } from '@benji/intelligence/pricing-analytics.service';
import { pricingRecommendationsService } from '@benji/intelligence/pricing-recommendations.service';
import { pricingFeedbackService } from '@benji/intelligence/pricing-feedback.service';

const router = express.Router();

/**
 * GET /api/v1/intelligence/performance
 * 
 * Get overall performance metrics for a time window
 * Query params:
 *   - timeWindowDays: number (default: 30)
 * 
 * Returns: PerformanceMetrics
 */
router.get('/performance', async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindowDays = parseInt(req.query['timeWindowDays'] as string) || 30;
    
    if (timeWindowDays < 1 || timeWindowDays > 365) {
      res.status(400).json({
        error: 'Invalid timeWindowDays. Must be between 1 and 365.',
      });
      return;
    }
    
    const metrics = await pricingPerformanceService.getPerformanceMetrics(timeWindowDays);
    
    res.json({
      success: true,
      data: metrics,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve performance metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
    });
  }
});

/**
 * GET /api/v1/intelligence/performance/by-route
 * 
 * Get performance metrics broken down by route
 * Query params:
 *   - timeWindowDays: number (default: 30)
 * 
 * Returns: RoutePerformance[]
 */
router.get('/performance/by-route', async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindowDays = parseInt(req.query['timeWindowDays'] as string) || 30;
    
    if (timeWindowDays < 1 || timeWindowDays > 365) {
      res.status(400).json({
        error: 'Invalid timeWindowDays. Must be between 1 and 365.',
      });
      return;
    }
    
    const routePerformances = await pricingPerformanceService.getPerformanceByRoute(timeWindowDays);
    
    res.json({
      success: true,
      data: routePerformances,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve performance by route', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance by route',
    });
  }
});

/**
 * GET /api/v1/intelligence/analytics/route/:routeKey
 * 
 * Get pre-calculated analytics for a specific route
 * Path params:
 *   - routeKey: string (format: origin:destination:vehicleType)
 * Query params:
 *   - timePeriod: string (e.g., "2026-01", "2026-W05")
 * 
 * Returns: RouteAnalytics or null
 */
router.get('/analytics/route/:routeKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routeKey } = req.params;
    const { timePeriod } = req.query;
    
    if (!routeKey) {
      res.status(400).json({
        error: 'routeKey path parameter is required',
      });
      return;
    }
    
    if (!timePeriod) {
      res.status(400).json({
        error: 'timePeriod query parameter is required',
      });
      return;
    }
    
    const analytics = await pricingAnalyticsService.getRouteAnalytics(
      routeKey,
      timePeriod as string
    );
    
    if (!analytics) {
      res.status(404).json({
        success: false,
        error: 'No analytics found for this route and time period',
        routeKey,
        timePeriod,
      });
      return;
    }
    
    res.json({
      success: true,
      data: analytics,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve route analytics', {
      routeKey: req.params['routeKey'],
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve route analytics',
    });
  }
});

/**
 * GET /api/v1/intelligence/recommendations
 * 
 * Get policy recommendations based on recent performance
 * Query params:
 *   - timeWindowDays: number (default: 30)
 * 
 * Returns: PolicyRecommendation[]
 */
router.get('/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindowDays = parseInt(req.query['timeWindowDays'] as string) || 30;
    
    if (timeWindowDays < 1 || timeWindowDays > 365) {
      res.status(400).json({
        error: 'Invalid timeWindowDays. Must be between 1 and 365.',
      });
      return;
    }
    
    const recommendations = await pricingRecommendationsService.generateRecommendations(timeWindowDays);
    
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to retrieve recommendations', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recommendations',
    });
  }
});

/**
 * POST /api/v1/intelligence/feedback/quote-outcome
 * 
 * Record a quote outcome (booked or rejected)
 * Body:
 *   - quoteId: string (required)
 *   - wasBooked: boolean (required)
 *   - timeToBooking?: number (milliseconds, optional)
 *   - bookingPrice?: number (optional)
 *   - shipmentId?: string (optional)
 * 
 * Returns: Success confirmation
 */
router.post('/feedback/quote-outcome', async (req: Request, res: Response): Promise<void> => {
  try {
    const { quoteId, wasBooked, timeToBooking, bookingPrice, shipmentId } = req.body;
    
    if (!quoteId || typeof wasBooked !== 'boolean') {
      res.status(400).json({
        error: 'quoteId (string) and wasBooked (boolean) are required',
      });
      return;
    }
    
    await pricingFeedbackService.recordQuoteOutcome({
      quoteId,
      wasBooked,
      timeToBooking,
      bookingPrice,
      shipmentId,
    });
    
    res.json({
      success: true,
      message: 'Quote outcome recorded successfully',
      recordedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record quote outcome', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to record quote outcome',
    });
  }
});

/**
 * POST /api/v1/intelligence/feedback/shipment-outcome
 * 
 * Record a shipment outcome (completed with actual costs)
 * Body:
 *   - shipmentId: string (required)
 *   - quoteId?: string (optional)
 *   - actualCost: number (required)
 *   - actualRevenue: number (required)
 *   - profitMargin: number (required)
 *   - completedAt: string (ISO date, required)
 * 
 * Returns: Success confirmation
 */
router.post('/feedback/shipment-outcome', async (req: Request, res: Response): Promise<void> => {
  try {
    const { shipmentId, quoteId, actualCost, actualRevenue, profitMargin, completedAt } = req.body;
    
    if (!shipmentId || actualCost === undefined || actualRevenue === undefined || 
        profitMargin === undefined || !completedAt) {
      res.status(400).json({
        error: 'shipmentId, actualCost, actualRevenue, profitMargin, and completedAt are required',
      });
      return;
    }
    
    await pricingFeedbackService.recordShipmentOutcome({
      shipmentId,
      quoteId,
      actualCost,
      actualRevenue,
      profitMargin,
      completedAt: new Date(completedAt),
    });
    
    res.json({
      success: true,
      message: 'Shipment outcome recorded successfully',
      recordedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record shipment outcome', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to record shipment outcome',
    });
  }
});

/**
 * POST /api/v1/intelligence/feedback/intelligence-fallback
 * 
 * Record when intelligence fails and baseline is used
 * Body:
 *   - quoteId: string (required)
 *   - reason: string (required)
 *   - error?: string (optional)
 * 
 * Returns: Success confirmation
 */
router.post('/feedback/intelligence-fallback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { quoteId, reason, error } = req.body;
    
    if (!quoteId || !reason) {
      res.status(400).json({
        error: 'quoteId and reason are required',
      });
      return;
    }
    
    await pricingFeedbackService.recordIntelligenceFallback(quoteId, reason, error);
    
    res.json({
      success: true,
      message: 'Intelligence fallback recorded successfully',
      recordedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record intelligence fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to record intelligence fallback',
    });
  }
});

/**
 * GET /api/v1/intelligence/health
 * 
 * Health check endpoint
 * 
 * Returns: System health status
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'pricing-intelligence',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

export default router;
