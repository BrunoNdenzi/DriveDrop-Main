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
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contact Form Submission</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
              <tr>
                <td style="padding: 40px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                          DriveDrop
                        </h1>
                        <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
                          New Contact Form Submission
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px; color: #333333; font-size: 20px;">
                          Contact Details
                        </h2>
                        
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                          <tr>
                            <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 10px;">
                              <strong style="color: #667eea;">Name:</strong>
                              <p style="margin: 5px 0 0; color: #333333;">${name}</p>
                            </td>
                          </tr>
                          <tr><td style="height: 10px;"></td></tr>
                          <tr>
                            <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 10px;">
                              <strong style="color: #667eea;">Email:</strong>
                              <p style="margin: 5px 0 0; color: #333333;">
                                <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a>
                              </p>
                            </td>
                          </tr>
                          ${phone ? `
                            <tr><td style="height: 10px;"></td></tr>
                            <tr>
                              <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px; margin-bottom: 10px;">
                                <strong style="color: #667eea;">Phone:</strong>
                                <p style="margin: 5px 0 0; color: #333333;">
                                  <a href="tel:${phone}" style="color: #667eea; text-decoration: none;">${phone}</a>
                                </p>
                              </td>
                            </tr>
                          ` : ''}
                          <tr><td style="height: 10px;"></td></tr>
                          <tr>
                            <td style="padding: 12px; background-color: #f8f9fa; border-radius: 4px;">
                              <strong style="color: #667eea;">Subject:</strong>
                              <p style="margin: 5px 0 0; color: #333333;">${subject}</p>
                            </td>
                          </tr>
                        </table>
                        
                        <h2 style="margin: 0 0 15px; color: #333333; font-size: 20px;">
                          Message
                        </h2>
                        
                        <div style="padding: 20px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                          <p style="margin: 0; color: #333333; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                        <p style="margin: 0; color: #666666; font-size: 14px;">
                          This email was sent from the DriveDrop contact form
                        </p>
                        <p style="margin: 10px 0 0; color: #999999; font-size: 12px;">
                          Received on ${new Date().toLocaleString('en-US', { 
                            dateStyle: 'long', 
                            timeStyle: 'short' 
                          })}
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
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thank You</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
              <tr>
                <td style="padding: 40px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                          DriveDrop
                        </h1>
                        <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">
                          Thank You for Contacting Us
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px;">
                          Hi ${name},
                        </h2>
                        
                        <p style="margin: 0 0 15px; color: #666666; line-height: 1.6; font-size: 16px;">
                          Thank you for reaching out to DriveDrop! We've received your message and our team will get back to you within 24 hours.
                        </p>
                        
                        <p style="margin: 0 0 25px; color: #666666; line-height: 1.6; font-size: 16px;">
                          In the meantime, if you have any urgent questions, feel free to call us at <a href="tel:+17042662317" style="color: #667eea; text-decoration: none;">+1-704-266-2317</a>.
                        </p>
                        
                        <div style="padding: 20px; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                          <h3 style="margin: 0 0 10px; color: #667eea; font-size: 16px;">
                            Your Submission Summary:
                          </h3>
                          <p style="margin: 0 0 8px; color: #333333;">
                            <strong>Subject:</strong> ${subject}
                          </p>
                          <p style="margin: 0; color: #666666; font-size: 14px;">
                            <strong>Message:</strong><br>
                            ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}
                          </p>
                        </div>
                        
                        <p style="margin: 0; color: #666666; line-height: 1.6; font-size: 16px;">
                          Best regards,<br>
                          <strong style="color: #333333;">The DriveDrop Team</strong>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                        <p style="margin: 0 0 10px; color: #666666; font-size: 14px;">
                          <strong>Contact Us</strong>
                        </p>
                        <p style="margin: 0 0 5px; color: #999999; font-size: 14px;">
                          Email: <a href="mailto:infos@drivedrop.us.com" style="color: #667eea; text-decoration: none;">infos@drivedrop.us.com</a>
                        </p>
                        <p style="margin: 0; color: #999999; font-size: 14px;">
                          Phone: <a href="tel:+17042662317" style="color: #667eea; text-decoration: none;">+1-704-266-2317</a>
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
