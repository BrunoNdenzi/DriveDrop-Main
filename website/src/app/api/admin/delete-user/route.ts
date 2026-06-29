import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()
    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // Delete the user from Supabase Auth (profile cascades via FK/trigger)
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    // Notify the deleted user
    sendEmail({
      to: email,
      subject: 'Your DriveDrop Account Has Been Deleted',
      html: `
        <h2>Account Deletion Confirmed</h2>
        <p>Your DriveDrop account and all associated data have been permanently deleted as requested.</p>
        <p>If you believe this was done in error, please contact us at <a href="mailto:infos@drivedrop.us.com">infos@drivedrop.us.com</a>.</p>
      `,
    }).catch((e) => console.warn('Deletion confirmation email failed:', e))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 })
  }
}
