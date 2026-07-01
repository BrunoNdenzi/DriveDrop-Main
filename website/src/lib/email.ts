import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// SMTP Transports
// ---------------------------------------------------------------------------

// Primary — Brevo SMTP port 587 (STARTTLS)
const primaryTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

// Secondary — Brevo port 465 (SSL), same credentials, different path
const secondaryTransporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

// Fallback — Gmail (infos@calkons.com) used when Brevo bounces are detected
// Activated by GMAIL_USER + GMAIL_APP_PASSWORD env vars
const fallbackTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
  },
})

// Tertiary — optional independent third-party provider
const hasTertiaryProvider = Boolean(
  process.env.SMTP2_HOST && process.env.SMTP2_USER && process.env.SMTP2_PASS
)
const tertiaryTransporter = hasTertiaryProvider
  ? nodemailer.createTransport({
      host: process.env.SMTP2_HOST!,
      port: parseInt(process.env.SMTP2_PORT || '587'),
      secure: (process.env.SMTP2_PORT || '587') === '465',
      auth: { user: process.env.SMTP2_USER!, pass: process.env.SMTP2_PASS! },
    })
  : null

// ---------------------------------------------------------------------------
// Delivery Logger (uses service role — server-side only)
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function logDelivery(params: {
  messageId: string
  recipient: string
  subject: string
  fromAddress: string
  html: string
  status: 'sent' | 'failed'
  provider: string
}) {
  try {
    const db = getServiceClient()
    if (!db) return
    await db.from('email_delivery_logs').upsert({
      message_id: params.messageId,
      recipient: params.recipient,
      subject: params.subject,
      from_address: params.fromAddress,
      html: params.html,
      status: params.status,
      provider: params.provider,
    }, { onConflict: 'message_id' })
  } catch (err) {
    console.warn('[email] Failed to write delivery log:', err)
  }
}

export async function updateDeliveryLog(messageId: string, updates: {
  status?: string
  bounce_type?: string
  bounce_reason?: string
  retry_count?: number
  last_retry_at?: string
}) {
  try {
    const db = getServiceClient()
    if (!db) return
    await db.from('email_delivery_logs').update(updates).eq('message_id', messageId)
  } catch (err) {
    console.warn('[email] Failed to update delivery log:', err)
  }
}

export async function getDeliveryLogByMessageId(messageId: string) {
  const db = getServiceClient()
  if (!db) return null
  const { data } = await db
    .from('email_delivery_logs')
    .select('*')
    .eq('message_id', messageId)
    .single()
  return data
}

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

const SPAM_NOTE = `
  <tr>
    <td style="padding:12px 40px 24px;background-color:#fffbeb;border-top:1px solid #fde68a;text-align:center;">
      <p style="margin:0;color:#92400e;font-size:11px;">
        📬 <strong>If you did not receive this email</strong>, please check your <strong>spam or junk folder</strong> and mark it as "Not Spam".
      </p>
    </td>
  </tr>
`

function injectSpamNote(html: string): string {
  const lastClose = html.lastIndexOf('</table>')
  if (lastClose === -1) return html
  return html.slice(0, lastClose) + SPAM_NOTE + html.slice(lastClose)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send an email via Brevo primary SMTP with automatic fallover.
 * Every attempt is logged to `email_delivery_logs` so the Brevo webhook
 * handler can detect async bounces and trigger a fallback resend.
 */
export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  const enrichedHtml = injectSpamNote(html)
  const fromAddress = from || process.env.SMTP_FROM || 'DriveDrop <infos@drivedrop.us.com>'
  const mailOptions = { from: fromAddress, to, subject, html: enrichedHtml }

  // --- Primary (Brevo 587) ---
  try {
    const info = await primaryTransporter.sendMail(mailOptions)
    const msgId = String(info.messageId || '').replace(/[<>]/g, '')
    console.log('✅ Email sent (primary):', { messageId: msgId, to, subject })
    await logDelivery({ messageId: msgId, recipient: to, subject, fromAddress, html: enrichedHtml, status: 'sent', provider: 'brevo' })
    return info
  } catch (primaryError) {
    console.warn('⚠️ Primary SMTP failed, trying secondary:', primaryError)
  }

  // --- Secondary (Brevo 465) ---
  try {
    const info = await secondaryTransporter.sendMail(mailOptions)
    const msgId = String(info.messageId || '').replace(/[<>]/g, '')
    console.log('✅ Email sent (secondary):', { messageId: msgId, to, subject })
    await logDelivery({ messageId: msgId, recipient: to, subject, fromAddress, html: enrichedHtml, status: 'sent', provider: 'brevo-ssl' })
    return info
  } catch (secondaryError) {
    console.warn('⚠️ Secondary SMTP failed:', secondaryError)
  }

  // --- Tertiary (optional 3rd-party) ---
  if (tertiaryTransporter) {
    try {
      const tertiaryOptions = { ...mailOptions, from: process.env.SMTP2_FROM || fromAddress }
      const info = await tertiaryTransporter.sendMail(tertiaryOptions)
      const msgId = String(info.messageId || '').replace(/[<>]/g, '')
      console.log('✅ Email sent (tertiary):', { messageId: msgId, to, subject })
      await logDelivery({ messageId: msgId, recipient: to, subject, fromAddress, html: enrichedHtml, status: 'sent', provider: 'tertiary' })
      return info
    } catch (tertiaryError) {
      console.warn('⚠️ Tertiary SMTP failed:', tertiaryError)
    }
  }

  // --- All transports failed — alert admin ---
  const alertEmail = process.env.SMTP_ALERT_EMAIL || 'infos@calkons.com'
  const alertSubject = `[EMAIL FAILURE] Failed to send: "${subject}" to ${to}`
  const alertHtml = `<p>All SMTP transports failed for <strong>${to}</strong> — subject: <strong>${subject}</strong>.</p><p>Check Brevo and provider configuration.</p>`
  if (to !== alertEmail) {
    for (const t of [primaryTransporter, secondaryTransporter, ...(tertiaryTransporter ? [tertiaryTransporter] : [])]) {
      try { await t.sendMail({ from: fromAddress, to: alertEmail, subject: alertSubject, html: alertHtml }); break } catch { /* try next */ }
    }
  }
  throw new Error(`All email transports failed for ${to} (subject: ${subject})`)
}

/**
 * Resend an email via the Gmail fallback (infos@calkons.com).
 * Called by the Brevo webhook handler when a bounce is detected.
 */
export async function resendViaFallback(log: {
  message_id: string
  recipient: string
  subject: string
  html: string
}): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[email] Fallback resend skipped — GMAIL_USER/GMAIL_APP_PASSWORD not set')
    return false
  }
  try {
    const info = await fallbackTransporter.sendMail({
      from: `DriveDrop <${process.env.GMAIL_USER}>`,
      to: log.recipient,
      subject: log.subject,
      html: log.html,
    })
    const newMsgId = String(info.messageId || '').replace(/[<>]/g, '')
    console.log('✅ Fallback resend successful:', { newMsgId, to: log.recipient })
    await logDelivery({
      messageId: newMsgId,
      recipient: log.recipient,
      subject: `[RETRY] ${log.subject}`,
      fromAddress: process.env.GMAIL_USER!,
      html: log.html,
      status: 'sent',
      provider: 'gmail-fallback',
    })
    await updateDeliveryLog(log.message_id, {
      status: 'retried',
      last_retry_at: new Date().toISOString(),
    })
    return true
  } catch (err) {
    console.error('[email] Fallback resend failed:', err)
    return false
  }
}

