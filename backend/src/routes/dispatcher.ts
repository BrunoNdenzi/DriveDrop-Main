/**
 * AI Dispatcher API Routes
 * Endpoints for managing AI-powered route optimizations
 */

import { Router } from 'express';
import { AIDispatcherService } from '../services/AIDispatcherService';
import { FEATURE_FLAGS } from '../config/features';

const router = Router();
const dispatcherService = new AIDispatcherService();

// Middleware to check AI Dispatcher feature flag
function checkAIDispatcherFeature(_req: any, res: any, next: any) {
  if (!FEATURE_FLAGS.AI_DISPATCHER) {
    return res.status(403).json({
      error: 'AI Dispatcher feature is not enabled',
    });
  }
  next();
}

/**
 * POST /api/dispatcher/optimize
 * Run AI optimization for pending shipments
 */
router.post('/optimize', checkAIDispatcherFeature, async (_req, res) => {
  try {
    const optimizations = await dispatcherService.optimizeAssignments();

    return res.json({
      success: true,
      optimizations,
      count: optimizations.length,
      message: `Generated ${optimizations.length} route optimizations`,
    });
  } catch (error: any) {
    console.error('Error optimizing assignments:', error);
    return res.status(500).json({
      error: 'Failed to optimize assignments',
      message: error.message,
    });
  }
});

/**
 * POST /api/dispatcher/:optimizationId/apply
 * Apply an approved optimization (assign shipments to driver)
 */
router.post('/:optimizationId/apply', checkAIDispatcherFeature, async (req, res) => {
  try {
    const { optimizationId } = req.params;

    if (!optimizationId) {
      return res.status(400).json({ error: 'Optimization ID is required' });
    }

    await dispatcherService.applyOptimization(optimizationId);

    return res.json({
      success: true,
      message: 'Optimization applied successfully. Shipments assigned to driver.',
    });
  } catch (error: any) {
    console.error('Error applying optimization:', error);
    return res.status(500).json({
      error: 'Failed to apply optimization',
      message: error.message,
    });
  }
});

/**
 * POST /api/dispatcher/:optimizationId/reject
 * Reject an optimization (admin manual override)
 */
router.post('/:optimizationId/reject', checkAIDispatcherFeature, async (req, res) => {
  try {
    const { optimizationId } = req.params;
    const { reason } = req.body;

    if (!optimizationId) {
      return res.status(400).json({ error: 'Optimization ID is required' });
    }

    await dispatcherService.rejectOptimization(optimizationId, reason);

    return res.json({
      success: true,
      message: 'Optimization rejected',
    });
  } catch (error: any) {
    console.error('Error rejecting optimization:', error);
    return res.status(500).json({
      error: 'Failed to reject optimization',
      message: error.message,
    });
  }
});

/**
 * GET /api/dispatcher/statistics
 * Get AI dispatcher performance statistics
 */
router.get('/statistics', checkAIDispatcherFeature, async (req, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;

    const stats = await dispatcherService.getStatistics(days);

    return res.json({
      success: true,
      statistics: stats,
      period_days: days,
    });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

export default router;
