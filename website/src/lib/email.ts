import nodemailer from 'nodemailer'

// Primary transporter — Brevo SMTP (port 587, STARTTLS)
const primaryTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

// Secondary transporter — Brevo port 465 (SSL) — same provider, different port/auth path
const secondaryTransporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

// Tertiary transporter — completely separate provider (e.g. SendGrid, Mailgun, AWS SES, Postmark)
// Configured independently so it works even if Brevo's entire infrastructure is down.
// Set SMTP2_HOST / SMTP2_PORT / SMTP2_USER / SMTP2_PASS / SMTP2_FROM in your env to activate.
const hasTertiaryProvider = Boolean(
  process.env.SMTP2_HOST &&
  process.env.SMTP2_USER &&
  process.env.SMTP2_PASS
)

const tertiaryTransporter = hasTertiaryProvider
  ? nodemailer.createTransport({
      host: process.env.SMTP2_HOST!,
      port: parseInt(process.env.SMTP2_PORT || '587'),
      secure: (process.env.SMTP2_PORT || '587') === '465',
      auth: {
        user: process.env.SMTP2_USER!,
        pass: process.env.SMTP2_PASS!,
      },
    })
  : null

const SPAM_NOTE = `
  <tr>
    <td style="padding:12px 40px 24px;background-color:#fffbeb;border-top:1px solid #fde68a;text-align:center;">
      <p style="margin:0;color:#92400e;font-size:11px;">
        📬 <strong>If you did not receive this email</strong>, please check your <strong>spam or junk folder</strong> and mark it as "Not Spam".
      </p>
    </td>
  </tr>
`

// Injects the spam note before the closing </table> of the outer table
function injectSpamNote(html: string): string {
  // Insert before the last </table>
  const lastClose = html.lastIndexOf('</table>')
  if (lastClose === -1) return html
  return html.slice(0, lastClose) + SPAM_NOTE + html.slice(lastClose)
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  const enrichedHtml = injectSpamNote(html)
  const mailOptions = {
    from: from || process.env.SMTP_FROM || 'DriveDrop <infos@drivedrop.us.com>',
    to,
    subject,
    html: enrichedHtml,
  }

  // Try primary first, then secondary (same provider, different port), then tertiary (different provider)
  try {
    const info = await primaryTransporter.sendMail(mailOptions)
    console.log('✅ Email sent (primary):', { messageId: info.messageId, to, subject })
    return info
  } catch (primaryError) {
    console.warn('⚠️ Primary SMTP failed, trying secondary (port 465):', primaryError)
    try {
      const info = await secondaryTransporter.sendMail(mailOptions)
      console.log('✅ Email sent (secondary):', { messageId: info.messageId, to, subject })
      return info
    } catch (secondaryError) {
      console.warn('⚠️ Secondary SMTP failed:', secondaryError)

      // Try tertiary (independent provider) if configured
      if (tertiaryTransporter) {
        console.warn('⚠️ Trying tertiary SMTP provider...')
        try {
          // Use the secondary provider's FROM address if configured, otherwise fall back
          const tertiaryMailOptions = {
            ...mailOptions,
            from: process.env.SMTP2_FROM || mailOptions.from,
          }
          const info = await tertiaryTransporter.sendMail(tertiaryMailOptions)
          console.log('✅ Email sent (tertiary):', { messageId: info.messageId, to, subject })
          return info
        } catch (tertiaryError) {
          console.error('❌ All three SMTP transports failed.', {
            primary: primaryError,
            secondary: secondaryError,
            tertiary: tertiaryError,
          })
          // Alert monitoring address
          const alertEmail = process.env.SMTP_ALERT_EMAIL || 'infos@calkons.com'
          if (to !== alertEmail) {
            // Best-effort alert via whichever transport is reachable
            for (const t of [primaryTransporter, secondaryTransporter, ...(tertiaryTransporter ? [tertiaryTransporter] : [])]) {
              try {
                await t.sendMail({
                  from: mailOptions.from,
                  to: alertEmail,
                  subject: `[EMAIL FAILURE] Failed to send: "${subject}" to ${to}`,
                  html: `<p>All three SMTP transports failed for <strong>${to}</strong> — subject: <strong>${subject}</strong>.</p><p>Check Brevo and secondary provider configuration immediately.</p>`,
                })
                break // stop after first successful alert
              } catch { /* try next */ }
            }
          }
          throw tertiaryError
        }
      }

      // No tertiary configured — alert and throw
      console.error('❌ Both Brevo transports failed. No tertiary provider configured.', {
        primary: primaryError,
        secondary: secondaryError,
      })
      const alertEmail = process.env.SMTP_ALERT_EMAIL || 'infos@calkons.com'
      if (to !== alertEmail) {
        try {
          await secondaryTransporter.sendMail({
            from: mailOptions.from,
            to: alertEmail,
            subject: `[EMAIL FAILURE] Failed to send: "${subject}" to ${to}`,
            html: `<p>Email delivery failed for <strong>${to}</strong> with subject <strong>${subject}</strong>.</p><p>Please investigate SMTP configuration. No tertiary provider is configured (set SMTP2_HOST/SMTP2_USER/SMTP2_PASS to add one).</p>`,
          })
        } catch { /* alert also failed */ }
      }
      throw secondaryError
    }
  }
}

