/**
 * Admin Routes
 * Endpoints for admin-only operations
 */
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { pricingConfigService } from '@services/pricingConfig.service';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

/**
 * GET /api/v1/admin/pricing/config
 * Get the active pricing configuration
 */
router.get('/pricing/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = await pricingConfigService.getActiveConfig();
  res.status(200).json(successResponse(config));
}));

/**
 * GET /api/v1/admin/pricing/configs
 * Get all pricing configurations
 */
router.get('/pricing/configs', asyncHandler(async (_req: Request, res: Response) => {
  const configs = await pricingConfigService.getAllConfigs();
  res.status(200).json(successResponse(configs));
}));

/**
 * PUT /api/v1/admin/pricing/config/:id
 * Update a pricing configuration
 * Body: { min_quote?, accident_min_quote?, base_fuel_price?, current_fuel_price?, surge_multiplier?, ... }
 * Required: change_reason (string)
 */
router.put('/pricing/config/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { change_reason, ...updates } = req.body;
  
  if (!id) {
    throw createError('Configuration ID is required', 400, 'MISSING_ID');
  }

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  if (!change_reason) {
    throw createError('change_reason is required for audit trail', 400, 'MISSING_FIELD');
  }

  // Remove change_reason from updates as it's handled separately
  const config = await pricingConfigService.updateConfig(
    id,
    updates,
    req.user.id,
    change_reason
  );

  res.status(200).json(successResponse(config));
}));

/**
 * POST /api/v1/admin/pricing/config
 * Create a new pricing configuration
 * Body: Full pricing config object + set_as_active (boolean)
 */
router.post('/pricing/config', asyncHandler(async (req: Request, res: Response) => {
  const { set_as_active = false, ...configData } = req.body;

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  const config = await pricingConfigService.createConfig(
    configData,
    req.user.id,
    set_as_active
  );

  res.status(201).json(successResponse(config));
}));

/**
 * POST /api/v1/admin/pricing/config/:id/activate
 * Set a pricing configuration as active
 */
router.post('/pricing/config/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Configuration ID is required', 400, 'MISSING_ID');
  }

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  const config = await pricingConfigService.setActiveConfig(id, req.user.id);

  res.status(200).json(successResponse(config));
}));

/**
 * GET /api/v1/admin/pricing/config/:id/history
 * Get the change history for a pricing configuration
 */
router.get('/pricing/config/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit } = req.query;

  const history = await pricingConfigService.getConfigHistory(
    id,
    limit ? Number(limit) : undefined
  );

  res.status(200).json(successResponse(history));
}));

/**
 * POST /api/v1/admin/pricing/cache/clear
 * Clear the pricing configuration cache (force refresh)
 */
router.post('/pricing/cache/clear', asyncHandler(async (_req: Request, res: Response) => {
  pricingConfigService.clearCache();
  res.status(200).json(successResponse({ cleared: true, timestamp: new Date().toISOString() }));
}));

export default router;
