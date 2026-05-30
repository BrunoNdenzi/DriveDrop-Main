import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { service, name, phone } = body

    if (!service || !name || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const response = await fetch(`${BACKEND_URL}/emails/send-service-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Backend service lead error:', err)
      return NextResponse.json({ error: 'Failed to send lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Service lead route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
