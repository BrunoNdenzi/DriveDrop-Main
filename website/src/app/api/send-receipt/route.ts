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
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 40px 20px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
      font-weight: 700;
    }
    .header p {
      margin: 5px 0;
      opacity: 0.9;
    }
    .content {
      padding: 40px;
    }
    .section {
      margin-bottom: 30px;
      padding-bottom: 30px;
      border-bottom: 1px solid #e5e5e5;
    }
    .section:last-child {
      border-bottom: none;
      padding-bottom: 0;
      margin-bottom: 0;
    }
    .section h2 {
      color: #667eea;
      font-size: 1.3em;
      margin: 0 0 20px 0;
      font-weight: 600;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f5f5f5;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      text-align: right;
      color: #333;
    }
    .total-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    .total-box .label {
      font-size: 0.9em;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .total-box .amount {
      font-size: 2.5em;
      font-weight: 700;
      margin: 0;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      background-color: #10B981;
      color: white;
    }
    .footer {
      text-align: center;
      padding: 30px 40px;
      background-color: #f9f9f9;
      color: #666;
      font-size: 0.9em;
    }
    .footer p {
      margin: 5px 0;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    @media print {
      body {
        background-color: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 DriveDrop</h1>
      <p>Vehicle Shipping Receipt</p>
      <p><strong>Receipt #:</strong> ${payment.id.substring(0, 8).toUpperCase()}</p>
      <p><strong>Date:</strong> ${new Date(payment.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
    </div>

    <div class="content">
      <div class="section">
        <h2>Customer Information</h2>
        <div class="detail-row">
          <span class="detail-label">Name:</span>
          <span class="detail-value">${shipment.client.first_name} ${shipment.client.last_name}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${shipment.client.email}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone:</span>
          <span class="detail-value">${shipment.client.phone}</span>
        </div>
      </div>

      <div class="section">
        <h2>Vehicle Information</h2>
        <div class="detail-row">
          <span class="detail-label">Vehicle:</span>
          <span class="detail-value">${shipment.vehicle_year} ${shipment.vehicle_make} ${shipment.vehicle_model}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Color:</span>
          <span class="detail-value">${shipment.vehicle_color}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">VIN:</span>
          <span class="detail-value" style="font-family: monospace;">${shipment.vehicle_vin}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Condition:</span>
          <span class="detail-value">${shipment.is_operable ? 'Operable' : 'Inoperable'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Type:</span>
          <span class="detail-value" style="text-transform: capitalize;">${shipment.vehicle_type}</span>
        </div>
      </div>

      <div class="section">
        <h2>Shipment Details</h2>
        <div class="detail-row">
          <span class="detail-label">Shipment ID:</span>
          <span class="detail-value" style="font-family: monospace;">${shipment.id.substring(0, 8).toUpperCase()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value"><span class="status-badge">${shipment.status.replace(/_/g, ' ').toUpperCase()}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pickup Location:</span>
          <span class="detail-value">${shipment.pickup_address}<br>${shipment.pickup_city}, ${shipment.pickup_state} ${shipment.pickup_zip}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Delivery Location:</span>
          <span class="detail-value">${shipment.delivery_address}<br>${shipment.delivery_city}, ${shipment.delivery_state} ${shipment.delivery_zip}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Distance:</span>
          <span class="detail-value">${shipment.distance} miles</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Pickup Date:</span>
          <span class="detail-value">${new Date(shipment.pickup_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        ${shipment.actual_pickup_time ? `
        <div class="detail-row">
          <span class="detail-label">Actual Pickup:</span>
          <span class="detail-value">${new Date(shipment.actual_pickup_time).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
        ` : ''}
        ${shipment.delivery_date ? `
        <div class="detail-row">
          <span class="detail-label">Expected Delivery:</span>
          <span class="detail-value">${new Date(shipment.delivery_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        ` : ''}
        ${shipment.actual_delivery_time ? `
        <div class="detail-row">
          <span class="detail-label">Actual Delivery:</span>
          <span class="detail-value">${new Date(shipment.actual_delivery_time).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
        ` : ''}
        ${shipment.driver ? `
        <div class="detail-row">
          <span class="detail-label">Driver:</span>
          <span class="detail-value">${shipment.driver.first_name} ${shipment.driver.last_name}<br>${shipment.driver.phone}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h2>Payment Summary</h2>
        <div class="detail-row">
          <span class="detail-label">Base Price:</span>
          <span class="detail-value">$${shipment.estimated_price.toFixed(2)}</span>
        </div>
        ${shipment.total_price !== shipment.estimated_price ? `
        <div class="detail-row">
          <span class="detail-label">Adjustments:</span>
          <span class="detail-value">$${(shipment.total_price - shipment.estimated_price).toFixed(2)}</span>
        </div>
        ` : ''}
        
        <div class="total-box">
          <div class="label">Total Amount Paid</div>
          <div class="amount">$${shipment.total_price.toFixed(2)}</div>
        </div>

        <div class="detail-row">
          <span class="detail-label">Payment Method:</span>
          <span class="detail-value" style="text-transform: capitalize;">${payment.payment_method}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Status:</span>
          <span class="detail-value"><span class="status-badge">${payment.payment_status.toUpperCase()}</span></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction ID:</span>
          <span class="detail-value" style="font-family: monospace; font-size: 0.85em;">${payment.stripe_payment_intent_id || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Payment Date:</span>
          <span class="detail-value">${new Date(payment.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
      </div>

      ${shipment.special_instructions ? `
      <div class="section">
        <h2>Special Instructions</h2>
        <div style="padding: 15px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
          <p style="margin: 0; color: #92400E;">${shipment.special_instructions}</p>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p><strong>Thank you for choosing DriveDrop!</strong></p>
      <p>Your trusted vehicle shipping partner</p>
      <p style="margin-top: 20px;">
        For questions or support, please contact us at:<br>
        <a href="mailto:support@drivedrop.com">support@drivedrop.com</a><br>
        <a href="tel:+1-800-DRIVE-DROP">1-800-DRIVE-DROP</a>
      </p>
      <p style="margin-top: 20px; font-size: 0.8em; color: #999;">
        This receipt was generated automatically on ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}<br>
        Receipt ID: ${payment.id}
      </p>
    </div>
  </div>
</body>
</html>
  `
}
