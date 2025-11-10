/**
 * Notification routes for emails
 */
import express, { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { emailService } from '@services/email.service';
import { successResponse } from '@utils/response';
import { logger } from '@utils/logger';

const router = express.Router();

/**
 * @route POST /api/v1/notifications/welcome
 * @desc Send welcome email to new user
 * @access Public (called from Supabase trigger or mobile app)
 */
router.post('/welcome', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName } = req.body;

  if (!email || !firstName) {
    throw createError('Email and firstName are required', 400, 'MISSING_FIELDS');
  }

  logger.info('Sending welcome email', { email, firstName });

  const success = await emailService.sendWelcomeEmail({
    email,
    firstName,
  });

  if (!success) {
    throw createError('Failed to send welcome email', 500, 'EMAIL_SEND_FAILED');
  }

  res.status(200).json(successResponse({
    message: 'Welcome email sent successfully',
  }));
}));

/**
 * @route POST /api/v1/notifications/password-reset
 * @desc Send password reset email
 * @access Public
 */
router.post('/password-reset', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, resetLink } = req.body;

  if (!email || !firstName || !resetLink) {
    throw createError('Email, firstName, and resetLink are required', 400, 'MISSING_FIELDS');
  }

  logger.info('Sending password reset email', { email });

  const success = await emailService.sendPasswordResetEmail({
    email,
    firstName,
    resetLink,
  });

  if (!success) {
    throw createError('Failed to send password reset email', 500, 'EMAIL_SEND_FAILED');
  }

  res.status(200).json(successResponse({
    message: 'Password reset email sent successfully',
  }));
}));

/**
 * @route POST /api/v1/notifications/shipment-update
 * @desc Send shipment notification email
 * @access Private (internal use)
 */
router.post('/shipment-update', asyncHandler(async (req: Request, res: Response) => {
  const { email, recipientName, shipmentId, status, trackingUrl } = req.body;

  if (!email || !recipientName || !shipmentId || !status) {
    throw createError('Missing required fields', 400, 'MISSING_FIELDS');
  }

  logger.info('Sending shipment notification', { email, shipmentId, status });

  const success = await emailService.sendShipmentNotification({
    email,
    recipientName,
    shipmentId,
    status,
    trackingUrl,
  });

  if (!success) {
    throw createError('Failed to send shipment notification', 500, 'EMAIL_SEND_FAILED');
  }

  res.status(200).json(successResponse({
    message: 'Shipment notification sent successfully',
  }));
}));

/**
 * @route POST /api/v1/notifications/driver-application
 * @desc Send driver application email
 * @access Private (internal use)
 */
router.post('/driver-application', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, status } = req.body;

  if (!email || !firstName || !status) {
    throw createError('Email, firstName, and status are required', 400, 'MISSING_FIELDS');
  }

  if (!['received', 'approved', 'rejected'].includes(status)) {
    throw createError('Invalid status. Must be: received, approved, or rejected', 400, 'INVALID_STATUS');
  }

  logger.info('Sending driver application email', { email, status });

  const success = await emailService.sendDriverApplicationEmail(
    email,
    firstName,
    status as 'received' | 'approved' | 'rejected'
  );

  if (!success) {
    throw createError('Failed to send driver application email', 500, 'EMAIL_SEND_FAILED');
  }

  res.status(200).json(successResponse({
    message: 'Driver application email sent successfully',
  }));
}));

export const notificationsRoutes = router;
