import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Capture the remaining payment (80%) on delivery completion
 * This is called when the driver marks the shipment as delivered
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, shipmentId, driverId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'Shipment ID is required' },
        { status: 400 }
      )
    }

    // Verify the shipment is ready for final payment
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status, driver_id, payment_status')
      .eq('id', shipmentId)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      )
    }

    // Verify driver is authorized
    if (shipment.driver_id !== driverId) {
      return NextResponse.json(
        { error: 'Unauthorized. You are not assigned to this shipment.' },
        { status: 403 }
      )
    }

    // Verify shipment is delivered
    if (shipment.status !== 'delivered') {
      return NextResponse.json(
        { error: 'Shipment must be marked as delivered before capturing final payment' },
        { status: 400 }
      )
    }

    // Check if final payment was already captured
    if (shipment.payment_status === 'fully_paid') {
      return NextResponse.json(
        { error: 'Final payment has already been captured' },
        { status: 400 }
      )
    }

    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'requires_capture') {
      return NextResponse.json(
        { 
          error: `Cannot capture remaining payment. Current status: ${paymentIntent.status}`,
          status: paymentIntent.status,
          details: 'The payment may have already been fully captured or cancelled.'
        },
        { status: 400 }
      )
    }

    const captureStatus = paymentIntent.metadata.captureStatus

    if (captureStatus !== 'upfront_captured') {
      return NextResponse.json(
        { error: 'Upfront payment must be captured first' },
        { status: 400 }
      )
    }

    const remainingAmount = parseInt(paymentIntent.metadata.remainingAmount || '0')

    if (remainingAmount < 50) {
      return NextResponse.json(
        { error: 'Invalid remaining amount' },
        { status: 400 }
      )
    }

    // STEP 3: Capture the remaining amount (80%)
    // This completes the payment process
    const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: remainingAmount,
    })

    // Update metadata to track final capture
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        captureStatus: 'fully_captured',
        finalCapturedAt: new Date().toISOString(),
        capturedByDriver: driverId,
      },
    })

    // Update shipment payment status in database
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        payment_status: 'fully_paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)

    if (updateError) {
      console.error('Failed to update shipment payment status:', updateError)
      // Don't fail the request - payment was captured successfully
    }

    // Update payment record in database
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('shipment_id', shipmentId)
      .eq('payment_type', 'final')

    if (paymentUpdateError) {
      console.error('Failed to update payment record:', paymentUpdateError)
    }

    console.log('✅ Final payment captured:', {
      paymentIntentId,
      shipmentId,
      remainingAmount,
      totalCaptured: paymentIntent.amount,
    })

    return NextResponse.json({
      success: true,
      paymentIntentId: capturedIntent.id,
      capturedAmount: remainingAmount,
      totalAmount: paymentIntent.amount,
      status: capturedIntent.status,
      message: 'Final payment successfully captured',
    })
  } catch (error: any) {
    console.error('❌ Error capturing final payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to capture final payment' },
      { status: 500 }
    )
  }
}
