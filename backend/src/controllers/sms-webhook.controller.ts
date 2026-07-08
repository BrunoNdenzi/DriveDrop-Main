/**
 * Benji V4 — Inbound SMS webhook controller
 *
 * Handles POST /api/v1/sms/webhook — Twilio calls this on every inbound message.
 *
 * Pipeline:
 *   1. Twilio signature verification (security gate)
 *   2. Parse Twilio form body (From, Body, NumMedia, MediaUrl0, etc.)
 *   3. Normalize phone to E.164
 *   4. Identity resolution: lookup profile by phone → auto-create guest if unknown
 *   5. MMS: image → base64 data URL → process_document OCR
 *           audio → download + Whisper transcription
 *   6. Derive deterministic SMS session
 *   7. Fast-path command dispatch (HELP, LOADS, APPLY, STATUS, TRACK)
 *   8. LLM fallthrough via benjiV3Service.chat()
 *   9. SMS formatter + TwiML response
 *  10. Observability counters
 */

import type { Request, Response } from 'express';
import { logger }                 from '@utils/logger';
import { formatForSms }           from '../benji-v3/sms-formatter';
import { benjiV3Service }         from '../benji-v3/benji.service';
import { v3SessionStore }         from '../benji-v3/benji.memory';
import { executeV3Tool }          from '../benji-v3/tools/index';
import type { UserType }          from '../benji-v3/benji.types';
import config                     from '@config';

// ─── Counters (in-process; reset on restart) ─────────────────────────────────

const metrics = {
  inboundTotal:       0,
  unknownPhone:       0,
  fastPathHits:       0,
  llmFallthrough:     0,
  escalations:        0,
  mmsImage:           0,
  mmsAudio:           0,
};

// ─── Twilio signature validation ─────────────────────────────────────────────

function buildWebhookUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host  = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost';
  return `${proto}://${host}${req.originalUrl}`;
}

function validateTwilioSignature(req: Request): boolean {
  if (process.env['NODE_ENV'] === 'test') return true; // bypass in test harness

  const authToken  = config.twilio.authToken;
  const signature  = req.headers['x-twilio-signature'] as string | undefined;
  if (!authToken || !signature) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilioModule = require('twilio') as { validateRequest: (token: string, sig: string, url: string, params: Record<string, string>) => boolean };
    const url    = buildWebhookUrl(req);
    const params = req.body as Record<string, string>;
    return twilioModule.validateRequest(authToken, signature, url, params);
  } catch (err) {
    logger.error('[SMS_WEBHOOK] Signature validation error', { err });
    return false;
  }
}

// ─── Phone normalization ──────────────────────────────────────────────────────

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // Twilio always sends E.164 (+1XXXXXXXXXX) — validate it looks right
  const cleaned = raw.trim();
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  return null;
}

// ─── Twilio media download (Basic Auth required) ──────────────────────────────

async function downloadTwilioMedia(
  mediaUrl: string,
  contentType: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const accountSid = config.twilio.accountSid;
    const authToken  = config.twilio.authToken;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      logger.warn('[SMS_WEBHOOK] Media download failed', { url: mediaUrl, status: response.status });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType: contentType };
  } catch (err) {
    logger.error('[SMS_WEBHOOK] Media download error', { err });
    return null;
  }
}

// ─── Image MMS → OCR ─────────────────────────────────────────────────────────

async function processImageMms(
  mediaUrl:    string,
  contentType: string,
  userId:      string,
  userType:    UserType,
): Promise<string> {
  const media = await downloadTwilioMedia(mediaUrl, contentType);
  if (!media) return '';

  // Convert to base64 data URL so GPT-4o vision can read it
  const base64    = media.buffer.toString('base64');
  const dataUrl   = `data:${media.mimeType};base64,${base64}`;
  const result    = await executeV3Tool(
    'process_document',
    JSON.stringify({ image_url: dataUrl, document_type: 'auto' }),
    userId,
    userType,
  );

  metrics.mmsImage++;
  return result.success ? result.summary : '';
}

// ─── Audio MMS → Whisper transcript ──────────────────────────────────────────

async function transcribeAudioMms(mediaUrl: string, contentType: string): Promise<string | null> {
  const media = await downloadTwilioMedia(mediaUrl, contentType);
  if (!media) return null;

  try {
    const { openaiClient } = await import('@benji/ai/client/openai.client');
    const { toFile }       = await import('openai');

    // Map Twilio MIME to a file extension OpenAI Whisper accepts
    const ext = contentType.includes('ogg')  ? 'ogg'
              : contentType.includes('mp4')  ? 'mp4'
              : contentType.includes('mpeg') ? 'mp3'
              : contentType.includes('amr')  ? 'amr'
              : contentType.includes('wav')  ? 'wav'
              : 'mp3';

    const audioFile    = await toFile(media.buffer, `voice.${ext}`, { type: contentType });
    const transcription = await openaiClient.audio.transcriptions.create({
      file:  audioFile,
      model: 'whisper-1',
    });

    metrics.mmsAudio++;
    return transcription.text;
  } catch (err) {
    logger.error('[SMS_WEBHOOK] Audio transcription error', { err });
    return null;
  }
}

// ─── Identity resolution ──────────────────────────────────────────────────────

interface ResolvedProfile {
  id:         string;
  role:       UserType;
  firstName:  string;
  isGuest:    boolean;
}

async function resolveOrCreateProfile(normalizedPhone: string): Promise<ResolvedProfile | null> {
  try {
    const { supabaseAdmin } = await import('../lib/supabase');

    // Lookup by phone — try both verified and unverified
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id, role, first_name, is_guest')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      return {
        id:        existing.id as string,
        role:      (existing.role as UserType) ?? 'client',
        firstName: (existing.first_name as string) || 'there',
        isGuest:   Boolean(existing.is_guest),
      };
    }

    // No match → auto-create guest profile
    metrics.unknownPhone++;

    // The handle_new_user trigger fires on auth.users insert and creates the profiles row.
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone:         normalizedPhone,
      phone_confirm: true,
      user_metadata: {
        source:    'sms_inbound',
        role:      'client',
        is_guest:  true,
        first_name: 'DriveDrop',
        last_name:  'Customer',
      },
    });

    if (authError || !newAuthUser.user) {
      logger.error('[SMS_WEBHOOK] Guest auth user creation failed', { error: authError?.message });
      return null;
    }

    const userId = newAuthUser.user.id;

    // Update the profile row the trigger created (or insert if trigger didn't run)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id:                userId,
        phone:             normalizedPhone,
        phone_verified_at: new Date().toISOString(),
        is_guest:          true,
        role:              'client',
        first_name:        'DriveDrop',
        last_name:         'Customer',
        email:             `guest-${userId}@sms.drivedrop.internal`,
      }, { onConflict: 'id' });

    if (profileError) {
      logger.error('[SMS_WEBHOOK] Guest profile upsert failed', { error: profileError.message });
    }

    logger.info('[SMS_WEBHOOK] Guest profile created', { userId, phone: normalizedPhone });

    return { id: userId, role: 'client', firstName: 'there', isGuest: true };
  } catch (err) {
    logger.error('[SMS_WEBHOOK] resolveOrCreateProfile error', { err });
    return null;
  }
}

// ─── Support escalation ───────────────────────────────────────────────────────

async function createEscalation(
  sessionId:         string,
  userId:            string | null,
  phoneNumber:       string,
  reason:            string,
  transcriptSnippet: string,
): Promise<void> {
  metrics.escalations++;
  try {
    const { supabaseAdmin }  = await import('../lib/supabase');
    const { emailService }   = await import('../services/email.service');

    await supabaseAdmin.from('support_escalations').insert({
      session_id:         sessionId,
      user_id:            userId,
      phone_number:       phoneNumber,
      reason,
      transcript_snippet: transcriptSnippet.slice(0, 500),
    });

    await emailService.sendEmail({
      to:          'support@drivedrop.us.com',
      subject:     `SMS Support Escalation — ${phoneNumber}`,
      htmlContent: `<p><strong>Phone:</strong> ${phoneNumber}</p>
               <p><strong>Reason:</strong> ${reason}</p>
               <p><strong>Message:</strong> ${transcriptSnippet.slice(0, 300)}</p>`,
    });
  } catch (err) {
    logger.error('[SMS_WEBHOOK] Escalation insert/notify failed', { err });
  }
}

// ─── Fast-path command dispatcher ────────────────────────────────────────────

const ESCALATION_PHRASES = /\b(agent|human|representative|rep|speak to someone|real person)\b/i;

async function handleFastPath(
  command:  string,
  profile:  ResolvedProfile,
  session:  Awaited<ReturnType<typeof v3SessionStore.getOrCreate>>,
  from:     string,
): Promise<string | null> {
  const upper = command.toUpperCase().trim();

  if (upper === 'HELP') {
    await createEscalation(
      session.sessionId,
      profile.id,
      from,
      'HELP keyword',
      command,
    );
    return "Got it — a DriveDrop team member will follow up shortly. Reply here anytime in the meantime.";
  }

  if (upper === 'LOADS' && profile.role === 'driver') {
    const result = await executeV3Tool(
      'list_shipments',
      JSON.stringify({ available_loads: true, limit: 3 }),
      profile.id,
      'driver',
    );
    return formatForSms(result.summary || (result.success ? 'No loads available right now.' : (result.errorMessage ?? 'Could not fetch loads.')));
  }

  // APPLY <n>  (driver only)
  const applyMatch = upper.match(/^APPLY\s+(\d+)$/);
  if (applyMatch && profile.role === 'driver') {
    const idx = parseInt(applyMatch[1]!, 10) - 1;
    // Retrieve last load list from session context
    const loadIds = (session.context as Record<string, unknown>)['lastLoadIds'] as string[] | undefined;
    const shipmentId = loadIds?.[idx];
    if (!shipmentId) return "I don't have a shipment #" + applyMatch[1] + " from the last LOADS list. Send LOADS to refresh.";
    const result = await executeV3Tool(
      'apply_for_shipment',
      JSON.stringify({ shipment_id: shipmentId }),
      profile.id,
      'driver',
    );
    return formatForSms(result.summary || result.errorMessage || 'Application submitted.');
  }

  // STATUS <shipmentId> <status>  (driver only)
  const statusMatch = upper.match(/^STATUS\s+(\S+)\s+(\S+)$/);
  if (statusMatch && profile.role === 'driver') {
    const result = await executeV3Tool(
      'update_shipment_status',
      JSON.stringify({ shipment_id: statusMatch[1], status: statusMatch[2]!.toLowerCase() }),
      profile.id,
      'driver',
    );
    return formatForSms(result.summary || result.errorMessage || 'Status updated.');
  }

  // TRACK <shipmentId> or bare UUID-like string
  const trackMatch = command.match(/^(?:TRACK\s+)?([0-9a-f-]{8,})/i);
  if (trackMatch) {
    const result = await executeV3Tool(
      'track_shipment',
      JSON.stringify({ shipment_id: trackMatch[1] }),
      profile.id,
      profile.role,
    );
    return formatForSms(result.summary || result.errorMessage || 'Shipment not found.');
  }

  // LOGIN keyword → trigger OTP
  if (upper === 'LOGIN') {
    // Mark session as pending OTP verification
    v3SessionStore.mergeContext(session.sessionId, { pendingOtp: true } as never);
    await v3SessionStore.save(session);
    try {
      const { twilioService } = await import('../services/twilio.service');
      await twilioService.sendVerificationCode({ to: from, channel: 'sms' });
    } catch (err) {
      logger.error('[SMS_WEBHOOK] OTP send failed', { err });
      return "Verification is temporarily unavailable. Please try again later.";
    }
    return "A verification code has been sent. Reply with the 6-digit code to verify your number.";
  }

  // 6-digit OTP response
  if (/^\d{6}$/.test(upper) && (session.context as Record<string, unknown>)['pendingOtp']) {
    try {
      const { twilioService } = await import('../services/twilio.service');
      const { supabaseAdmin } = await import('../lib/supabase');
      const valid = await twilioService.verifyPhoneNumber({ to: from, code: upper });
      if (valid) {
        await supabaseAdmin
          .from('profiles')
          .update({ phone_verified_at: new Date().toISOString() })
          .eq('id', profile.id);
        v3SessionStore.mergeContext(session.sessionId, { pendingOtp: false } as never);
        await v3SessionStore.save(session);
        return "Your number is verified! You can now use Benji SMS normally.";
      } else {
        return "That code didn't match. Reply LOGIN to try again.";
      }
    } catch (err) {
      logger.error('[SMS_WEBHOOK] OTP verify failed', { err });
      return "Verification failed. Please try again later.";
    }
  }

  return null; // no fast-path match — fall through to LLM
}

// ─── TwiML helper ─────────────────────────────────────────────────────────────

function twimlResponse(res: Response, message: string): void {
  res.set('Content-Type', 'text/xml; charset=utf-8');
  // Escape XML special characters
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`);
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function handleInboundSms(req: Request, res: Response): Promise<void> {
  metrics.inboundTotal++;

  // 1. Twilio signature validation
  if (!validateTwilioSignature(req)) {
    logger.warn('[SMS_WEBHOOK] Invalid Twilio signature', { ip: req.ip });
    res.status(403).send('Forbidden');
    return;
  }

  // 2. Parse body
  const body    = req.body as Record<string, string>;
  const rawFrom = body['From']     ?? '';
  const rawBody = body['Body']     ?? '';
  const numMedia = parseInt(body['NumMedia'] ?? '0', 10);
  const mediaUrl0         = body['MediaUrl0']         ?? '';
  const mediaContentType0 = body['MediaContentType0'] ?? '';

  // 3. Normalize phone
  const normalizedFrom = normalizePhone(rawFrom);
  if (!normalizedFrom) {
    logger.warn('[SMS_WEBHOOK] Could not normalize phone', { rawFrom });
    res.status(400).send('Bad Request');
    return;
  }

  logger.info('[SMS_WEBHOOK_IN]', {
    from:      normalizedFrom,
    bodyLen:   rawBody.length,
    numMedia,
    ts:        new Date().toISOString(),
  });

  // 4. Identity resolution
  const profile = await resolveOrCreateProfile(normalizedFrom);
  if (!profile) {
    twimlResponse(res, "Sorry, we couldn't set up your account. Please try again or visit drivedrop.us.com.");
    return;
  }

  // 5. MMS handling — convert media to text before hitting the LLM
  let messageBody = rawBody;

  if (numMedia > 0 && mediaUrl0) {
    if (mediaContentType0.startsWith('image/')) {
      const ocrText = await processImageMms(mediaUrl0, mediaContentType0, profile.id, profile.role);
      if (ocrText) {
        messageBody = ocrText + (rawBody ? `\n\nUser caption: ${rawBody}` : '');
      }
    } else if (mediaContentType0.startsWith('audio/')) {
      const transcript = await transcribeAudioMms(mediaUrl0, mediaContentType0);
      if (transcript) {
        messageBody = transcript;
      } else {
        twimlResponse(res, "I had trouble understanding that voice note. Could you type your message instead?");
        return;
      }
    } else {
      twimlResponse(res, "That file type isn't supported over text — please use the DriveDrop app or type your request.");
      return;
    }
  }

  if (!messageBody.trim()) {
    twimlResponse(res, "I didn't catch a message. What can I help you with?");
    return;
  }

  // 6. SMS session (deterministic: sms:<phone>)
  const sessionId = `sms:${normalizedFrom}`;
  const session   = await v3SessionStore.getOrCreate(
    sessionId,
    profile.id,
    profile.role,
    'sms',
    normalizedFrom,
  );

  // 7. Fast-path command parsing
  const fastReply = await handleFastPath(messageBody, profile, session, normalizedFrom);
  if (fastReply !== null) {
    metrics.fastPathHits++;
    logger.info('[SMS_WEBHOOK_FAST]', { from: normalizedFrom, reply: fastReply.slice(0, 80) });
    twimlResponse(res, fastReply);
    return;
  }

  // Check for human escalation request in free text
  if (ESCALATION_PHRASES.test(messageBody)) {
    await createEscalation(session.sessionId, profile.id, normalizedFrom, 'human-request phrase in message', messageBody);
    twimlResponse(res, "Got it — a DriveDrop team member will follow up shortly. Reply here anytime in the meantime.");
    return;
  }

  // 8. LLM fallthrough — same benjiV3Service.chat() the web/mobile UI calls
  metrics.llmFallthrough++;
  try {
    const chatResult = await benjiV3Service.chat({
      message:   messageBody,
      sessionId,
      userId:    profile.id,
      userType:  profile.role,
    });

    // Check for low-confidence LLM response (no tools used + apology pattern)
    const responseText  = chatResult.response;
    const lowConfidence = chatResult.toolsUsed.length === 0 &&
      /\b(sorry|apologize|not sure|don't know|unable to|can't help)\b/i.test(responseText);

    if (lowConfidence) {
      await createEscalation(
        session.sessionId,
        profile.id,
        normalizedFrom,
        'low-confidence LLM response',
        messageBody,
      );
    }

    // 9. Format and reply via TwiML
    const smsText = formatForSms(responseText);
    logger.info('[SMS_WEBHOOK_OUT]', {
      from:      normalizedFrom,
      tools:     chatResult.toolsUsed,
      latencyMs: chatResult.latencyMs,
      replyLen:  smsText.length,
    });
    twimlResponse(res, smsText);
  } catch (err) {
    logger.error('[SMS_WEBHOOK] LLM error', { err });
    twimlResponse(res, "I'm having trouble right now. Please try again in a moment or visit drivedrop.us.com.");
  }
}

/** Get current in-process SMS metrics (for diagnostics / health). */
export function getSmsMetrics() {
  return { ...metrics };
}
