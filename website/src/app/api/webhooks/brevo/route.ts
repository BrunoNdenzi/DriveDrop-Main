import { NextRequest, NextResponse } from 'next/server'
import {
  getDeliveryLogByMessageId,
  updateDeliveryLog,
  resendViaFallback,
} from '@/lib/email'
import { createAdminNotification } from '@/lib/admin-notifications'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// Brevo sends a webhook secret in the header "X-Brevo-Webhook-Secret"
// Set BREVO_WEBHOOK_SECRET in your Vercel environment.
const WEBHOOK_SECRET = process.env.BREVO_WEBHOOK_SECRET

// Bounce event types that warrant a fallback resend
const HARD_BOUNCE_EVENTS = new Set(['hard_bounce', 'blocked', 'invalid_email'])
const SOFT_BOUNCE_EVENTS = new Set(['soft_bounce', 'deferred'])

// Brevo attaches the original Message-ID under `message-id` or `X-Mailin-Message-Id`
function extractMessageId(payload: Record<string, unknown>): string | null {
  const raw =
    (payload['message-id'] as string) ||
    (payload['X-Mailin-Message-Id'] as string) ||
    (payload['MessageId'] as string) ||
    null
  if (!raw) return null
  return raw.replace(/[<>]/g, '').trim()
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function notifyAdmin(subject: string, body: string) {
  const alertEmail = process.env.SMTP_ALERT_EMAIL || 'infos@calkons.com'
  try {
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '',
      },
    })
    await t.sendMail({
      from: `DriveDrop Alerts <${process.env.GMAIL_USER || alertEmail}>`,
      to: alertEmail,
      subject,
      html: body,
    })
  } catch {
    console.error('[brevo-webhook] Admin notification failed')
  }
}

export async function POST(req: NextRequest) {
  // --- Authenticate webhook ---
  if (WEBHOOK_SECRET) {
    const incomingSecret =
      req.headers.get('X-Brevo-Webhook-Secret') ||
      req.headers.get('x-brevo-webhook-secret')
    if (incomingSecret !== WEBHOOK_SECRET) {
      console.warn('[brevo-webhook] Invalid or missing webhook secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event as string | undefined
  if (!event) {
    return NextResponse.json({ ok: true, message: 'No event field — ignored' })
  }

  console.log('[brevo-webhook] Received event:', event, 'email:', payload.email)

  // --- Delivery confirmation ---
  if (event === 'delivered') {
    const msgId = extractMessageId(payload)
    if (msgId) {
      await updateDeliveryLog(msgId, { status: 'delivered' })
    }
    return NextResponse.json({ ok: true })
  }

  // --- Bounce handling ---
  const isBounce = HARD_BOUNCE_EVENTS.has(event) || SOFT_BOUNCE_EVENTS.has(event)
  if (!isBounce) {
    return NextResponse.json({ ok: true, message: `Event ${event} — no action needed` })
  }

  const msgId = extractMessageId(payload)
  if (!msgId) {
    console.warn('[brevo-webhook] Could not extract message-id from bounce event')
    return NextResponse.json({ ok: true, message: 'No message-id — cannot correlate' })
  }

  // Look up original delivery log
  const log = await getDeliveryLogByMessageId(msgId)

  if (!log) {
    console.warn('[brevo-webhook] No delivery log found for message-id:', msgId)
    return NextResponse.json({ ok: true, message: 'Log not found' })
  }

  // Already retried — do not loop
  if (log.status === 'retried' || log.retry_count >= 1) {
    console.log('[brevo-webhook] Already retried for:', msgId)
    return NextResponse.json({ ok: true, message: 'Already retried' })
  }

  // Mark as bounced
  const bounceType = HARD_BOUNCE_EVENTS.has(event) ? 'hard' : 'soft'
  await updateDeliveryLog(msgId, {
    status: 'bounced',
    bounce_type: bounceType,
    bounce_reason: (payload.reason as string) || event,
  })

  // Attempt fallback resend (Gmail)
  const resent = await resendViaFallback({
    message_id: log.message_id,
    recipient: log.recipient,
    subject: log.subject,
    html: log.html,
  })

  if (resent) {
    console.log('[brevo-webhook] Fallback resend succeeded for:', log.recipient)
    return NextResponse.json({ ok: true, action: 'fallback-resent' })
  }

  // Fallback also failed — mark permanently failed and alert admin
  await updateDeliveryLog(msgId, { status: 'failed' })

  // Admin notification + email alert (fire both)
  await Promise.all([
    createAdminNotification({
      type: 'email_failure',
      title: 'Email Permanently Failed',
      message: `Could not deliver "${log.subject}" to ${log.recipient} even after fallback resend (bounce type: ${bounceType}).`,
      severity: 'high',
      actionLink: '/dashboard/admin/notifications',
      data: { recipient: log.recipient, subject: log.subject, bounceType, event },
    }),
    notifyAdmin(
      `[ALERT] Email permanently failed — ${log.recipient}`,
      `<p>An email could not be delivered even after a fallback resend.</p>
      <ul>
        <li><strong>Recipient:</strong> ${log.recipient}</li>
        <li><strong>Subject:</strong> ${log.subject}</li>
        <li><strong>Bounce type:</strong> ${bounceType} (${event})</li>
        <li><strong>Reason:</strong> ${(payload.reason as string) || 'N/A'}</li>
        <li><strong>Original sent:</strong> ${log.created_at}</li>
      </ul>
      <p>Please follow up with the recipient manually.</p>`
    ),
  ])

  return NextResponse.json({ ok: true, action: 'permanently-failed' })
}
