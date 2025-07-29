/**
 * Payment API diagnostics utility
 * Helps troubleshoot payment-related issues
 */
import express, { Request, Response } from 'express';
import { createError, asyncHandler } from '@utils/error';
import { stripeService } from '@services/stripe.service';
import { successResponse } from '@utils/response';
import config from '@config/index';
import { logger } from '@utils/logger';

const router = express.Router();

/**
 * @route GET /api/v1/diagnostics/stripe
 * @desc Check Stripe API connectivity
 * @access Private
 */
router.get('/stripe', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Try to connect to Stripe API
    const isConnected = await stripeService.verifyConnectivity();
    
    if (!isConnected) {
      throw createError('Stripe service is currently unavailable', 503, 'STRIPE_SERVICE_UNAVAILABLE');
    }
    
    res.status(200).json(successResponse({
      success: true,
      message: 'Stripe service is available',
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('Stripe status check failed', { error });
    throw createError(
      'Failed to verify Stripe service status',
      503,
      'STRIPE_STATUS_CHECK_FAILED'
    );
  }
}));

/**
 * @route GET /api/v1/diagnostics/payment
 * @desc Get payment API status
 * @access Private
 */
router.get('/payment', asyncHandler(async (_req: Request, res: Response) => {
  // Return payment API status
  res.status(200).json(successResponse({
    success: true,
    message: 'Payment API is operational',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    endpoints: {
      paymentIntent: '/api/v1/payments/create-intent',
      webhook: '/api/v1/payments/webhook',
      customer: '/api/v1/payments/customer',
      diagnostics: '/api/v1/diagnostics/stripe',
    }
  }));
}));

/**
 * @route GET /api/v1/diagnostics/config
 * @desc Get environment configuration (sanitized)
 * @access Private
 */
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  // Return sanitized configuration
  res.status(200).json(successResponse({
    environment: config.server.nodeEnv,
    version: process.env['npm_package_version'] || 'unknown',
    nodeVersion: process.version,
    apiPrefix: config.server.apiPrefix,
    hasStripeConfig: !!config.stripe.secretKey,
    hasSupabaseConfig: !!config.supabase.url,
    cors: {
      enabled: true,
      origins: Array.isArray(config.server.corsOrigin) 
        ? config.server.corsOrigin.length
        : 'string',
    },
  }));
}));

export const diagnosticsRoutes = router;
