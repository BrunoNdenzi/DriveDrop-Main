import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
    }

    const cookieStore = await cookies()

    // Use cookie-based client to read the authenticated user's session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify current password by attempting sign-in server-side (no cookie side-effects)
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (signInError) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
    }

    // Update password using service role (bypasses session requirements)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
