import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

/**
 * Capture the upfront payment (20%) immediately after authorization
 * This is called after the client confirms payment on the frontend
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, upfrontAmount } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }

    if (!upfrontAmount || upfrontAmount < 50) {
      return NextResponse.json(
        { error: 'Invalid upfront amount' },
        { status: 400 }
      )
    }

    // Retrieve the payment intent to verify it's in the correct state
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'requires_capture') {
      return NextResponse.json(
        { 
          error: `Cannot capture payment. Current status: ${paymentIntent.status}`,
          status: paymentIntent.status
        },
        { status: 400 }
      )
    }

    // STEP 2: Capture only the upfront amount (20%)
    // The remaining 80% stays authorized (held) on the customer's card
    const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: upfrontAmount,
    })

    // Update metadata to track that upfront has been captured
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        captureStatus: 'upfront_captured',
        upfrontCapturedAt: new Date().toISOString(),
      },
    })

    console.log('✅ Upfront payment captured:', {
      paymentIntentId,
      upfrontAmount,
      remainingAmount: paymentIntent.amount - upfrontAmount,
    })

    return NextResponse.json({
      success: true,
      paymentIntentId: capturedIntent.id,
      capturedAmount: upfrontAmount,
      remainingAmount: paymentIntent.amount - upfrontAmount,
      status: capturedIntent.status,
    })
  } catch (error: any) {
    console.error('❌ Error capturing upfront payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to capture upfront payment' },
      { status: 500 }
    )
  }
}
