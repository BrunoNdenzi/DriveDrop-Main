import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { quickSendService, QuickSendRecipientInput } from '@services/quickSend.service';
import { asyncHandler } from '@utils/error';
import { errorResponse, successResponse } from '@utils/response';
import { logger } from '@utils/logger';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/oauth/callback', asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';
  const frontendUrl = (process.env['FRONTEND_URL'] || process.env['APP_URL'] || '').replace(/\/$/, '');
  if (!code || !state) return res.redirect(`${frontendUrl}/dashboard/admin/quick-send?gmail=error`);

  try {
    await quickSendService.completeAuthorization(code, state);
    return res.redirect(`${frontendUrl}/dashboard/admin/quick-send?gmail=connected`);
  } catch (error) {
    logger.error('Quick Send Gmail OAuth callback failed', { error });
    return res.redirect(`${frontendUrl}/dashboard/admin/quick-send?gmail=error`);
  }
}));

router.get('/unsubscribe', asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.query['email'] === 'string' ? req.query['email'] : '';
  const token = typeof req.query['token'] === 'string' ? req.query['token'] : '';
  const batchId = typeof req.query['batch'] === 'string' ? req.query['batch'] : undefined;
  const success = email && token ? await quickSendService.unsubscribe(email, token, batchId) : false;
  res.status(success ? 200 : 400).type('html').send(`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:48px"><main style="max-width:520px;margin:auto;background:#fff;padding:32px;border-top:5px solid #00b8a9"><h1>${success ? 'You are unsubscribed' : 'This unsubscribe link is invalid'}</h1><p>${success ? 'You will not receive future Quick Send emails from DriveDrop.' : 'Please contact DriveDrop support for help.'}</p></main></body></html>`);
}));

router.use(authenticate, authorize(['admin']));

router.get('/connection', asyncHandler(async (_req: Request, res: Response) => {
  const { data, error } = await quickSendService.getConnectionStatus();
  if (error) return res.status(500).json(errorResponse(error.message));
  return res.json(successResponse({
    connected: Boolean(data),
    mailbox: data?.mailbox_email ?? 'infos@calkons.com',
    connectedAt: data?.connected_at ?? null,
  }));
}));

router.post('/oauth/authorize', asyncHandler(async (req: Request, res: Response) => {
  return res.json(successResponse({ url: quickSendService.getAuthorizationUrl(req.user!.id) }));
}));

router.delete('/connection', asyncHandler(async (_req: Request, res: Response) => {
  await quickSendService.disconnect();
  return res.json(successResponse({ connected: false }));
}));

router.post('/batches', asyncHandler(async (req: Request, res: Response) => {
  const { category, subject, message, recipients, pacingSeconds = 3 } = req.body as {
    category?: string;
    subject?: string;
    message?: string;
    recipients?: QuickSendRecipientInput[];
    pacingSeconds?: number;
  };
  if (!category?.trim() || !subject?.trim() || !message?.trim() || !Array.isArray(recipients)) {
    return res.status(400).json(errorResponse('category, subject, message, and recipients are required'));
  }
  if (recipients.length === 0 || recipients.length > 500) {
    return res.status(400).json(errorResponse('Provide between 1 and 500 recipients'));
  }
  const invalidRecipient = recipients.find(recipient => !recipient?.email || !emailPattern.test(recipient.email.trim()));
  if (invalidRecipient) return res.status(400).json(errorResponse(`Invalid recipient email: ${invalidRecipient?.email || 'empty'}`));
  const pacing = Number(pacingSeconds);
  if (!Number.isInteger(pacing) || pacing < 1 || pacing > 300) {
    return res.status(400).json(errorResponse('pacingSeconds must be an integer between 1 and 300'));
  }

  const batch = await quickSendService.createBatch({
    category,
    subject,
    message,
    recipients,
    pacingSeconds: pacing,
    createdBy: req.user!.id,
  });
  void quickSendService.processBatch(batch.id).catch(error => {
    logger.error('Quick Send batch processing failed', { batchId: batch.id, error });
  });
  return res.status(202).json(successResponse(batch));
}));

router.get('/batches', asyncHandler(async (req: Request, res: Response) => {
  const requestedLimit = Number(req.query['limit'] || 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;
  const { data, error } = await quickSendService.listBatches(limit);
  if (error) return res.status(500).json(errorResponse(error.message));
  return res.json(successResponse({ batches: data ?? [] }));
}));

router.get('/batches/:id/recipients', asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await quickSendService.listRecipients(req.params['id']!);
  if (error) return res.status(500).json(errorResponse(error.message));
  return res.json(successResponse({ recipients: data ?? [] }));
}));

export default router;