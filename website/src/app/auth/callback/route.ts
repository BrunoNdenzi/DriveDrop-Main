import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    // Check if this is a password recovery flow
    if (type === 'recovery' || requestUrl.searchParams.get('recovery') === 'true') {
      // Redirect to reset password page with the code
      return NextResponse.redirect(new URL(`/reset-password?code=${code}`, request.url))
    }
    
    // For email confirmation, redirect to confirm page
    return NextResponse.redirect(new URL(`/auth/confirm?code=${code}&next=${next}`, request.url))
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url))
}
