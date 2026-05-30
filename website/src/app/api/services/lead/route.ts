import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

const BUSINESS_EMAIL = 'infos@drivedrop.us.com'
const BUSINESS_PHONE = '+17042662317'

const serviceLabels: Record<string, string> = {
  tiles: '🟨 Tile Supply & Delivery',
  'tree-removal': '🌳 Tree Removal',
  delivery: '📦 Local Van Delivery',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { service, name, email, phone, message, extras } = body

    if (!service || !name || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceLabel = serviceLabels[service] || service
    const submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    })

    // Build extras section if present
    let extrasHtml = ''
    if (extras && Object.keys(extras).length > 0) {
      extrasHtml = `
        <div style="margin-top:16px;">
          <table style="width:100%;border-collapse:collapse;">
            ${Object.entries(extras).map(([key, val]) => `
              <tr>
                <td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%;text-transform:capitalize;">
                  ${key.replace(/_/g, ' ')}
                </td>
                <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111827;">${val}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
          <tr><td>
            <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background:#030712;padding:28px 36px;">
                  <p style="margin:0 0 4px;color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">New Service Lead</p>
                  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">${serviceLabel}</h1>
                  <p style="margin:6px 0 0;color:#9ca3af;font-size:12px;">${submittedAt} · EST</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:32px 36px;">
                  
                  <!-- Contact info -->
                  <div style="background:#f9fafb;border-left:3px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;">Contact</p>
                    <table style="width:100%;">
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:13px;width:40%;">Name</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:700;color:#111827;">${name}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:13px;">Phone</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:700;color:#111827;">
                          <a href="tel:${phone}" style="color:#3b82f6;text-decoration:none;">${phone}</a>
                        </td>
                      </tr>
                      ${email ? `
                      <tr>
                        <td style="padding:4px 0;color:#6b7280;font-size:13px;">Email</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:700;color:#111827;">
                          <a href="mailto:${email}" style="color:#3b82f6;text-decoration:none;">${email}</a>
                        </td>
                      </tr>` : ''}
                    </table>
                  </div>

                  <!-- Service details / extras -->
                  ${extrasHtml ? `
                  <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;">Details</p>
                    ${extrasHtml}
                  </div>` : ''}

                  <!-- Message -->
                  ${message ? `
                  <div style="background:#f0f9ff;border-left:3px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;">Message</p>
                    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${message}</p>
                  </div>` : ''}

                  <!-- CTA -->
                  <div style="text-align:center;margin:28px 0 0;">
                    <a href="tel:${BUSINESS_PHONE}" 
                       style="display:inline-block;background:#f59e0b;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
                      📞 Call ${name} Back
                    </a>
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 36px;text-align:center;">
                  <p style="margin:0;color:#9ca3af;font-size:11px;">Lead from drivedrop.us.com/services · DriveDrop Charlotte, NC</p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `

    await sendEmail({
      to: BUSINESS_EMAIL,
      subject: `🔔 New Lead: ${serviceLabel} — ${name}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Service lead email error:', error)
    return NextResponse.json({ error: 'Failed to send lead' }, { status: 500 })
  }
}
