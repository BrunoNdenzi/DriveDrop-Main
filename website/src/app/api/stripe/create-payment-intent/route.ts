import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Validate Stripe secret key
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[Payment Intent] STRIPE_SECRET_KEY is not configured!')
      return NextResponse.json(
        { error: 'Payment system not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    
    const { amount, totalAmount, metadata, customerEmail, customerName } = await request.json()
    
    console.log('[Payment Intent] Creating payment intent:', {
      amount,
      totalAmount,
      customerEmail,
      metadata: metadata?.vehicle,
    })

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

    console.log('[Payment Intent] Successfully created:', {
      paymentIntentId: paymentIntent.id,
      totalAmount,
      upfrontAmount: amount,
      status: paymentIntent.status,
    })

    // Create payment record in database (without shipment_id initially)
    // The shipment_id will be added later when shipment is created
    try {
      const { error: dbError } = await supabase
        .from('payments')
        .insert({
          client_id: metadata.userId,
          amount: totalAmount,
          initial_amount: amount,
          remaining_amount: remainingAmount,
          payment_intent_id: paymentIntent.id,
          status: 'pending',
          payment_method: 'card',
          booking_timestamp: new Date().toISOString(),
          refund_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          metadata: {
            ...metadata,
            upfront_percentage: 20,
            delivery_percentage: 80,
          }
        })

      if (dbError) {
        console.error('[Payment Intent] Failed to create payment record:', dbError)
        // Don't fail the payment intent - record can be created later
      } else {
        console.log('[Payment Intent] Payment record created successfully')
      }
    } catch (dbError) {
      console.error('[Payment Intent] Database error:', dbError)
      // Continue - don't fail payment intent creation
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totalAmount: totalAmount,
      upfrontAmount: amount,
      remainingAmount: remainingAmount,
    })
  } catch (error: any) {
    console.error('[Payment Intent] Error creating payment intent:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    })
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create payment intent',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
