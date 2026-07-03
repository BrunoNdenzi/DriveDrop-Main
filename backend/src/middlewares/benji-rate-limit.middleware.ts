/**
 * Benji V2 — Dedicated Rate Limiter Middleware
 * Phase 7B
 *
 * Separate rate-limit bucket for Benji V2 orchestrator endpoints.
 * Quota is intentionally lower than legacy ai/chat because the orchestrator
 * runs multi-step pipelines (each request may trigger multiple LLM calls).
 *
 * Limits (adjustable via BENJI_RATE_MAX_RPM / BENJI_RATE_BURST env vars):
 *   Default: 10 requests/min, burst 3 in 15s
 *
 * Separated from ai/chat (20 RPM) to prevent orchestrator load from
 * exhausting legacy-endpoint quota and vice versa.
 *
 * Headers set:
 *   X-RateLimit-Limit      — window max
 *   X-RateLimit-Remaining  — remaining in window
 *   X-RateLimit-Reset      — ISO-8601 reset time
 *   Retry-After            — seconds until next request is allowed (when limited)
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  timestamps: number[];
}

// Separate in-memory store for benji endpoints
const benjiRateLimitStore: Map<string, RateLimitEntry> = new Map();

// Defaults (overridable via env for production tuning)
const MAX_RPM       = parseInt(process.env['BENJI_RATE_MAX_RPM']    ?? '10',  10);
const WINDOW_MS     = 60_000;
const BURST_LIMIT   = parseInt(process.env['BENJI_RATE_BURST_LIMIT'] ?? '3',  10);
const BURST_WINDOW  = 15_000;  // 15 seconds

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [key, entry] of benjiRateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      benjiRateLimitStore.delete(key);
    }
  }
}, 300_000);

/**
 * Benji-specific rate limiter middleware factory.
/**
 * Benji-specific rate limiter middleware factory.
 * Returns an Express middleware that applies per-user sliding-window rate limiting.
 *
 * @param keyPrefix  Bucket namespace.  Default 'benji' (V2).  Pass 'benji-v3' for V3
 *                   so V2 and V3 have independent quotas.
 */
export function benjiRateLimit(keyPrefix: string = 'benji') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id ?? req.ip ?? 'anonymous';
    const key    = `${keyPrefix}:${userId}`;

    let entry = benjiRateLimitStore.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      benjiRateLimitStore.set(key, entry);
    }

    const now = Date.now();

    // Prune timestamps outside the main window
    entry.timestamps = entry.timestamps.filter(t => t > now - WINDOW_MS);

    // Check burst window (shorter, stricter)
    const burstCount = entry.timestamps.filter(t => t > now - BURST_WINDOW).length;
    if (burstCount >= BURST_LIMIT) {
      const oldestBurst  = entry.timestamps.filter(t => t > now - BURST_WINDOW)[0] ?? now;
      const retryAfterMs = BURST_WINDOW - (now - oldestBurst);
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      res.set('X-RateLimit-Limit',     String(MAX_RPM));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset',     new Date(now + retryAfterMs).toISOString());
      res.status(429).json({
        error:      'Too many requests',
        retryAfter: Math.ceil(retryAfterMs / 1000),
      });
      return;
    }

    // Check main window limit
    if (entry.timestamps.length >= MAX_RPM) {
      const oldest       = entry.timestamps[0] ?? now;
      const retryAfterMs = WINDOW_MS - (now - oldest);
      res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      res.set('X-RateLimit-Limit',     String(MAX_RPM));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset',     new Date(now + retryAfterMs).toISOString());
      res.status(429).json({
        error:      'Too many requests',
        retryAfter: Math.ceil(retryAfterMs / 1000),
      });
      return;
    }

    // Record this request
    entry.timestamps.push(now);
    res.set('X-RateLimit-Limit',     String(MAX_RPM));
    res.set('X-RateLimit-Remaining', String(MAX_RPM - entry.timestamps.length));
    res.set('X-RateLimit-Reset',     new Date(now + WINDOW_MS).toISOString());

    next();
  };
}
