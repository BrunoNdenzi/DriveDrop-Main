import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

export async function POST(request: NextRequest) {
  try {
    const { phone, code, userId } = await request.json()
    const res = await fetch(`${BACKEND_URL}/auth/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, userId }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
