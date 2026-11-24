import crypto from 'node:crypto';
import { supabaseAdmin } from '@lib/supabase';
import { createError } from '@utils/error';

export interface SellbirdAcceptedLeadInput {
  idempotencyKey: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  website?: string;
  reply?: string;
  offer?: string;
}

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
const MAX_TEXT_LENGTH = 2_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanOptional(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function parseSellbirdAcceptedLead(body: unknown): SellbirdAcceptedLeadInput {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const idempotencyKey = cleanOptional(input['idempotency_key'], MAX_IDEMPOTENCY_KEY_LENGTH);
  const email = cleanOptional(input['email'], 320)?.toLowerCase();
  const firstName = cleanOptional(input['first_name'], 100);
  const lastName = cleanOptional(input['last_name'], 100);
  const company = cleanOptional(input['company'], 200);
  const website = cleanOptional(input['website'], 500);
  const reply = cleanOptional(input['reply']);
  const offer = cleanOptional(input['offer']);

  if (!idempotencyKey) throw createError('idempotency_key is required', 400, 'INVALID_SELLBIRD_LEAD');
  if (!email || !EMAIL_PATTERN.test(email)) throw createError('A valid email is required', 400, 'INVALID_SELLBIRD_LEAD');

  return {
    idempotencyKey,
    email,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(company ? { company } : {}),
    ...(website ? { website } : {}),
    ...(reply ? { reply } : {}),
    ...(offer ? { offer } : {}),
  };
}

function secretMatches(candidate: string, expected: string): boolean {
  const candidateDigest = crypto.createHash('sha256').update(candidate).digest();
  const expectedDigest = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}

export function isSellbirdSecretValid(authorization: string | undefined): boolean {
  const candidate = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const secrets = [
    process.env['SELLBIRD_INTEGRATION_SECRET'],
    process.env['SELLBIRD_INTEGRATION_SECRET_PREVIOUS'],
  ].filter((value): value is string => Boolean(value?.trim()));

  return Boolean(candidate && secrets.some(secret => secretMatches(candidate, secret.trim())));
}

export function onboardingUrl(): string {
  const frontendUrl = (process.env['FRONTEND_URL'] || 'https://drivedrop.us.com').replace(/\/$/, '');
  const url = new URL('/signup', frontendUrl);
  url.searchParams.set('role', 'client');
  url.searchParams.set('product', 'route-planner');
  url.searchParams.set('source', 'sellbird');
  return url.toString();
}

export async function acceptSellbirdLead(input: SellbirdAcceptedLeadInput) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('sellbird_accepted_leads')
    .upsert({
      idempotency_key: input.idempotencyKey,
      email: input.email,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      company_name: input.company ?? null,
      website_url: input.website ?? null,
      accepted_reply: input.reply ?? null,
      accepted_offer: input.offer ?? null,
      last_received_at: now,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: false })
    .select('id, idempotency_key, email, created_at, last_received_at')
    .single();

  if (error || !data) throw createError('Unable to save accepted lead', 500, 'SELLBIRD_LEAD_SAVE_FAILED');

  return {
    leadId: data.id as string,
    idempotencyKey: data.idempotency_key as string,
    email: data.email as string,
    onboardingUrl: onboardingUrl(),
    receivedAt: data.last_received_at as string,
  };
}