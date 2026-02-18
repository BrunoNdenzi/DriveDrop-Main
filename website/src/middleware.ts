import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Maintenance Mode ──────────────────────────────────────────────
  // Toggle via env var in Vercel dashboard → redeploy to activate.
  // Admins bypass maintenance by adding ?bypass=admin to any URL once
  // (sets a cookie) so they can still test the site.
  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

  if (maintenanceMode) {
    // Always allow the maintenance page itself and static assets
    const isMaintenancePage = pathname === '/maintenance'
    const isStaticAsset =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.includes('.')

    if (!isMaintenancePage && !isStaticAsset) {
      // Allow admin bypass via ?bypass=admin query param (sets cookie)
      const bypassParam = request.nextUrl.searchParams.get('bypass')
      const bypassCookie = request.cookies.get('maintenance_bypass')?.value

      if (bypassParam === 'admin') {
        const res = NextResponse.redirect(new URL(pathname, request.url))
        res.cookies.set('maintenance_bypass', 'true', {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 4, // 4 hours
        })
        return res
      }

      if (bypassCookie !== 'true') {
        return NextResponse.rewrite(new URL('/maintenance', request.url))
      }
    }
  }

  // If user navigates to /maintenance when NOT in maintenance mode → send home
  if (!maintenanceMode && pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── Auth & Dashboard Protection ───────────────────────────────────
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log('[MIDDLEWARE] Path:', pathname)
  console.log('[MIDDLEWARE] Has session:', !!session)
  
  // Protect all dashboard routes
  if (pathname.startsWith('/dashboard')) {
    // Not authenticated - redirect to login
    if (!session) {
      console.log('[MIDDLEWARE] No session, redirecting to login')
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    console.log('[MIDDLEWARE] Session user ID:', session.user.id)

    // Get user's role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    console.log('[MIDDLEWARE] Profile:', profile)
    console.log('[MIDDLEWARE] Profile error:', profileError)

    if (profileError || !profile) {
      console.error('[MIDDLEWARE] Profile fetch error:', profileError)
      // Profile not found - redirect to login
      return NextResponse.redirect(new URL('/login?error=profile_not_found', request.url))
    }

    const userRole = profile.role
    const requestedPath = pathname

    console.log('[MIDDLEWARE] User role:', userRole)
    console.log('[MIDDLEWARE] Requested path:', requestedPath)

    // User accessing /dashboard root - redirect to their role dashboard
    if (requestedPath === '/dashboard' || requestedPath === '/dashboard/') {
      console.log('[MIDDLEWARE] Redirecting to role dashboard:', `/dashboard/${userRole}`)
      return NextResponse.redirect(new URL(`/dashboard/${userRole}`, request.url))
    }

    // Role-based access control
    if (requestedPath.startsWith('/dashboard/client') && userRole !== 'client') {
      // Non-clients trying to access client dashboard
      console.log('[MIDDLEWARE] Wrong role for client dashboard, redirecting')
      return NextResponse.redirect(new URL(`/dashboard/${userRole}`, request.url))
    }

    if (requestedPath.startsWith('/dashboard/driver') && userRole !== 'driver') {
      // Non-drivers trying to access driver dashboard
      console.log('[MIDDLEWARE] Wrong role for driver dashboard, redirecting')
      return NextResponse.redirect(new URL(`/dashboard/${userRole}`, request.url))
    }

    if (requestedPath.startsWith('/dashboard/admin') && userRole !== 'admin') {
      // Non-admins trying to access admin dashboard
      console.log('[MIDDLEWARE] Wrong role for admin dashboard, redirecting')
      return NextResponse.redirect(new URL(`/dashboard/${userRole}`, request.url))
    }

    console.log('[MIDDLEWARE] Access granted!')
  }

  // Important: return response to ensure session cookies are properly set
  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/maintenance',
    // Maintenance mode: match all page routes (not _next, api, or static)
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
