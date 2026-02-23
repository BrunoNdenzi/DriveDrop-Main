/**
 * AI Rate Limiting Middleware
 * 
 * Per-user rate limiting for AI endpoints to prevent abuse and control costs.
 * Uses sliding window algorithm with burst protection.
 */
import { Request, Response, NextFunction } from 'express';
import { RATE_LIMITS, RateLimitConfig } from '../config/ai.config';

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory store per user per endpoint category
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000; // Remove entries older than 2 min
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300_000);

/**
 * Create rate limiter middleware for a specific AI endpoint category
 */
export function aiRateLimit(category: keyof typeof RATE_LIMITS) {
  const config: RateLimitConfig = RATE_LIMITS[category]!;

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.id || req.ip || 'anonymous';
    const key = `${category}:${userId}`;

    // Get or create entry
    let entry = rateLimitStore.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      rateLimitStore.set(key, entry);
    }

    const now = Date.now();

    // Clean old timestamps outside the main window
    entry.timestamps = entry.timestamps.filter(t => t > now - config.windowMs);

    // Check main window limit
    if (entry.timestamps.length >= config.maxRequests) {
      const oldestInWindow = entry.timestamps[0] || now;
      const retryAfterMs = config.windowMs - (now - oldestInWindow);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      res.set('Retry-After', String(retryAfterSec));
      res.set('X-RateLimit-Limit', String(config.maxRequests));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', new Date(now + retryAfterMs).toISOString());

      console.warn(`[AI Rate Limit] User ${userId} exceeded ${category} limit (${config.maxRequests}/${config.windowMs}ms)`);

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many AI requests. Please wait ${retryAfterSec} seconds before trying again.`,
        retryAfterSeconds: retryAfterSec,
        limit: config.maxRequests,
        window: `${config.windowMs / 1000}s`,
      });
      return;
    }

    // Check burst limit
    const recentTimestamps = entry.timestamps.filter(t => t > now - config.burstWindowMs);
    if (recentTimestamps.length >= config.burstLimit) {
      const retryAfterSec = Math.ceil(config.burstWindowMs / 1000);

      res.set('Retry-After', String(retryAfterSec));
      res.set('X-RateLimit-Limit', String(config.burstLimit));
      res.set('X-RateLimit-Remaining', '0');

      console.warn(`[AI Rate Limit] User ${userId} exceeded ${category} burst limit (${config.burstLimit}/${config.burstWindowMs}ms)`);

      res.status(429).json({
        error: 'Burst rate limit exceeded',
        message: `Slow down! Please wait a few seconds between AI requests.`,
        retryAfterSeconds: retryAfterSec,
        burstLimit: config.burstLimit,
      });
      return;
    }

    // Record this request
    entry.timestamps.push(now);

    // Set rate limit headers
    const remaining = config.maxRequests - entry.timestamps.length;
    res.set('X-RateLimit-Limit', String(config.maxRequests));
    res.set('X-RateLimit-Remaining', String(remaining));

    next();
  };
}
