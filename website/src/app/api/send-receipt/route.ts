import { NextResponse } from 'next/server'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { shipmentId, clientEmail } = await request.json()

    if (!shipmentId || !clientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseBrowserClient()

    // Fetch shipment details
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select(`
        *,
        client:profiles!shipments_client_id_fkey (
          first_name,
          last_name,
          phone,
          email
        ),
        driver:profiles!shipments_driver_id_fkey (
          first_name,
          last_name,
          phone
        )
      `)
      .eq('id', shipmentId)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      )
    }

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('shipment_id', shipmentId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Generate receipt HTML
    const receiptHTML = generateReceiptHTML(shipment, payment)

    // Send email
    await sendEmail({
      to: clientEmail,
      subject: `DriveDrop Receipt - ${shipment.title}`,
      html: receiptHTML,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending receipt:', error)
    return NextResponse.json(
      { error: 'Failed to send receipt' },
      { status: 500 }
    )
  }
}

function generateReceiptHTML(shipment: any, payment: any): string {
  const row = (label: string, value: string, mono = false) =>
    `<tr>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;width:40%;"><strong>${label}</strong></td>
      <td style="padding:10px 0;color:#111827;font-size:14px;border-bottom:1px solid #f3f4f6;text-align:right;${mono ? 'font-family:monospace;' : ''}">${value}</td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DriveDrop Receipt</title>
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
              <p style="margin:0;color:#6b7280;font-size:13px;">Vehicle Shipping Receipt</p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
                Receipt #${payment.id.substring(0, 8).toUpperCase()} &middot; ${new Date(payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">

              <!-- Customer -->
              <h2 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:8px;">Customer Information</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${row('Name', `${shipment.client.first_name} ${shipment.client.last_name}`)}
                ${row('Email', shipment.client.email)}
                ${row('Phone', shipment.client.phone)}
              </table>

              <!-- Vehicle -->
              <h2 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:8px;">Vehicle Information</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${row('Vehicle', `${shipment.vehicle_year} ${shipment.vehicle_make} ${shipment.vehicle_model}`)}
                ${row('Color', shipment.vehicle_color)}
                ${row('VIN', shipment.vehicle_vin, true)}
                ${row('Condition', shipment.is_operable ? 'Operable' : 'Inoperable')}
                ${row('Type', shipment.vehicle_type)}
              </table>

              <!-- Shipment -->
              <h2 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:8px;">Shipment Details</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${row('Shipment ID', shipment.id.substring(0, 8).toUpperCase(), true)}
                ${row('Status', `<span style="display:inline-block;background-color:#22c55e;color:#ffffff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">${shipment.status.replace(/_/g, ' ').toUpperCase()}</span>`)}
                ${row('Pickup', `${shipment.pickup_address}<br>${shipment.pickup_city}, ${shipment.pickup_state} ${shipment.pickup_zip}`)}
                ${row('Delivery', `${shipment.delivery_address}<br>${shipment.delivery_city}, ${shipment.delivery_state} ${shipment.delivery_zip}`)}
                ${row('Distance', `${shipment.distance} miles`)}
                ${row('Pickup Date', new Date(shipment.pickup_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}
                ${shipment.actual_pickup_time ? row('Actual Pickup', new Date(shipment.actual_pickup_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}
                ${shipment.delivery_date ? row('Expected Delivery', new Date(shipment.delivery_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })) : ''}
                ${shipment.actual_delivery_time ? row('Actual Delivery', new Date(shipment.actual_delivery_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })) : ''}
                ${shipment.driver ? row('Driver', `${shipment.driver.first_name} ${shipment.driver.last_name}<br>${shipment.driver.phone}`) : ''}
              </table>

              <!-- Payment -->
              <h2 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:8px;">Payment Summary</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                ${row('Base Price', `$${shipment.estimated_price.toFixed(2)}`)}
                ${shipment.total_price !== shipment.estimated_price ? row('Adjustments', `$${(shipment.total_price - shipment.estimated_price).toFixed(2)}`) : ''}
              </table>

              <!-- Total box -->
              <div style="background-color:#030712;padding:20px;border-radius:8px;text-align:center;margin:0 0 20px;">
                <p style="margin:0 0 4px;color:#9ca3af;font-size:13px;">Total Amount Paid</p>
                <p style="margin:0;color:#ffffff;font-size:32px;font-weight:700;">$${shipment.total_price.toFixed(2)}</p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                ${row('Payment Method', payment.payment_method)}
                ${row('Payment Status', `<span style="display:inline-block;background-color:#22c55e;color:#ffffff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">${payment.payment_status.toUpperCase()}</span>`)}
                ${row('Transaction ID', payment.stripe_payment_intent_id || 'N/A', true)}
                ${row('Payment Date', new Date(payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}
              </table>

              ${shipment.special_instructions ? `
              <div style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:16px 20px;margin:0 0 20px;border-radius:0 6px 6px 0;font-size:14px;">
                <strong style="color:#92400e;">Special Instructions:</strong>
                <p style="margin:6px 0 0;color:#92400e;">${shipment.special_instructions}</p>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
              <p style="margin:0;"><strong>Thank you for choosing DriveDrop!</strong></p>
              <p style="margin:8px 0 0;">
                <a href="https://drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">drivedrop.us.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a>
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
                Receipt ID: ${payment.id}<br>
                &copy; ${new Date().getFullYear()} DriveDrop Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
