/**
 * Twilio SMS and phone verification controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { twilioService } from '@services/twilio.service';
import { isValidPhone } from '@utils/validation';

/**
 * Send SMS message
 * @route POST /api/v1/sms/send
 * @access Private (Admin only)
 */
export const sendSMS = asyncHandler(async (req: Request, res: Response) => {
  const { to, message, from } = req.body;

  if (!to || !message) {
    throw createError('Phone number and message are required', 400, 'MISSING_FIELDS');
  }

  if (!isValidPhone(to)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  // Only admins can send arbitrary SMS messages
  if (req.user?.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const messageSid = await twilioService.sendSMS({
    to,
    message,
    from,
  });

  res.status(201).json(successResponse({
    messageSid,
    to,
    status: 'sent',
  }));
});

/**
 * Send phone verification code
 * @route POST /api/v1/sms/verify/send
 * @access Private
 */
export const sendVerificationCode = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, channel = 'sms' } = req.body;

  if (!phoneNumber) {
    throw createError('Phone number is required', 400, 'MISSING_PHONE');
  }

  if (!isValidPhone(phoneNumber)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  if (channel !== 'sms' && channel !== 'call') {
    throw createError('Channel must be sms or call', 400, 'INVALID_CHANNEL');
  }

  const verificationSid = await twilioService.sendVerificationCode({
    to: phoneNumber,
    channel,
  });

  res.status(200).json(successResponse({
    verificationSid,
    phoneNumber,
    channel,
    status: 'pending',
  }));
});

/**
 * Verify phone number with code
 * @route POST /api/v1/sms/verify/check
 * @access Private
 */
export const verifyPhoneNumber = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, code } = req.body;

  if (!phoneNumber || !code) {
    throw createError('Phone number and verification code are required', 400, 'MISSING_FIELDS');
  }

  if (!isValidPhone(phoneNumber)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  const isValid = await twilioService.verifyPhoneNumber({
    to: phoneNumber,
    code,
  });

  res.status(200).json(successResponse({
    phoneNumber,
    isValid,
    status: isValid ? 'approved' : 'denied',
  }));
});

/**
 * Send shipment notification
 * @route POST /api/v1/sms/shipment-notification
 * @access Private (Driver or Admin)
 */
export const sendShipmentNotification = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, shipmentId, status, trackingUrl } = req.body;

  if (!phoneNumber || !shipmentId || !status) {
    throw createError('Phone number, shipment ID, and status are required', 400, 'MISSING_FIELDS');
  }

  if (!isValidPhone(phoneNumber)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  // Only drivers and admins can send shipment notifications
  if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
    throw createError('Driver or admin access required', 403, 'FORBIDDEN');
  }

  const messageSid = await twilioService.sendShipmentNotification(
    phoneNumber,
    shipmentId,
    status,
    trackingUrl
  );

  res.status(200).json(successResponse({
    messageSid,
    phoneNumber,
    shipmentId,
    status: 'sent',
  }));
});

/**
 * Send driver assignment notification
 * @route POST /api/v1/sms/driver-assignment
 * @access Private (Admin only)
 */
export const sendDriverAssignmentNotification = asyncHandler(async (req: Request, res: Response) => {
  const { clientPhone, driverName, driverPhone, estimatedArrival } = req.body;

  if (!clientPhone || !driverName || !driverPhone) {
    throw createError('Client phone, driver name, and driver phone are required', 400, 'MISSING_FIELDS');
  }

  if (!isValidPhone(clientPhone) || !isValidPhone(driverPhone)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  // Only admins can send driver assignment notifications
  if (req.user?.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const messageSid = await twilioService.sendDriverAssignmentNotification(
    clientPhone,
    driverName,
    driverPhone,
    estimatedArrival
  );

  res.status(200).json(successResponse({
    messageSid,
    clientPhone,
    driverName,
    status: 'sent',
  }));
});

/**
 * Send delivery confirmation
 * @route POST /api/v1/sms/delivery-confirmation
 * @access Private (Driver or Admin)
 */
export const sendDeliveryConfirmation = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, shipmentId, deliveryTime, recipientName } = req.body;

  if (!phoneNumber || !shipmentId || !deliveryTime) {
    throw createError('Phone number, shipment ID, and delivery time are required', 400, 'MISSING_FIELDS');
  }

  if (!isValidPhone(phoneNumber)) {
    throw createError('Invalid phone number format', 400, 'INVALID_PHONE');
  }

  // Only drivers and admins can send delivery confirmations
  if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
    throw createError('Driver or admin access required', 403, 'FORBIDDEN');
  }

  const messageSid = await twilioService.sendDeliveryConfirmation(
    phoneNumber,
    shipmentId,
    deliveryTime,
    recipientName
  );

  res.status(200).json(successResponse({
    messageSid,
    phoneNumber,
    shipmentId,
    status: 'sent',
  }));
});

/**
 * Validate phone number
 * @route POST /api/v1/sms/validate-phone
 * @access Private
 */
export const validatePhoneNumber = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw createError('Phone number is required', 400, 'MISSING_PHONE');
  }

  const validation = await twilioService.validatePhoneNumber(phoneNumber);

  res.status(200).json(successResponse({
    phoneNumber,
    isValid: validation.isValid,
    formatted: validation.formatted,
  }));
});

/**
 * Get message status
 * @route GET /api/v1/sms/status/:messageSid
 * @access Private
 */
export const getMessageStatus = asyncHandler(async (req: Request, res: Response) => {
  const { messageSid } = req.params;

  if (!messageSid) {
    throw createError('Message SID is required', 400, 'MISSING_MESSAGE_SID');
  }

  const status = await twilioService.getMessageStatus(messageSid);

  res.status(200).json(successResponse({
    messageSid,
    status,
  }));
});
