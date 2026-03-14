/**
 * Email Webhooks Routes
 * Handles Brevo transactional email events and recipient unsubscribe flows.
 * Mounted at /email-webhooks (not /webhooks to avoid conflict with commercial webhook route).
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import { campaignManagerService, verifyUnsubToken } from '@services/outreach/campaignManagerService';
import { logger } from '@utils/logger';
import { BrevoWebhookEvent } from '../types/campaigns.types';

const router = Router();

/**
 * Verify the Brevo webhook signature header.
 * Brevo signs requests with HMAC-SHA256 using the webhook secret.
 */
function verifyBrevoSignature(req: Request): boolean {
  const secret = process.env['BREVO_WEBHOOK_SECRET'];
  if (!secret) return true; // If no secret configured, skip verification (dev mode)

  const signature = req.headers['x-brevo-signature'] as string | undefined;
  if (!signature) return false;

  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * POST /email-webhooks/brevo
 * Receives Brevo email event callbacks.
 * Events: delivered, opened, clicks, hard_bounce, soft_bounce, spam, unsubscribed
 */
router.post(
  '/brevo',
  asyncHandler(async (req: Request, res: Response) => {
    if (!verifyBrevoSignature(req)) {
      logger.warn('Brevo webhook: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Brevo can send a single event object or an array
    const events: BrevoWebhookEvent[] = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      if (!event.email || !event.event) {
        logger.warn(`Brevo webhook: skipping malformed event ${JSON.stringify(event)}`);
        continue;
      }

      // Extract campaign ID from tags (we embed it as a tag when sending)
      let campaignId: string | undefined;
      if (event.tags && Array.isArray(event.tags)) {
        const campaignTag = (event.tags as string[]).find((t: string) => t.startsWith('campaign:'));
        if (campaignTag) campaignId = campaignTag.replace('campaign:', '');
      }
      if (!campaignId && event.tag && (event.tag as string).startsWith('campaign:')) {
        campaignId = (event.tag as string).replace('campaign:', '');
      }

      try {
        await campaignManagerService.trackEvent(event, campaignId);
        logger.info(`Brevo event: ${event.event} for ${event.email} campaign=${campaignId ?? 'unknown'}`);
      } catch (err: any) {
        logger.error(`Failed to track Brevo event: ${err.message}`);
      }
    }

    // Always return 200 to Brevo to prevent retries
    return res.json({ received: events.length });
  })
);

/**
 * GET /email-webhooks/unsubscribe/:token
 * Renders an HTML confirmation page for one-click unsubscribes.
 * Query params: email, campaign
 */
router.get(
  '/unsubscribe/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params as { token: string };
    const email = req.query['email'] as string | undefined;
    const campaignId = req.query['campaign'] as string | undefined;

    if (!email || !campaignId) {
      return res.status(400).send('<h2>Invalid unsubscribe link.</h2>');
    }

    let valid = false;
    try {
      valid = verifyUnsubToken(token, email, campaignId);
    } catch {
      valid = false;
    }

    if (!valid) {
      return res.status(400).send('<h2>This unsubscribe link is invalid or has expired.</h2>');
    }

    // Render confirmation page
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe — DriveDrop</title>
  <style>
    body { font-family: Arial, sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#F4F4F4; }
    .card { background:#fff; border-radius:8px; padding:40px; max-width:440px; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    h2 { color:#00B8A9; }
    p { color:#555; }
    button { background:#FF9800; color:#fff; border:none; border-radius:6px; padding:12px 28px; font-size:15px; cursor:pointer; font-weight:700; }
    button:hover { background:#E65100; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Unsubscribe from DriveDrop Emails</h2>
    <p>Click below to remove <strong>${email.replace(/[<>&"']/g, '')}</strong> from our carrier outreach list.</p>
    <form method="POST" action="/api/v1/email-webhooks/unsubscribe">
      <input type="hidden" name="email" value="${email.replace(/[<>&"']/g, '')}" />
      <input type="hidden" name="campaignId" value="${campaignId.replace(/[<>&"']/g, '')}" />
      <input type="hidden" name="token" value="${token.replace(/[<>&"']/g, '')}" />
      <button type="submit">Confirm Unsubscribe</button>
    </form>
  </div>
</body>
</html>`;

    return res.send(html);
  })
);

/**
 * POST /email-webhooks/unsubscribe
 * Processes the unsubscribe form submission.
 */
router.post(
  '/unsubscribe',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, campaignId, token } = req.body as Record<string, string | undefined>;

    if (!email || !campaignId || !token) {
      return res.status(400).send('<h2>Invalid request.</h2>');
    }

    const success = await campaignManagerService.handleUnsubscribe(email, campaignId, token);

    if (!success) {
      return res.status(400).send('<h2>Invalid unsubscribe token.</h2>');
    }

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Unsubscribed — DriveDrop</title>
  <style>
    body { font-family: Arial, sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#F4F4F4; }
    .card { background:#fff; border-radius:8px; padding:40px; max-width:440px; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    h2 { color:#00B8A9; }
    p { color:#555; }
  </style>
</head>
<body>
  <div class="card">
    <h2>You've been unsubscribed</h2>
    <p>You will no longer receive carrier outreach emails from DriveDrop. This may take up to 24 hours to take effect.</p>
  </div>
</body>
</html>`);
  })
);

/**
 * GET /email-webhooks/health
 * Simple health check for webhook endpoint.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json(successResponse({ status: 'ok' }));
});

export default router;
