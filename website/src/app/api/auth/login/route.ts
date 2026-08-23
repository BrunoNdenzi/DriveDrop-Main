import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, role, redirectTo } = await request.json()

    const cookieStore = await cookies()
    const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = []
    const jsonResponse = (body: unknown, init?: ResponseInit) => {
      const response = NextResponse.json(body, init)
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            pendingCookies.push({ name, value, options })
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            pendingCookies.push({ name, value: '', options })
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Sign in
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      return jsonResponse(
        { error: signInError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return jsonResponse(
        { error: 'Login failed' },
        { status: 400 }
      )
    }

    // Fetch user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      return jsonResponse(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Verify role matches
    if (profile.role !== role) {
      // Sign out if wrong role
      await supabase.auth.signOut()
      return jsonResponse(
        { error: `This account is registered as a ${profile.role}, not ${role}` },
        { status: 403 }
      )
    }

    // Check if password change is required (for newly approved drivers)
    const forcePasswordChange = authData.user.user_metadata?.force_password_change === true
    
    if (forcePasswordChange) {
      return jsonResponse({
        success: true,
        requiresPasswordChange: true,
        redirectTo: '/change-password?required=true',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: profile.role,
        },
      })
    }

    // Return success with redirect path
    return jsonResponse({
      success: true,
      redirectTo: redirectTo || `/dashboard/${profile.role}`,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: profile.role,
      },
    })
  } catch (error: any) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
