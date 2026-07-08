/**
 * SMS webhook routes — unauthenticated (Twilio can't send JWTs).
 * Security is enforced via Twilio signature validation in the controller.
 *
 * Mounted at /api/v1/sms alongside the existing authenticated smsRoutes.
 */
import { Router }            from 'express';
import { handleInboundSms }  from '@controllers/sms-webhook.controller';

const router = Router();

/**
 * @route POST /api/v1/sms/webhook
 * @desc  Twilio inbound SMS/MMS webhook — do NOT add authenticate middleware here
 * @access Public (Twilio signature verified inside the controller)
 */
router.post('/webhook', handleInboundSms);

export default router;
