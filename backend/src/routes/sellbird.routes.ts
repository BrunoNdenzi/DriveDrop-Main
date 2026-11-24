import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { createRateLimiter } from '@services/plannerVoice';
import {
  acceptSellbirdLead,
  isSellbirdSecretValid,
  parseSellbirdAcceptedLead,
} from '@services/sellbirdAcceptedLead.service';

const router = Router();
const limiter = createRateLimiter(60, 5 * 60_000);

router.post('/accepted-leads', asyncHandler(async (req: Request, res: Response) => {
  if (!limiter.allow(req.ip || 'unknown')) {
    throw createError('Too many requests', 429, 'SELLBIRD_RATE_LIMITED');
  }
  if (!isSellbirdSecretValid(req.get('authorization'))) {
    throw createError('Unauthorized', 401, 'SELLBIRD_UNAUTHORIZED');
  }

  const result = await acceptSellbirdLead(parseSellbirdAcceptedLead(req.body));
  res.status(200).json({ success: true, data: result });
}));

export default router;
