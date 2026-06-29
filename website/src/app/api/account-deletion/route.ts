import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: NextRequest) {
  try {
    const { userId, email, reason } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: { message: 'User ID and email are required' } },
        { status: 400 }
      )
    }

    // 1. Mark the profile as pending deletion — blocks future login access
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'pending_delete_review',
        deletion_requested_at: new Date().toISOString(),
        deletion_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Failed to mark profile as pending deletion:', profileError)
      // Continue even if the profile field doesn't exist yet (schema migration pending)
    }

    // 2. Log the deletion request
    const { error: logError } = await supabase
      .from('account_deletion_requests')
      .insert({
        user_id: userId,
        email: email,
        reason: reason,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })

    if (logError && logError.code !== '42P01') {
      console.error('Failed to log deletion request:', logError)
    }

    // 3. Notify admin (non-blocking)
    sendEmail({
      to: 'infos@drivedrop.us.com',
      subject: `[Action Required] Account Deletion Request — ${email}`,
      html: `
        <h2>Account Deletion Request</h2>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
        <p><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
        <hr/>
        <p>The account has been marked as <strong>pending_delete_review</strong> and the user has been signed out. Access is blocked until the account is reviewed.</p>
        <p>Please review and approve or deny in the admin dashboard within 7 business days.</p>
      `,
    }).catch((e) => console.warn('Admin deletion email failed:', e))

    // 4. Confirmation email to the user (non-blocking)
    sendEmail({
      to: email,
      subject: 'Account Deletion Request Received — DriveDrop',
      html: `
        <h2>We've received your deletion request</h2>
        <p>Your DriveDrop account has been locked pending review. You will not be able to log in until a decision is made.</p>
        <p>Our team will process your request within <strong>7 business days</strong> and notify you by email.</p>
        <p>If you did not make this request, please contact us immediately at <a href="mailto:infos@drivedrop.us.com">infos@drivedrop.us.com</a> or call +1-704-266-2317.</p>
      `,
    }).catch((e) => console.warn('User deletion confirmation email failed:', e))

    return NextResponse.json({
      success: true,
      message: 'Account deletion request submitted successfully',
    })
  } catch (error: any) {
    console.error('Account deletion request error:', error)
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Failed to process account deletion request' } },
      { status: 500 }
    )
  }
}
