import { Router, Request, Response } from 'express';
import config from '@config';
import { asyncHandler, createError } from '@utils/error';
import { logger } from '@utils/logger';
import { buildSynthesisBody, createRateLimiter, parseVoiceRequest } from '../services/plannerVoice';

export const plannerVoiceRouter = Router();

const limiter = createRateLimiter(150, 5 * 60_000);
const SYNTHESIS_TIMEOUT_MS = 6000;

// Lets the app say whether the natural voice is set up instead of silently using the device voice.
plannerVoiceRouter.get('/voice/status', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.id) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  res.json({ success: true, data: { natural: Boolean(config.googleTts.apiKey) } });
}));

// Natural-sounding turn-by-turn voice; the app falls back to the device voice whenever this is unavailable.
plannerVoiceRouter.post('/voice', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  const apiKey = config.googleTts.apiKey;
  if (!apiKey) throw createError('Natural voice is not set up on this server', 503, 'VOICE_UNAVAILABLE');
  if (!limiter.allow(userId)) throw createError('Too many voice requests. Using the device voice for now.', 429, 'VOICE_RATE_LIMITED');

  let request;
  try {
    request = parseVoiceRequest(req.body);
  } catch (error) {
    throw createError(error instanceof Error ? error.message : 'Invalid voice request', 400, 'INVALID_INPUT');
  }

  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSynthesisBody(request)),
    signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS),
  }).catch((error: unknown) => {
    logger.warn('Text-to-speech request failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  });

  if (!response || !response.ok) {
    if (response) logger.warn('Text-to-speech rejected the request', { status: response.status });
    throw createError('Natural voice is unavailable right now', 502, 'VOICE_UPSTREAM_FAILED');
  }
  const payload = await response.json() as { audioContent?: string };
  if (!payload.audioContent) throw createError('Natural voice returned no audio', 502, 'VOICE_UPSTREAM_FAILED');

  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.type('audio/mpeg').send(Buffer.from(payload.audioContent, 'base64'));
}));
