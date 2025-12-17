import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, role } = await request.json()

    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
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
      return NextResponse.json(
        { error: signInError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Verify role matches
    if (profile.role !== role) {
      // Sign out if wrong role
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: `This account is registered as a ${profile.role}, not ${role}` },
        { status: 403 }
      )
    }

    // Check if password change is required (for newly approved drivers)
    const forcePasswordChange = authData.user.user_metadata?.force_password_change === true
    
    if (forcePasswordChange) {
      return NextResponse.json({
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
    return NextResponse.json({
      success: true,
      redirectTo: `/dashboard/${profile.role}`,
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
