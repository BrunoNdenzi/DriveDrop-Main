import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { escapeHtml, requestUser } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    // The account being deleted is always the signed-in one, never one named in the request.
    const user = await requestUser(request)
    if (!user?.email) {
      return NextResponse.json({ success: false, error: { message: 'Sign in to request account deletion' } }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { reason?: unknown; product?: unknown }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
    const product = body.product === 'route-planner' ? 'route-planner' : null
    const productName = product ? 'DriveDrop Route Planner' : 'DriveDrop'
    const { id: userId, email } = user
    const supabase = getServiceSupabase()

    // 1. Log the deletion request
    const { error: logError } = await supabase
      .from('account_deletion_requests')
      .insert({
        user_id: userId,
        email,
        reason: reason || 'Not given',
        status: 'pending',
        product,
        requested_at: new Date().toISOString(),
      })
    if (logError) {
      console.error('Failed to log deletion request:', logError)
      // Without the log the request cannot be reviewed, so say so instead of reporting success.
      return NextResponse.json({ success: false, error: { message: 'Could not record your request. Email infos@drivedrop.us.com to delete your account.' } }, { status: 500 })
    }

    // 2. Mark the profile as pending deletion; sign-in is refused until an admin decides.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        status: 'pending_delete_review',
        deletion_requested_at: new Date().toISOString(),
        deletion_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (profileError) console.error('Failed to mark profile as pending deletion:', profileError)

    // 3. Notify admin (non-blocking)
    sendEmail({
      to: 'infos@drivedrop.us.com',
      subject: `[Action Required] ${productName} account deletion request: ${email}`,
      html: `
        <h2>Account Deletion Request</h2>
        <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Reason:</strong> ${reason ? escapeHtml(reason) : 'No reason provided'}</p>
        <p><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
        <hr/>
        <p>The account is marked <strong>pending_delete_review</strong> and the user has been signed out.</p>
        <p>Review and approve or deny it in the admin dashboard within 7 business days.</p>
      `,
    }).catch((e) => console.warn('Admin deletion email failed:', e))

    // 4. Confirmation email to the user (non-blocking)
    sendEmail({
      to: email,
      subject: `Account deletion request received: ${productName}`,
      html: `
        <h2>We've received your deletion request</h2>
        <p>Your ${escapeHtml(productName)} account is locked while we review the request, so you can't sign in until a decision is made.</p>
        <p>We will process it within <strong>7 business days</strong> and email you. Deleting the account removes your saved data${product ? ', routes, locations, run history and proof photos' : ''} and cancels any subscription.</p>
        <p>If you did not make this request, contact us right away at <a href="mailto:infos@drivedrop.us.com">infos@drivedrop.us.com</a>.</p>
      `,
    }).catch((e) => console.warn('User deletion confirmation email failed:', e))

    return NextResponse.json({ success: true, message: 'Account deletion request submitted successfully' })
  } catch (error: unknown) {
    console.error('Account deletion request error:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to process account deletion request' } },
      { status: 500 }
    )
  }
}
