import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

export async function POST(request: NextRequest) {
  try {
    const { amount, ref, service } = await request.json()

    if (!amount || typeof amount !== 'number' || amount < 50) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    if (!ref || !service) {
      return NextResponse.json({ error: 'Missing ref or service' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,               // in cents
      currency: 'usd',
      capture_method: 'automatic',
      metadata: { ref, service },
      description: `DriveDrop Services — ${service} (ref: ${ref})`,
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    console.error('[payment-intent]', err)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 })
  }
}
