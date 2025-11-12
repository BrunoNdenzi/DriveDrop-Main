import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    // Code exchange will be handled by Supabase on the client side
    // This is just a redirect to a page where the client can handle the session
    return NextResponse.redirect(new URL(`/auth/confirm?code=${code}&next=${next}`, request.url))
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url))
}
