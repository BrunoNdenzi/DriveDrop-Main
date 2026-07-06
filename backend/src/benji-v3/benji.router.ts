/**
 * Benji V3 — Express router
 *
 * POST /api/v1/benji-v3/chat
 *
 * Thin HTTP adapter: authenticates, validates, delegates to BenjiV3Service,
 * shapes response.  No business logic lives here.
 *
 * Request body:
 *   {
 *     message:    string   (required, max 2000 chars)
 *     sessionId:  string   (required — client generates a stable UUID per chat window)
 *   }
 *
 * Response (200):
 *   {
 *     response:   string
 *     sessionId:  string
 *     toolsUsed:  string[]
 *     latencyMs:  number
 *   }
 *
 * Auth: Supabase JWT via `authenticate` middleware.
 * Rate limit: reuses the existing Benji V2 limit (10 RPM, burst 3/15s).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate }   from '@middlewares/auth.middleware';
import { benjiRateLimit } from '../middlewares/benji-rate-limit.middleware';
import { benjiV3Service } from './benji.service';
import type { UserType }  from './benji.types';

const router = Router();

// ─── Pre-rate-limit body validation ──────────────────────────────────────────
// Validate message/sessionId BEFORE the rate limiter so that malformed requests
// are rejected immediately and do NOT consume the caller's rate-limit quota.

function validateChatBody(req: Request, res: Response, next: NextFunction): void {
  const { message, sessionId, images } = req.body as {
    message?: unknown;
    sessionId?: unknown;
    images?: unknown;
  };
  if (typeof message !== 'string' || (message as string).trim().length === 0) {
    res.status(400).json({ error: 'message is required and must be a non-empty string' });
    return;
  }
  if ((message as string).length > 2000) {
    res.status(400).json({ error: 'message must not exceed 2000 characters' });
    return;
  }
  if (typeof sessionId !== 'string' || (sessionId as string).trim().length === 0) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  // Validate optional images array
  if (images !== undefined) {
    if (!Array.isArray(images)) {
      res.status(400).json({ error: 'images must be an array' });
      return;
    }
    if (images.length > 5) {
      res.status(400).json({ error: 'Maximum 5 images per request' });
      return;
    }
    for (const img of images as unknown[]) {
      if (typeof img !== 'object' || img === null || typeof (img as Record<string, unknown>)['url'] !== 'string') {
        res.status(400).json({ error: 'Each image must have a url string' });
        return;
      }
      try {
        const parsed = new URL((img as Record<string, unknown>)['url'] as string);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          res.status(400).json({ error: 'Image URLs must use http or https' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid image URL' });
        return;
      }
    }
  }
  next();
}

// ─── Helper: map Supabase role → V3 UserType ─────────────────────────────────

function _toUserType(role: string | undefined): UserType {
  switch (role) {
    case 'driver': return 'driver';
    case 'admin':  return 'admin';
    case 'broker': return 'broker';
    default:       return 'client';
  }
}

// ─── POST /api/v1/benji-v3/chat ───────────────────────────────────────────────

router.post(
  '/chat',
  authenticate,
  validateChatBody,
  benjiRateLimit('benji-v3'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const { message, sessionId, images } = req.body as {
        message: string;
        sessionId: string;
        images?: Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
      };

      const userType = _toUserType(req.user?.role);

      const result = await benjiV3Service.chat({
        message:   message.trim(),
        sessionId: sessionId.trim(),
        userId,
        userType,
        ...(images ? { images } : {}),
      });

      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  },
);

// ─── POST /api/v1/benji-v3/chat/stream ───────────────────────────────────────
// Streams the final LLM response token-by-token via SSE.
// Tool calls run synchronously first; only the text generation is streamed.

router.post(
  '/chat/stream',
  authenticate,
  validateChatBody,
  benjiRateLimit('benji-v3'),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const { message, sessionId, images } = req.body as {
      message: string;
      sessionId: string;
      images?: Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
    };

    const userType = _toUserType(req.user?.role);

    // chatStream writes SSE directly to res — does not throw
    await benjiV3Service.chatStream(
      { message: message.trim(), sessionId: sessionId.trim(), userId, userType, ...(images ? { images } : {}) },
      res,
    );
  },
);

export default router;
