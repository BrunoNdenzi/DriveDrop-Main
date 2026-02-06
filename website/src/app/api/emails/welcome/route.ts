import { NextRequest, NextResponse } from 'next/server'

/**
 * Send welcome email via Brevo
 * POST /api/emails/welcome
 */
export async function POST(request: NextRequest) {
  try {
    const { email, firstName, lastName, role } = await request.json()

    if (!email || !firstName || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, role' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['client', 'driver', 'broker']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: client, driver, or broker' },
        { status: 400 }
      )
    }

    // Call backend Brevo service
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    
    const response = await fetch(`${backendUrl}/api/v1/emails/send-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add API key if backend requires authentication
        ...(process.env.BACKEND_API_KEY && {
          'Authorization': `Bearer ${process.env.BACKEND_API_KEY}`
        })
      },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        role
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to send email' }))
      console.error('Backend email error:', errorData)
      
      // Don't fail the signup even if email fails
      return NextResponse.json({
        success: false,
        message: 'Email service temporarily unavailable',
        error: errorData.error
      }, { status: 200 }) // Return 200 so signup doesn't fail
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
      data
    })

  } catch (error: any) {
    console.error('Error sending welcome email:', error)
    
    // Don't fail the signup - return success even if email fails
    return NextResponse.json({
      success:false,
      message: 'Email service error',
      error: error.message
    }, { status: 200 })
  }
}
