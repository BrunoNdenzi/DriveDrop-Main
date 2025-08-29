/**
 * Twilio SMS and phone verification service
 */
// Use a type-only import so that runtime doesn't eagerly require the Twilio package
import type { Twilio as TwilioType } from 'twilio';
import config from '@config';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';

// Initialize Twilio client with error handling for development
let twilio: TwilioType | undefined;
(() => {
  try {
    // Dynamically require so a broken transitive dependency (e.g. xmlbuilder missing file) doesn't crash app startup
  const twilioModule = require('twilio');
    const TwilioCtor = (twilioModule.Twilio || twilioModule) as typeof TwilioType;
    twilio = new TwilioCtor(config.twilio.accountSid, config.twilio.authToken);
  } catch (error) {
    logger.warn('Twilio dependency failed to load – SMS features will be mocked. Reason: ' + (error instanceof Error ? error.message : String(error)));
    // Leave twilio undefined; methods below will guard and throw a controlled error or skip real sending.
  }
})();

export interface SMSData {
  to: string;
  message: string;
  from?: string;
}

export interface VerificationData {
  to: string;
  channel?: 'sms' | 'call';
}

export interface VerificationCheckData {
  to: string;
  code: string;
}

/**
 * Twilio service for SMS and phone verification
 */
export const twilioService = {
  /**
   * Send SMS message
   */
  async sendSMS(data: SMSData): Promise<string> {
    try {
      if (!config.twilio.phoneNumber) {
        throw createError('Twilio phone number not configured', 500, 'TWILIO_CONFIG_ERROR');
      }

      if (!twilio || !('messages' in twilio)) {
        throw createError('Twilio client unavailable', 503, 'TWILIO_UNAVAILABLE');
      }
  const message = await (twilio as TwilioType).messages.create({
        body: data.message,
        from: data.from || config.twilio.phoneNumber,
        to: data.to,
      });

      logger.info('SMS sent successfully', {
        messageId: message.sid,
        to: data.to,
        status: message.status,
      });

      return message.sid;
    } catch (error) {
      logger.error('Error sending SMS', { error, to: data.to });
      throw createError(
        error instanceof Error ? error.message : 'SMS sending failed',
        400,
        'SMS_SEND_FAILED'
      );
    }
  },

  /**
   * Send verification code via SMS or call
   */
  async sendVerificationCode(data: VerificationData): Promise<string> {
    try {
      if (!config.twilio.verifyServiceSid) {
        throw createError('Twilio Verify service not configured', 500, 'TWILIO_CONFIG_ERROR');
      }

      if (!twilio || !('verify' in twilio)) {
        throw createError('Twilio verify unavailable', 503, 'TWILIO_UNAVAILABLE');
      }
  const verification = await (twilio as TwilioType).verify.v2
        .services(config.twilio.verifyServiceSid)
        .verifications.create({
          to: data.to,
          channel: data.channel || 'sms',
        });

      logger.info('Verification code sent', {
        to: data.to,
        channel: data.channel || 'sms',
        status: verification.status,
      });

      return verification.sid;
    } catch (error) {
      logger.error('Error sending verification code', { error, to: data.to });
      throw createError(
        error instanceof Error ? error.message : 'Verification code sending failed',
        400,
        'VERIFICATION_SEND_FAILED'
      );
    }
  },

  /**
   * Verify phone number with code
   */
  async verifyPhoneNumber(data: VerificationCheckData): Promise<boolean> {
    try {
      if (!config.twilio.verifyServiceSid) {
        throw createError('Twilio Verify service not configured', 500, 'TWILIO_CONFIG_ERROR');
      }

      if (!twilio || !('verify' in twilio)) {
        throw createError('Twilio verify unavailable', 503, 'TWILIO_UNAVAILABLE');
      }
  const verificationCheck = await (twilio as TwilioType).verify.v2
        .services(config.twilio.verifyServiceSid)
        .verificationChecks.create({
          to: data.to,
          code: data.code,
        });

      const isValid = verificationCheck.status === 'approved';

      logger.info('Phone verification attempted', {
        to: data.to,
        status: verificationCheck.status,
        isValid,
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying phone number', { error, to: data.to });
      throw createError(
        error instanceof Error ? error.message : 'Phone verification failed',
        400,
        'PHONE_VERIFICATION_FAILED'
      );
    }
  },

  /**
   * Send shipment notification SMS
   */
  async sendShipmentNotification(
    phoneNumber: string,
    shipmentId: string,
    status: string,
    trackingUrl?: string
  ): Promise<string> {
    try {
      let message = `DriveDrop: Your shipment ${shipmentId} is now ${status}.`;
      
      if (trackingUrl) {
        message += ` Track here: ${trackingUrl}`;
      }

      return await this.sendSMS({
        to: phoneNumber,
        message,
      });
    } catch (error) {
      logger.error('Error sending shipment notification', { error, phoneNumber, shipmentId });
      throw error;
    }
  },

  /**
   * Send driver assignment notification
   */
  async sendDriverAssignmentNotification(
    clientPhone: string,
    driverName: string,
    driverPhone: string,
    estimatedArrival?: string
  ): Promise<string> {
    try {
      let message = `DriveDrop: Driver ${driverName} has been assigned to your shipment.`;
      
      if (estimatedArrival) {
        message += ` Estimated arrival: ${estimatedArrival}.`;
      }
      
      message += ` Driver contact: ${driverPhone}`;

      return await this.sendSMS({
        to: clientPhone,
        message,
      });
    } catch (error) {
      logger.error('Error sending driver assignment notification', { error, clientPhone });
      throw error;
    }
  },

  /**
   * Send delivery confirmation SMS
   */
  async sendDeliveryConfirmation(
    phoneNumber: string,
    shipmentId: string,
    deliveryTime: string,
    recipientName?: string
  ): Promise<string> {
    try {
      let message = `DriveDrop: Shipment ${shipmentId} has been delivered`;
      
      if (recipientName) {
        message += ` to ${recipientName}`;
      }
      
      message += ` at ${deliveryTime}. Thank you for using DriveDrop!`;

      return await this.sendSMS({
        to: phoneNumber,
        message,
      });
    } catch (error) {
      logger.error('Error sending delivery confirmation', { error, phoneNumber, shipmentId });
      throw error;
    }
  },

  /**
   * Send promotional SMS (with opt-out)
   */
  async sendPromotionalSMS(phoneNumber: string, message: string): Promise<string> {
    try {
      const fullMessage = `${message}\n\nReply STOP to opt out.`;
      
      return await this.sendSMS({
        to: phoneNumber,
        message: fullMessage,
      });
    } catch (error) {
      logger.error('Error sending promotional SMS', { error, phoneNumber });
      throw error;
    }
  },

  /**
   * Validate phone number format
   */
  async validatePhoneNumber(phoneNumber: string): Promise<{ isValid: boolean; formatted?: string }> {
    try {
      if (!twilio || !('lookups' in twilio)) {
        return { isValid: false };
      }
  const lookup = await (twilio as TwilioType).lookups.v2.phoneNumbers(phoneNumber).fetch();
      
      return {
        isValid: lookup.valid || false,
        formatted: lookup.phoneNumber,
      };
    } catch (error) {
      logger.error('Error validating phone number', { error, phoneNumber });
      return { isValid: false };
    }
  },

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageSid: string): Promise<string> {
    try {
      if (!twilio || !('messages' in twilio)) {
        throw createError('Twilio client unavailable', 503, 'TWILIO_UNAVAILABLE');
      }
  const message = await (twilio as TwilioType).messages(messageSid).fetch();
      return message.status;
    } catch (error) {
      logger.error('Error getting message status', { error, messageSid });
      throw createError(
        error instanceof Error ? error.message : 'Failed to get message status',
        400,
        'MESSAGE_STATUS_FAILED'
      );
    }
  },
};
