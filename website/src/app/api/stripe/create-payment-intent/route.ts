import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia', // Latest stable API version for stripe@19.3.0
})

export async function POST(request: NextRequest) {
  try {
    const { amount, totalAmount, metadata, customerEmail, customerName } = await request.json()

    if (!amount || amount < 50) {
      return NextResponse.json(
        { error: 'Invalid payment amount. Minimum $0.50 required.' },
        { status: 400 }
      )
    }

    if (!totalAmount || totalAmount < amount) {
      return NextResponse.json(
        { error: 'Invalid total amount.' },
        { status: 400 }
      )
    }

    const remainingAmount = totalAmount - amount

    // STEP 1: Create payment intent for FULL AMOUNT with manual capture
    // This will authorize (hold) the full amount on the customer's card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount, // 🔑 Authorize FULL amount (100%)
      currency: 'usd',
      capture_method: 'manual', // 🔑 Don't auto-capture - we'll capture in steps
      description: `DriveDrop Shipment - ${metadata.vehicle}`,
      metadata: {
        ...metadata,
        totalAmount: totalAmount.toString(),
        upfrontAmount: amount.toString(), // 20% to capture now
        upfrontPercentage: '20',
        remainingAmount: remainingAmount.toString(), // 80% to capture on delivery
        remainingPercentage: '80',
        customerEmail: customerEmail || '',
        customerName: customerName || '',
        captureStatus: 'upfront_pending', // Track capture status
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'always',
      },
      ...(customerEmail && { receipt_email: customerEmail }),
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalAmount: totalAmount,
      upfrontAmount: amount,
      remainingAmount: remainingAmount,
    })
  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
