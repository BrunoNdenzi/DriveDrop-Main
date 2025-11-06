/**
 * Payment API diagnostics utility
 * Helps troubleshoot payment-related issues
 */
import express, { Request, Response } from 'express';
import { createError, asyncHandler } from '@utils/error';
import { stripeService } from '@services/stripe.service';
import { emailService } from '@services/email.service';
import { successResponse } from '@utils/response';
import config from '@config';
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

/**
 * @route POST /api/v1/diagnostics/email/test
 * @desc Send test email to verify email service
 * @access Private
 */
router.post('/email/test', asyncHandler(async (req: Request, res: Response) => {
  const { email, type = 'welcome' } = req.body;

  if (!email) {
    throw createError('Email address is required', 400, 'EMAIL_REQUIRED');
  }

  try {
    let success = false;

    switch (type) {
      case 'welcome':
        success = await emailService.sendWelcomeEmail({
          firstName: 'Test User',
          email,
        });
        break;

      case 'password-reset':
        success = await emailService.sendPasswordResetEmail({
          firstName: 'Test User',
          email,
          resetLink: 'https://drivedrop.us.com/reset-password?token=test123',
        });
        break;

      case 'shipment':
        success = await emailService.sendShipmentNotification({
          recipientName: 'Test User',
          email,
          shipmentId: 'TEST-' + Date.now(),
          status: 'in_transit',
          trackingUrl: 'https://drivedrop.us.com/track/test123',
        });
        break;

      case 'driver-application':
        success = await emailService.sendDriverApplicationEmail(
          email,
          'Test User',
          'received'
        );
        break;

      default:
        throw createError('Invalid email type. Use: welcome, password-reset, shipment, or driver-application', 400, 'INVALID_EMAIL_TYPE');
    }

    if (!success) {
      throw createError('Failed to send test email. Check server logs for details.', 500, 'EMAIL_SEND_FAILED');
    }

    res.status(200).json(successResponse({
      success: true,
      message: `Test ${type} email sent successfully to ${email}`,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('Email test failed', { error, email, type });
    throw createError(
      'Failed to send test email',
      500,
      'EMAIL_TEST_FAILED'
    );
  }
}));

/**
 * @route GET /api/v1/diagnostics/email/status
 * @desc Check email service status
 * @access Private
 */
router.get('/email/status', asyncHandler(async (_req: Request, res: Response) => {
  const hasApiKey = !!process.env['BREVO_API_KEY'];

  res.status(200).json(successResponse({
    configured: hasApiKey,
    service: 'Brevo',
    status: hasApiKey ? 'ready' : 'not configured',
    message: hasApiKey 
      ? 'Email service is configured and ready'
      : 'BREVO_API_KEY not found in environment variables',
    timestamp: new Date().toISOString(),
    apiKeyLength: process.env['BREVO_API_KEY']?.length || 0,
    apiKeyPrefix: process.env['BREVO_API_KEY']?.substring(0, 15) || 'none',
  }));
}));

export const diagnosticsRoutes = router;
