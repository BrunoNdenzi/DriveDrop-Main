import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * This route handles password reset links from Supabase emails
 * It redirects to the reset-password page with the code parameter
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')

  // If we have a code or token, redirect to the reset password page
  if (code || token) {
    const resetUrl = new URL('/reset-password', request.url)
    if (code) resetUrl.searchParams.set('code', code)
    if (token) resetUrl.searchParams.set('token', token)
    if (type) resetUrl.searchParams.set('type', type)
    
    return NextResponse.redirect(resetUrl)
  }

  // If no code/token provided, redirect to forgot password page
  return NextResponse.redirect(new URL('/forgot-password', request.url))
}
