import { Router, Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { logger } from '@utils/logger';
import { createChatCompletion, openaiClient, AI_MODELS } from '../benji/ai/client/openai.client';
import { plannerBillingService } from '../services/plannerBilling.service';
import { buildAssistantMessages, parseAssistantRequest, parseVoiceAction, takeSentences, VOICE_TOOLS, type AssistantPlanFacts } from '../services/plannerAssistant';
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

// The same voice reply, sent a sentence at a time so the app can start speaking while the rest is still being written.
plannerAssistantRouter.post('/assistant/stream', asyncHandler(async (req: Request, res: Response) => {
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
  if (request.mode !== 'voice') throw createError('Streaming is for spoken replies', 400, 'INVALID_INPUT');

  const messages = buildAssistantMessages(request, await planFacts(userId));
  const startedAt = Date.now();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = (event: string, data: unknown) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  try {
    const stream = await openaiClient.chat.completions.create({
      model: VOICE_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 180,
      stream: true,
      stream_options: { include_usage: true },
      ...(request.context.driving ? { tools: VOICE_TOOLS, tool_choice: 'auto' as const } : {}),
    });

    let buffer = '';
    let spoken = '';
    let toolName = '';
    let toolArguments = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let firstSentenceMs: number | null = null;

    for await (const chunk of stream) {
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
      const delta = chunk.choices[0]?.delta;
      for (const call of delta?.tool_calls ?? []) {
        if (call.function?.name) toolName = call.function.name;
        if (call.function?.arguments) toolArguments += call.function.arguments;
      }
      // A reply that turns into an action is spoken whole once it is known, so nothing is streamed after a tool call starts.
      if (delta?.content && !toolName) {
        buffer += delta.content;
        const taken = takeSentences(buffer);
        buffer = taken.rest;
        for (const sentence of taken.sentences) {
          firstSentenceMs ??= Date.now() - startedAt;
          spoken += `${spoken ? ' ' : ''}${sentence}`;
          send('sentence', { text: sentence });
        }
      }
    }

    const proposed = toolName === 'do_action' ? parseVoiceAction(toolArguments) : null;
    const tail = buffer.trim();
    if (tail && !proposed) {
      firstSentenceMs ??= Date.now() - startedAt;
      spoken += `${spoken ? ' ' : ''}${tail}`;
      send('sentence', { text: tail });
    }
    if (!proposed && !spoken) throw new Error('Empty assistant reply');

    logger.info('Planner assistant streamed reply', { model: VOICE_MODEL, firstSentenceMs, totalMs: Date.now() - startedAt, promptTokens, completionTokens, action: proposed?.action.type ?? null });
    send('done', {
      reply: proposed?.say ?? spoken,
      ...(proposed ? { action: proposed.action } : {}),
      usage: { promptTokens, completionTokens, costUsd: replyCostUsd(VOICE_MODEL, promptTokens, completionTokens), firstSentenceMs, totalMs: Date.now() - startedAt },
    });
  } catch (error) {
    logger.warn('Planner assistant stream failed', { error: error instanceof Error ? error.message : String(error) });
    send('error', { message: 'Benji is unavailable right now. Try again in a moment.' });
  } finally {
    res.end();
  }
}));
