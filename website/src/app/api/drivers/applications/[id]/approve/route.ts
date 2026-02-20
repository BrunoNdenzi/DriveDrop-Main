import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { generatePassword } from '@/lib/encryption'
import { sendEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { adminComment } = await request.json()
    const applicationId = params.id
    const supabase = getServiceSupabase()

    // Get application details
    const { data: application, error: fetchError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (fetchError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Generate a secure temporary password
    const temporaryPassword = generatePassword(16)

    // Split full name into first and last name
    const nameParts = application.full_name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || ''

    // Create user account in auth.users using Admin API
    let authData
    try {
      const createUserResponse = await supabase.auth.admin.createUser({
        email: application.email,
        password: temporaryPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone: application.phone,
          role: 'driver',
          force_password_change: true, // Force password change on first login
        },
      })

      if (createUserResponse.error) {
        throw createUserResponse.error
      }

      authData = createUserResponse.data
    } catch (authError: any) {
      console.error('Error creating user account:', authError)
      return NextResponse.json(
        { error: `Failed to create user account: ${authError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Note: Profile is automatically created by the handle_new_user trigger
    // We just need to verify it was created successfully
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Error verifying profile creation:', profileError)
      // Profile wasn't created by trigger, try to delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile automatically' },
        { status: 500 }
      )
    }

    // Update application status to approved
    const { error: updateError } = await supabase
      .from('driver_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: authData.user.id, // Link to created user
        admin_comment: adminComment || null,
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Error updating application:', updateError)
      return NextResponse.json(
        { error: 'Failed to update application status' },
        { status: 500 }
      )
    }

    // Send approval email with login credentials
    try {
      const firstName = application.full_name.split(' ')[0]
      await sendEmail({
        to: application.email,
        subject: 'Your Driver Application Has Been Approved! - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Application Approved</title>
          </head>
          <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
              <tr>
                <td style="padding:40px 20px;">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background-color:#030712;padding:32px 40px;text-align:center;">
                        <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                          Drive<span style="color:#3b82f6;">Drop</span>
                        </h1>
                        <p style="margin:0;color:#22c55e;font-size:13px;font-weight:600;">Application Approved</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Congratulations, ${firstName}!</h2>

                        <p>Your driver application has been <strong>approved</strong>! You can now start accepting shipments on DriveDrop.</p>

                        <!-- Credentials -->
                        <div style="background-color:#f9fafb;border-left:3px solid #22c55e;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
                          <strong>Your Login Credentials</strong><br><br>
                          <strong>Email:</strong><br>
                          <span style="display:inline-block;font-family:monospace;background-color:#e5e7eb;padding:6px 12px;border-radius:4px;margin:4px 0 12px;">${application.email}</span><br>
                          <strong>Temporary Password:</strong><br>
                          <span style="display:inline-block;font-family:monospace;background-color:#e5e7eb;padding:6px 12px;border-radius:4px;margin:4px 0;word-break:break-all;">${temporaryPassword}</span>
                        </div>

                        <div style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;color:#92400e;">
                          <strong>Security Notice:</strong> You'll be required to change this password on your first login. Never share your password with anyone.
                        </div>

                        <div style="text-align:center;margin:28px 0;">
                          <a href="https://drivedrop.us.com/login" style="display:inline-block;background-color:#f59e0b;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Log In Now</a>
                        </div>

                        <!-- Getting started -->
                        <div style="background-color:#f9fafb;border-left:3px solid #f59e0b;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
                          <strong>Getting Started</strong>
                          <ol style="margin:8px 0 0;padding-left:18px;">
                            <li>Log in to your driver account</li>
                            <li>Complete your profile setup</li>
                            <li>Browse available shipments in your area</li>
                            <li>Accept jobs and start earning!</li>
                          </ol>
                        </div>

                        <div style="background-color:#f0fdf4;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#166534;">
                          <strong>Payment Info:</strong> You'll earn 90% of each shipment value. Payouts are processed weekly via your preferred method.
                        </div>

                        ${adminComment ? `
                          <div style="background-color:#eff6ff;border-left:3px solid #3b82f6;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;color:#1e40af;">
                            <strong>Admin Note:</strong> ${adminComment}
                          </div>
                        ` : ''}

                        <p style="color:#6b7280;font-size:13px;">
                          Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a>
                        </p>

                        <p>Welcome to the team!<br><strong>The DriveDrop Team</strong></p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                        <p style="margin:0;">
                          <a href="https://drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">drivedrop.us.com</a>
                          &nbsp;&middot;&nbsp;
                          <a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a>
                        </p>
                        <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">&copy; ${new Date().getFullYear()} DriveDrop Inc. All rights reserved.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      })
    } catch (emailError) {
      console.error('Error sending approval email:', emailError)
      // Don't fail the request if email fails - application is already approved
    }

    return NextResponse.json({
      success: true,
      message: 'Application approved and user account created successfully',
      userId: authData.user.id,
    })
  } catch (error) {
    console.error('Error approving application:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
