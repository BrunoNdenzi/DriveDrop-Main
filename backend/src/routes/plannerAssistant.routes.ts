import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { logger } from '@utils/logger';
import { createChatCompletion } from '../benji/ai/client/openai.client';
import { plannerBillingService } from '../services/plannerBilling.service';
import { buildAssistantMessages, parseAssistantRequest, type AssistantPlanFacts } from '../services/plannerAssistant';
import { createRateLimiter } from '../services/plannerVoice';

export const plannerAssistantRouter = Router();

const limiter = createRateLimiter(40, 5 * 60_000);
const ASSISTANT_MODEL = 'gpt-4o-mini';

async function planFacts(userId: string): Promise<AssistantPlanFacts | null> {
  try {
    const status = await plannerBillingService.getStatus(userId);
    return {
      name: status.plan.name,
      maxStopsPerRoute: status.plan.maxStopsPerRoute,
      maxDrivers: status.plan.maxDrivers,
      monthlyRoutes: status.plan.monthlyRoutes,
      routesUsed: status.usage.routesUsed,
      trialEndsAt: status.status === 'trialing' ? status.trialEndsAt : null,
    };
  } catch {
    return null;
  }
}

// Planner-specific assistant: it only sees what the page sends plus the caller's own plan, and has no access to marketplace data or tools.
plannerAssistantRouter.post('/assistant', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw createError('Authentication required', 401, 'UNAUTHORIZED');
  if (!process.env['OPENAI_API_KEY']) throw createError('Benji is not set up on this server', 503, 'ASSISTANT_UNAVAILABLE');
  if (!limiter.allow(userId)) throw createError('You are asking a lot of questions. Try again in a few minutes.', 429, 'ASSISTANT_RATE_LIMITED');

  let request;
  try {
    request = parseAssistantRequest(req.body);
  } catch (error) {
    throw createError(error instanceof Error ? error.message : 'Invalid question', 400, 'INVALID_INPUT');
  }

  const messages = buildAssistantMessages(request, await planFacts(userId));
  try {
    const completion = await createChatCompletion(
      { model: ASSISTANT_MODEL, messages, temperature: 0.3, max_tokens: 450 },
      { serviceName: 'planner-assistant', userId, maxRetries: 1 },
    );
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error('Empty assistant reply');
    res.json({ success: true, data: { reply } });
  } catch (error) {
    logger.warn('Planner assistant request failed', { error: error instanceof Error ? error.message : String(error) });
    throw createError('Benji is unavailable right now. Try again in a moment.', 502, 'ASSISTANT_UNAVAILABLE');
  }
}));
