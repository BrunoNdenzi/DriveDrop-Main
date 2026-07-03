/**
 * Benji V2 — Chat Route
 * Phase 6A / Phase 6D
 *
 * POST /api/v1/benji/chat          — primary Benji chat endpoint
 * POST /api/v1/benji/chat/confirm  — resume a suspended plan (AWAIT_CONFIRMATION)
 *
 * HTTP status mapping:
 *   COMPLETE            → 200
 *   AWAIT_CONFIRMATION  → 202
 *   CLARIFICATION_LOOP  → 200  (soft response, not an error)
 *   BLOCKED             → 403
 *   Validation error    → 400
 *   Internal error      → 500
 *
 * Security:
 *   - All routes require `authenticate` middleware (Supabase JWT)
 *   - userId is taken from verified req.user.id (never from request body)
 *   - userType derived from profile role (never trusted from client)
 *   - traceId in confirm endpoint validated against userId server-side
 *
 * Governance: I-8A (no direct supabase writes), I-10 (trace via orchestrator), I-12
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate } from '@middlewares/auth.middleware';
import { benjiRateLimit } from '../middlewares/benji-rate-limit.middleware';
import { benjiOrchestrator } from '@benji/orchestrator/benji-orchestrator';
import { resumeOrchestrator } from '@benji/orchestrator/resume.orchestrator';
import { clarificationStore } from '@benji/clarification/clarification.store';
import { supabaseAdmin } from '@lib/supabase';
import { FEATURE_FLAGS } from '../config/features';
import { streamingOrchestrator } from '@benji/orchestrator/stream.orchestrator';
import { benjiMonitoringService } from '@benji/monitoring/benji-monitoring.service';
import { streamTokenService } from '@benji/auth/stream-token.service';
import type { OrchestratorRequest } from '@benji/core/types/orchestrator.types';

const router = Router();

// ─── Role mapping ─────────────────────────────────────────────────────────────

function _roleToUserType(role: string): OrchestratorRequest['userType'] {
  switch (role) {
    case 'driver': return 'driver';
    case 'admin':  return 'admin';
    case 'broker': return 'broker';
    default:       return 'client';
  }
}

// ─── SSE stream token auth middleware ─────────────────────────────────────────

/**
 * Middleware for the SSE stream endpoint.
 * Accepts EITHER:
 *   1. Authorization: Bearer <supabase-token>  (standard; used by mobile/server clients)
 *   2. ?token=<signed-stream-token>            (for browser EventSource which cannot set headers)
 *
 * The stream token is issued by POST /api/v1/benji/chat/stream-token and is
 * HMAC-SHA256 signed, short-lived (5 min), and bound to userId.
 * Raw bearer tokens are NEVER accepted as query params.
 */
function authenticateStreamRequest(req: Request, res: Response, next: NextFunction): void {
  // Path 1: standard Authorization header — delegate to authenticate middleware
  if (req.headers.authorization?.startsWith('Bearer ')) {
    void (authenticate as (req: Request, res: Response, next: NextFunction) => Promise<void>)(req, res, next);
    return;
  }

  // Path 2: signed stream token in query param
  const token = typeof req.query['token'] === 'string' ? req.query['token'] : null;
  if (!token) {
    res.status(401).json({ error: 'Authentication required (Authorization header or ?token= required)' });
    return;
  }

  const userId = streamTokenService.verify(token);
  if (!userId) {
    res.status(401).json({ error: 'Stream token invalid or expired' });
    return;
  }

  // Populate req.user so downstream handlers work uniformly
  req.user = { id: userId, email: '', role: 'client' };
  next();
}

// ─── POST /api/v1/benji/chat ──────────────────────────────────────────────────

/**
 * Primary Benji chat entry point.
 *
 * Request body:
 *   {
 *     message:     string          (required, 1–2000 chars)
 *     sessionId?:  string
 *     currentPage?: string
 *     shipmentId?:  string
 *     attachments?: Array<{ name: string; type: string }>
 *   }
 */
router.post(
  '/chat',
  authenticate,
  benjiRateLimit(),
  async (req: Request, res: Response): Promise<void> => {
    // ── DEPRECATION HEADER ────────────────────────────────────────────────
    res.set('X-Benji-Version', 'deprecated-v2');
    res.set('X-Benji-Migrate-To', '/api/v1/benji-v3/chat');
    console.warn('[DEPRECATED] Legacy Benji V2 endpoint hit — migrate to /api/v1/benji-v3/chat', {
      userId: req.user?.id ?? 'unauthenticated',
      path:   req.path,
      ts:     new Date().toISOString(),
    });

    try {
      // ── INSTRUMENTATION ──────────────────────────────────────────────────
      console.log('[BENJI_AUDIT] BACKEND_ROUTE_HIT /benji/chat', {
        userId:  req.user?.id ?? 'unauthenticated',
        role:    req.user?.role ?? 'none',
        msgLen:  typeof req.body?.message === 'string' ? (req.body.message as string).length : 0,
        ts:      new Date().toISOString(),
      });
      // ─────────────────────────────────────────────────────────────────────

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const { message, sessionId, currentPage, shipmentId, attachments, _qaUserType, clarificationTraceId } = req.body as {
        message?:               unknown;
        sessionId?:             unknown;
        currentPage?:           unknown;
        shipmentId?:            unknown;
        attachments?:           unknown;
        /** Admin-only QA override: simulate a different userType for testing purposes. */
        _qaUserType?:           unknown;
        /**
         * Phase 9.3 — Clarification resume.
         * Set by the frontend when this message is a follow-up answer to a
         * CLARIFICATION_REQUIRED response.  Must equal the traceId returned
         * with that response.  Validated server-side (userId ownership check).
         */
        clarificationTraceId?:  unknown;
      };

      // Input validation
      if (typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'message is required and must be a non-empty string' });
        return;
      }
      if (message.length > 2000) {
        res.status(400).json({ error: 'message must not exceed 2000 characters' });
        return;
      }

      // _qaUserType: admin-only role simulation for QA console (requires BENJI_QA_CONSOLE flag)
      let userType = _roleToUserType(req.user?.role ?? 'client');
      if (
        FEATURE_FLAGS.BENJI_QA_CONSOLE &&
        req.user?.role === 'admin' &&
        typeof _qaUserType === 'string' &&
        ['client', 'driver', 'admin', 'broker'].includes(_qaUserType)
      ) {
        userType = _qaUserType as OrchestratorRequest['userType'];
      }

      const requestId = randomUUID();

      // ── Phase 9.3: Clarification resume ──────────────────────────────────
      // When the frontend sends a clarificationTraceId, look up the stored
      // context, combine the original message with the user's follow-up answer,
      // and tell the orchestrator to skip re-classification (intent is known).
      let effectiveMessage                  = message.trim();
      let preClassifiedIntent: string | undefined;

      if (typeof clarificationTraceId === 'string' && clarificationTraceId.trim().length > 0) {
        const clarCtx = clarificationStore.get(clarificationTraceId.trim(), userId);
        if (clarCtx) {
          // Combine original + answer so tool:shipment.parse can extract all fields
          effectiveMessage    = `${clarCtx.originalMessage}. ${message.trim()}`;
          preClassifiedIntent = clarCtx.intent;
          // Atomic delete — prevents replay of the same clarification context
          clarificationStore.delete(clarificationTraceId.trim());
        }
        // If not found (expired / wrong user) fall through to normal handling
      }

      const orchRequest: OrchestratorRequest = {
        requestId,
        traceId:  requestId,  // traceId created inside createTrace(); this is overwritten
        userId,
        userType,
        message:  effectiveMessage,
        ...(typeof sessionId   === 'string' ? { sessionId   } : {}),
        ...(typeof currentPage === 'string' ? { currentPage } : {}),
        ...(typeof shipmentId  === 'string' ? { shipmentId  } : {}),
        ...(Array.isArray(attachments)
          ? {
              attachments: (attachments as Array<{ name: string; type: string }>)
                .filter(a => typeof a.name === 'string' && typeof a.type === 'string')
                .map(a => ({ name: a.name, type: a.type })),
            }
          : {}),
      };

      // Pre-set the classified intent to bypass re-classification on resume
      if (preClassifiedIntent !== undefined) {
        orchRequest._classifiedIntent = preClassifiedIntent;
      }

      const result = await benjiOrchestrator.handle(orchRequest);

      // ── INSTRUMENTATION ──────────────────────────────────────────────────
      console.log('[BENJI_AUDIT] ORCHESTRATOR_RESULT', {
        state:    result.state,
        traceId:  result.traceId,
        success:  result.success,
        hasResp:  typeof result.response === 'string',
        ts:       new Date().toISOString(),
      });
      // ─────────────────────────────────────────────────────────────────────

      switch (result.state) {
        case 'COMPLETE':
          res.status(200).json({
            state:     'COMPLETE',
            traceId:   result.traceId,
            response:  result.response,
            data:      result.data,
          });
          break;

        case 'AWAIT_CONFIRMATION':
          res.status(202).json({
            state:               'AWAIT_CONFIRMATION',
            traceId:             result.traceId,
            confirmationPayload: result.confirmationPayload,
          });
          break;

        case 'CLARIFICATION_LOOP':
          res.status(200).json({
            state:                'CLARIFICATION_REQUIRED',
            traceId:              result.traceId,
            clarificationRequest: result.clarificationRequest,
          });
          break;

        case 'BLOCKED':
          res.status(403).json({
            state:     'BLOCKED',
            traceId:   result.traceId,
            blockedBy: result.blockedBy,
            error:     result.error,
          });
          break;

        default:
          res.status(500).json({
            state:   'INTERNAL_ERROR',
            traceId: result.traceId,
            error:   result.error ?? 'Unexpected orchestrator state',
          });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ state: 'INTERNAL_ERROR', error: msg });
    }
  },
);

// ─── POST /api/v1/benji/chat/confirm ─────────────────────────────────────────

/**
 * Resume a suspended plan after user confirmation.
 *
 * Request body:
 *   {
 *     traceId:    string   (required — from prior AWAIT_CONFIRMATION response)
 *     confirmed:  true     (must be exactly true; false is not supported — just do nothing)
 *   }
 */
router.post(
  '/chat/confirm',
  authenticate,
  benjiRateLimit(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const { traceId, confirmed } = req.body as { traceId?: unknown; confirmed?: unknown };

      if (typeof traceId !== 'string' || traceId.trim().length === 0) {
        res.status(400).json({ error: 'traceId is required' });
        return;
      }
      if (confirmed !== true) {
        res.status(400).json({ error: 'confirmed must be true' });
        return;
      }

      const userType = _roleToUserType(req.user?.role ?? 'client');

      // Minimal request stub — intent was already classified and is stored in the plan
      const stubRequest: OrchestratorRequest = {
        requestId: randomUUID(),
        traceId:   traceId.trim(),
        userId,
        userType,
        message:   '',  // not re-classified; resume uses stored plan intent
      };

      const result = await resumeOrchestrator.resume(traceId.trim(), userId, stubRequest);

      switch (result.state) {
        case 'COMPLETE':
          res.status(200).json({
            state:    'COMPLETE',
            traceId:  result.traceId,
            response: result.response,
            data:     result.data,
          });
          break;

        case 'BLOCKED':
          res.status(403).json({
            state:     'BLOCKED',
            traceId:   result.traceId,
            blockedBy: result.blockedBy,
            error:     result.error,
          });
          break;

        default:
          res.status(500).json({
            state:   'INTERNAL_ERROR',
            traceId: result.traceId,
            error:   result.error ?? 'Unexpected resume state',
          });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ state: 'INTERNAL_ERROR', error: msg });
    }
  },
);

// ─── GET /api/v1/benji/chat/stream ───────────────────────────────────────────────

/**
 * SSE stream of orchestration progress.
 *
 * Usage: GET /api/v1/benji/chat/stream?message=...&sessionId=...
 *
 * Emits Server-Sent Events (text/event-stream).
 * Each event is: data: <JSON BenjiStreamEvent>\n\n
 *
 * Clients should consume events until 'complete' or 'error' is received.
 */
router.get(
  '/chat/stream',
  authenticateStreamRequest,
  benjiRateLimit(),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    const message = typeof req.query['message'] === 'string' ? req.query['message'].trim() : '';
    if (!message) {
      res.status(400).json({ error: 'message query parameter is required' });
      return;
    }
    if (message.length > 2000) {
      res.status(400).json({ error: 'message must not exceed 2000 characters' });
      return;
    }

    const sessionId   = typeof req.query['sessionId']   === 'string' ? req.query['sessionId']   : undefined;
    const currentPage = typeof req.query['currentPage'] === 'string' ? req.query['currentPage'] : undefined;
    const shipmentId  = typeof req.query['shipmentId']  === 'string' ? req.query['shipmentId']  : undefined;
    const userType    = _roleToUserType(req.user?.role ?? 'client');
    const requestId   = randomUUID();

    const orchRequest: OrchestratorRequest = {
      requestId,
      traceId:  requestId,
      userId,
      userType,
      message,
      ...(sessionId   !== undefined ? { sessionId   } : {}),
      ...(currentPage !== undefined ? { currentPage } : {}),
      ...(shipmentId  !== undefined ? { shipmentId  } : {}),
    };

    await streamingOrchestrator.stream(req, res, orchRequest);
  },
);

// ─── POST /api/v1/benji/chat/stream-token ─────────────────────────────────────

/**
 * Issue a short-lived signed stream token for browser EventSource clients.
 *
 * Browser EventSource cannot send Authorization headers.
 * This endpoint issues a 5-minute, HMAC-signed token that can be passed as
 * ?token= on the GET /api/v1/benji/chat/stream URL instead.
 *
 * Requires: standard Authorization: Bearer <supabase-token> (authenticate middleware)
 * Returns:  { token: string, expiresAt: string }
 */
router.post(
  '/chat/stream-token',
  authenticate,
  benjiRateLimit(),
  (req: Request, res: Response): void => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    const token     = streamTokenService.issue(userId);
    const expiresAt = new Date(Date.now() + streamTokenService.ttlMs).toISOString();
    res.status(200).json({ token, expiresAt });
  },
);

// ─── GET /api/v1/benji/metrics ────────────────────────────────────────────────

/**
 * Observability metrics for the Benji orchestrator (admin only).
 * Returns aggregated metrics over the past 7 days.
 * Results cached 5 minutes server-side.
 */
router.get(
  '/metrics',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    try {
      const metrics = await benjiMonitoringService.getMetrics();
      res.status(200).json({ status: 'OK', metrics });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'INTERNAL_ERROR', error: msg });
    }
  },
);

// ─── GET /api/v1/benji/traces ─────────────────────────────────────────────────

/**
 * Recent Benji traces for the QA console (admin only).
 * Returns the last N traces with step counts, ordered by most recent.
 * Requires FEATURE_FLAGS.BENJI_QA_CONSOLE to be enabled.
 *
 * Query params:
 *   limit?  — number of traces to return (default 20, max 50)
 *   userId? — filter by a specific user (admin only)
 */
router.get(
  '/traces',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    if (!FEATURE_FLAGS.BENJI_QA_CONSOLE) {
      res.status(403).json({ error: 'Benji QA Console is not enabled' });
      return;
    }
    try {
      const rawLimit  = Number(req.query['limit'] ?? 20);
      const limit     = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
      const filterUser = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;

      let query = supabaseAdmin
        .from('benji_traces')
        .select('trace_id, user_id, intent, state, final_outcome, started_at, completed_at, step_count')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (filterUser !== undefined) {
        query = query.eq('user_id', filterUser);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.status(200).json({ status: 'OK', traces: data ?? [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'INTERNAL_ERROR', error: msg });
    }
  },
);

// ─── GET /api/v1/benji/traces/:traceId/steps ──────────────────────────────────

/**
 * Steps for a specific trace (admin QA only).
 */
router.get(
  '/traces/:traceId/steps',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    if (!FEATURE_FLAGS.BENJI_QA_CONSOLE) {
      res.status(403).json({ error: 'Benji QA Console is not enabled' });
      return;
    }
    try {
      const { traceId } = req.params;
      if (typeof traceId !== 'string' || traceId.trim().length === 0) {
        res.status(400).json({ error: 'traceId is required' });
        return;
      }
      const { data, error } = await supabaseAdmin
        .from('benji_trace_steps')
        .select('step_id, tool_name, success, input_hash, output_hash, timestamp')
        .eq('trace_id', traceId.trim())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      res.status(200).json({ status: 'OK', traceId, steps: data ?? [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'INTERNAL_ERROR', error: msg });
    }
  },
);

export default router;
