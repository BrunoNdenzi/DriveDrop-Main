import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { pricingService } from '@/services/pricingService'

export async function POST(request: NextRequest) {
  try {
    const { name, email, pickupLocation, deliveryLocation, vehicleType, pickupCoords, deliveryCoords } = await request.json()

    if (!name || !email || !pickupLocation || !deliveryLocation || !vehicleType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Calculate quote if coordinates provided
    let quoteTotal: number | null = null
    let distanceMiles: number | null = null

    if (pickupCoords && deliveryCoords) {
      try {
        const distance = pricingService.calculateDistance(
          pickupCoords.lat, pickupCoords.lng,
          deliveryCoords.lat, deliveryCoords.lng
        )
        distanceMiles = Math.round(distance)
        const result = pricingService.calculateQuote({
          vehicleType,
          distanceMiles,
          isAccidentRecovery: false,
          vehicleCount: 1,
          fuelPricePerGallon: 3.70,
        })
        quoteTotal = result.total
      } catch {
        // Quote calculation failed — still send the email without a price
      }
    }

    const firstName = name.split(' ')[0] || name

    // Email to the customer
    await sendEmail({
      to: email,
      subject: 'Your DriveDrop Vehicle Shipping Quote',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
            <tr><td style="padding:40px 20px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color:#030712;padding:32px 40px;text-align:center;">
                    <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;">Drive<span style="color:#3b82f6;">Drop</span></h1>
                    <p style="margin:0;color:#6b7280;font-size:13px;">Your Vehicle Shipping Quote</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                    <p style="margin:0 0 16px;">Hi ${firstName},</p>
                    <p style="margin:0 0 24px;">Thank you for requesting a quote. Here are your shipment details:</p>
                    
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                      <tr style="background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
                        <td style="padding:12px 16px;font-weight:600;color:#374151;font-size:14px;">Pickup</td>
                        <td style="padding:12px 16px;color:#111827;font-size:14px;">${pickupLocation}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e5e7eb;">
                        <td style="padding:12px 16px;font-weight:600;color:#374151;font-size:14px;">Delivery</td>
                        <td style="padding:12px 16px;color:#111827;font-size:14px;">${deliveryLocation}</td>
                      </tr>
                      <tr style="background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
                        <td style="padding:12px 16px;font-weight:600;color:#374151;font-size:14px;">Vehicle Type</td>
                        <td style="padding:12px 16px;color:#111827;font-size:14px;text-transform:capitalize;">${vehicleType}</td>
                      </tr>
                      ${distanceMiles ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:12px 16px;font-weight:600;color:#374151;font-size:14px;">Distance</td><td style="padding:12px 16px;color:#111827;font-size:14px;">${distanceMiles} miles</td></tr>` : ''}
                      ${quoteTotal ? `<tr style="background-color:#eff6ff;"><td style="padding:16px;font-weight:700;color:#1d4ed8;font-size:16px;">Estimated Price</td><td style="padding:16px;font-weight:700;color:#1d4ed8;font-size:18px;">$${quoteTotal.toFixed(2)}</td></tr>` : ''}
                    </table>

                    ${quoteTotal ? `
                    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;">
                      <p style="margin:0 0 8px;font-weight:600;color:#1e40af;">Payment Terms:</p>
                      <p style="margin:0 0 4px;color:#1e3a8a;font-size:14px;">• 20% upfront at booking: <strong>$${(quoteTotal * 0.2).toFixed(2)}</strong></p>
                      <p style="margin:0;color:#1e3a8a;font-size:14px;">• 80% on delivery: <strong>$${(quoteTotal * 0.8).toFixed(2)}</strong></p>
                    </div>
                    ` : `
                    <div style="background-color:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin-bottom:24px;">
                      <p style="margin:0;color:#713f12;font-size:14px;">We couldn't calculate an exact quote for this route. Our team will reach out within 2 hours with a personalized price.</p>
                    </div>
                    `}

                    <p style="margin:0 0 24px;color:#374151;">Please check your spam folder if you don't see our follow-up emails. Ready to book?</p>

                    <div style="text-align:center;margin-bottom:24px;">
                      <a href="https://www.drivedrop.us.com/signup?role=client" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:14px 36px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Create Account & Book Now</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                    <p style="margin:0;">Questions? Email us at <a href="mailto:infos@drivedrop.us.com" style="color:#3b82f6;">infos@drivedrop.us.com</a></p>
                    <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    // Notification to admin
    await sendEmail({
      to: 'infos@drivedrop.us.com',
      subject: `New Quote Request — ${name}`,
      html: `
        <p><strong>New quote request received.</strong></p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>From:</strong> ${pickupLocation}</li>
          <li><strong>To:</strong> ${deliveryLocation}</li>
          <li><strong>Vehicle:</strong> ${vehicleType}</li>
          ${distanceMiles ? `<li><strong>Distance:</strong> ${distanceMiles} miles</li>` : ''}
          ${quoteTotal ? `<li><strong>Quoted Price:</strong> $${quoteTotal.toFixed(2)}</li>` : '<li><strong>Price:</strong> Could not calculate — follow up needed</li>'}
        </ul>
      `,
    }).catch(() => { /* non-blocking */ })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Quote send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send quote' }, { status: 500 })
  }
}
