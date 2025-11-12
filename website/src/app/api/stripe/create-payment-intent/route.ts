import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
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

    // Create payment intent for 20% upfront with enhanced payment methods
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      description: `DriveDrop Shipment - ${metadata.vehicle}`,
      metadata: {
        ...metadata,
        totalAmount: totalAmount.toString(),
        upfrontPercentage: '20',
        remainingPercentage: '80',
        remainingAmount: (totalAmount - amount).toString(),
        customerEmail: customerEmail || '',
        customerName: customerName || '',
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'always', // Enable bank redirects and other methods
      },
      // Add receipt email if provided
      ...(customerEmail && { receipt_email: customerEmail }),
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('Stripe payment intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
