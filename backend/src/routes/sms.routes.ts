/**
 * SMS routes (Twilio)
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import {
  sendSMS,
  sendVerificationCode,
  verifyPhoneNumber,
  sendShipmentNotification,
  sendDriverAssignmentNotification,
  sendDeliveryConfirmation,
  validatePhoneNumber,
  getMessageStatus,
} from '@controllers/sms.controller';

const router = Router();

/**
 * @route POST /api/v1/sms/send
 * @desc Send SMS message (Admin only)
 * @access Private (Admin)
 */
router.post('/send', authenticate, authorize(['admin']), sendSMS);

/**
 * @route POST /api/v1/sms/verify/send
 * @desc Send phone verification code
 * @access Private
 */
router.post('/verify/send', authenticate, sendVerificationCode);

/**
 * @route POST /api/v1/sms/verify/check
 * @desc Verify phone number with code
 * @access Private
 */
router.post('/verify/check', authenticate, verifyPhoneNumber);

/**
 * @route POST /api/v1/sms/shipment-notification
 * @desc Send shipment status notification
 * @access Private (Driver or Admin)
 */
router.post('/shipment-notification', authenticate, authorize(['driver', 'admin']), sendShipmentNotification);

/**
 * @route POST /api/v1/sms/driver-assignment
 * @desc Send driver assignment notification (Admin only)
 * @access Private (Admin)
 */
router.post('/driver-assignment', authenticate, authorize(['admin']), sendDriverAssignmentNotification);

/**
 * @route POST /api/v1/sms/delivery-confirmation
 * @desc Send delivery confirmation
 * @access Private (Driver or Admin)
 */
router.post('/delivery-confirmation', authenticate, authorize(['driver', 'admin']), sendDeliveryConfirmation);

/**
 * @route POST /api/v1/sms/validate-phone
 * @desc Validate phone number format
 * @access Private
 */
router.post('/validate-phone', authenticate, validatePhoneNumber);

/**
 * @route GET /api/v1/sms/status/:messageSid
 * @desc Get message delivery status
 * @access Private
 */
router.get('/status/:messageSid', authenticate, getMessageStatus);

export default router;
