import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { logger } from '@utils/logger';
import { createChatCompletion, AI_MODELS } from '../benji/ai/client/openai.client';
import { plannerBillingService } from '../services/plannerBilling.service';
import { buildAssistantMessages, parseAssistantRequest, parseVoiceAction, VOICE_TOOLS, type AssistantPlanFacts } from '../services/plannerAssistant';
import { createRateLimiter } from '../services/plannerVoice';

export const plannerAssistantRouter = Router();

const limiter = createRateLimiter(60, 5 * 60_000);
const TEXT_MODEL = 'gpt-4o-mini';
// Talking back and forth is where a stronger model helps most; it costs more, so it is a server setting.
const VOICE_MODEL = process.env['PLANNER_VOICE_MODEL'] === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';

// Dollars for one reply, so the app can show what a conversation costs.
function replyCostUsd(modelName: string, promptTokens: number, completionTokens: number): number {
  const model = AI_MODELS[modelName];
  if (!model) return 0;
  return (promptTokens / 1_000_000) * model.costPer1MInput + (completionTokens / 1_000_000) * model.costPer1MOutput;
}

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
  const voice = request.mode === 'voice';
  const model = voice ? VOICE_MODEL : TEXT_MODEL;
  try {
    const completion = await createChatCompletion(
      {
        model,
        messages,
        temperature: voice ? 0.6 : 0.3,
        max_tokens: voice ? 180 : 450,
        // Hands-free actions are only offered while the driver is actually on the road.
        ...(voice && request.context.driving ? { tools: VOICE_TOOLS, tool_choice: 'auto' as const } : {}),
      },
      { serviceName: 'planner-assistant', userId, maxRetries: 1 },
    );
    const message = completion.choices[0]?.message;
    const call = message?.tool_calls?.find(item => item.type === 'function' && item.function.name === 'do_action');
    const proposed = call && call.type === 'function' ? parseVoiceAction(call.function.arguments) : null;
    const reply = proposed?.say ?? message?.content?.trim();
    if (!reply) throw new Error('Empty assistant reply');
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    res.json({
      success: true,
      data: {
        reply,
        ...(proposed ? { action: proposed.action } : {}),
        usage: { promptTokens, completionTokens, costUsd: replyCostUsd(model, promptTokens, completionTokens) },
      },
    });
  } catch (error) {
    logger.warn('Planner assistant request failed', { error: error instanceof Error ? error.message : String(error) });
    throw createError('Benji is unavailable right now. Try again in a moment.', 502, 'ASSISTANT_UNAVAILABLE');
  }
}));
