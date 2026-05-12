import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { generatePassword } from '@/lib/encryption'

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

    // Send approval email with login credentials via Brevo
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
      const firstName = application.full_name.split(' ')[0]
      
      await fetch(`${backendUrl}/emails/send-driver-application-approved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: application.email,
          firstName,
          fullName: application.full_name,
          temporaryPassword,
          adminComment: adminComment || ''
        })
      })
      
      console.log('Driver approval email sent via Brevo')
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
