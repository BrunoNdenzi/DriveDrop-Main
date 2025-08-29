import { Request, Response } from 'express';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import config from '@config';

/**
 * Get Stripe configuration
 * @route GET /api/v1/payments/config
 * @access Public
 */
export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(successResponse({
    publishableKey: config.stripe.publishableKey,
  }));
});
