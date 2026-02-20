import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { name, email, phone, subject, message } = await request.json()

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'Name, email, subject, and message are required.' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email', message: 'Please provide a valid email address.' },
        { status: 400 }
      )
    }

    // Send email to infos@drivedrop.us.com
    await sendEmail({
      to: 'infos@drivedrop.us.com',
      subject: `Contact Form: ${subject}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contact Form Submission</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
            <tr>
              <td style="padding:40px 20px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color:#030712;padding:32px 40px;text-align:center;">
                      <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                        Drive<span style="color:#3b82f6;">Drop</span>
                      </h1>
                      <p style="margin:0;color:#6b7280;font-size:13px;">New Contact Form Submission</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                      <h2 style="margin:0 0 20px;color:#111827;font-size:18px;">Contact Details</h2>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                        <tr>
                          <td style="padding:12px;background-color:#f9fafb;border-radius:4px;">
                            <strong style="color:#3b82f6;">Name:</strong>
                            <p style="margin:4px 0 0;color:#111827;">${name}</p>
                          </td>
                        </tr>
                        <tr><td style="height:8px;"></td></tr>
                        <tr>
                          <td style="padding:12px;background-color:#f9fafb;border-radius:4px;">
                            <strong style="color:#3b82f6;">Email:</strong>
                            <p style="margin:4px 0 0;color:#111827;">
                              <a href="mailto:${email}" style="color:#3b82f6;text-decoration:none;">${email}</a>
                            </p>
                          </td>
                        </tr>
                        ${phone ? `
                          <tr><td style="height:8px;"></td></tr>
                          <tr>
                            <td style="padding:12px;background-color:#f9fafb;border-radius:4px;">
                              <strong style="color:#3b82f6;">Phone:</strong>
                              <p style="margin:4px 0 0;color:#111827;">
                                <a href="tel:${phone}" style="color:#3b82f6;text-decoration:none;">${phone}</a>
                              </p>
                            </td>
                          </tr>
                        ` : ''}
                        <tr><td style="height:8px;"></td></tr>
                        <tr>
                          <td style="padding:12px;background-color:#f9fafb;border-radius:4px;">
                            <strong style="color:#3b82f6;">Subject:</strong>
                            <p style="margin:4px 0 0;color:#111827;">${subject}</p>
                          </td>
                        </tr>
                      </table>

                      <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Message</h2>

                      <div style="padding:16px 20px;background-color:#f9fafb;border-left:3px solid #3b82f6;border-radius:0 6px 6px 0;">
                        <p style="margin:0;color:#111827;line-height:1.6;white-space:pre-wrap;">${message}</p>
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                      <p style="margin:0;">This email was sent from the DriveDrop contact form</p>
                      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
                        Received on ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })

    // Send auto-reply to the user
    await sendEmail({
      to: email,
      subject: 'Thank you for contacting DriveDrop',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
            <tr>
              <td style="padding:40px 20px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color:#030712;padding:32px 40px;text-align:center;">
                      <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                        Drive<span style="color:#3b82f6;">Drop</span>
                      </h1>
                      <p style="margin:0;color:#6b7280;font-size:13px;">Thank You for Contacting Us</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Hi ${name},</h2>

                      <p>Thank you for reaching out to DriveDrop! We've received your message and our team will get back to you within 24 hours.</p>

                      <p>In the meantime, if you have any urgent questions, feel free to call us at <a href="tel:+17042662317" style="color:#3b82f6;text-decoration:none;">+1-704-266-2317</a>.</p>

                      <div style="background-color:#f9fafb;border-left:3px solid #3b82f6;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
                        <strong>Your Submission Summary:</strong><br>
                        <strong>Subject:</strong> ${subject}<br>
                        <strong>Message:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}
                      </div>

                      <p>Best regards,<br><strong>The DriveDrop Team</strong></p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                      <p style="margin:0;">
                        Email: <a href="mailto:infos@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">infos@drivedrop.us.com</a>
                        &nbsp;&middot;&nbsp;
                        Phone: <a href="tel:+17042662317" style="color:#3b82f6;text-decoration:none;">+1-704-266-2317</a>
                      </p>
                      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} DriveDrop Inc. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    })

    return NextResponse.json(
      { message: 'Message sent successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to send message',
        message: error.message || 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    )
  }
}
