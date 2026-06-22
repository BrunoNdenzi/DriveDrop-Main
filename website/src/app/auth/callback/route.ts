import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (code) {
    // Determine where to redirect after exchanging the code
    const redirectUrl =
      type === 'recovery'
        ? new URL('/reset-password', request.url)
        : new URL(`/auth/confirm?next=${next}`, request.url)

    const response = NextResponse.redirect(redirectUrl)

    // Exchange the PKCE code for a session server-side
    // This sets auth cookies on the response so the next page has a valid session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }

    console.error('[Auth Callback] Code exchange failed:', error.message)
  }

  // No code or exchange failed — send to forgot-password with a hint
  return NextResponse.redirect(new URL('/forgot-password?error=link-expired', request.url))
}
