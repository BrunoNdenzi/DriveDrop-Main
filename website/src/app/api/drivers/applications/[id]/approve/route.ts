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
        subject: '🎉 Your Driver Application Has Been Approved! - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Congratulations! 🎉</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Great news! Your driver application has been <strong>approved</strong>! You can now start accepting shipments on DriveDrop.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #28a745;">
                  <h2 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">🔑 Your Login Credentials</h2>
                  
                  <p style="margin: 5px 0; color: #666; font-size: 14px;">Email</p>
                  <p style="margin: 0 0 15px 0; font-size: 16px; font-family: monospace; background: #f0f0f0; padding: 10px; border-radius: 4px;">${application.email}</p>
                  
                  <p style="margin: 5px 0; color: #666; font-size: 14px;">Temporary Password</p>
                  <p style="margin: 0 0 15px 0; font-size: 16px; font-family: monospace; background: #f0f0f0; padding: 10px; border-radius: 4px; word-break: break-all;">${temporaryPassword}</p>
                  
                  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 13px; color: #856404;">
                      🔒 <strong>Security Notice:</strong> You'll be required to change this password on your first login. Never share your password with anyone.
                    </p>
                  </div>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://drivedrop.us.com/login" 
                     style="display: inline-block; background: #00B8A9; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
                    Log In Now
                  </a>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0;">
                  <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">🚗 Getting Started</h2>
                  <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                    <li>Log in to your driver account</li>
                    <li>Complete your profile setup</li>
                    <li>Browse available shipments in your area</li>
                    <li>Accept jobs and start earning!</li>
                  </ol>
                </div>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 4px; margin-top: 20px;">
                  <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                    💵 <strong>Payment Info:</strong> You'll earn 90% of each shipment value. Payouts are processed weekly via your preferred method.
                  </p>
                </div>
                
                ${adminComment ? `
                  <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin-top: 20px;">
                    <p style="margin: 0; font-size: 14px; color: #0d47a1;">
                      💬 <strong>Admin Note:</strong> ${adminComment}
                    </p>
                  </div>
                ` : ''}
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
                </p>
                
                <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Welcome to the team!</p>
                <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
              </div>
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
