import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app'

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, email, name, ref, service, amount } = await request.json()

    if (!paymentIntentId || !email || !name || !ref || !service || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Non-fatal: send confirmation email via Railway backend
    try {
      await fetch(`${BACKEND_URL}/emails/send-service-payment-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          customerName: name,
          serviceName: service,
          bookingRef: ref,
          amount,
        }),
      })
    } catch (emailErr) {
      console.warn('[payment-confirm] email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[payment-confirm]', err)
    return NextResponse.json({ error: 'Failed to process confirmation' }, { status: 500 })
  }
}
