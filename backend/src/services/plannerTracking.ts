import { createHmac, timingSafeEqual } from 'crypto';

// A token that can only report one run's location, so the native app can keep tracking after the login it started with expires.
export const TRACKING_TOKEN_TTL_MS = 16 * 60 * 60 * 1000;

const VERSION = 'v1';

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

function signature(secret: string, body: string): string {
  // Derived from the app secret so a tracking token can never double as any other token.
  const key = createHmac('sha256', secret).update('planner-tracking').digest();
  return createHmac('sha256', key).update(body).digest('base64url');
}

export function signTrackingToken(secret: string, userId: string, executionId: string, now: number = Date.now(), ttlMs: number = TRACKING_TOKEN_TTL_MS): { token: string; expiresAt: string } {
  const expires = now + ttlMs;
  const body = `${VERSION}.${encode(`${userId}|${executionId}|${expires}`)}`;
  return { token: `${body}.${signature(secret, body)}`, expiresAt: new Date(expires).toISOString() };
}

// Returns the owner's user id when the token is genuine, unexpired and for this run; otherwise null.
export function verifyTrackingToken(secret: string, token: string, executionId: string, now: number = Date.now()): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const given = Buffer.from(parts[2] ?? '');
  const expected = Buffer.from(signature(secret, body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const [userId, runId, expires] = decode(parts[1] ?? '').split('|');
  if (!userId || runId !== executionId || !expires || !Number.isFinite(Number(expires)) || Number(expires) <= now) return null;
  return userId;
}
