import { NextResponse } from 'next/server'

export async function GET() {
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY
  const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 7) || 'NOT_SET'
  
  return NextResponse.json({
    status: 'ok',
    stripe_key_configured: hasStripeKey,
    stripe_key_prefix: keyPrefix,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}
