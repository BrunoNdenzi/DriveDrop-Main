import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      password,
      role,
      firstName,
      lastName,
      phone,
      brokerProfile,
      smsConsent,
    } = await request.json()

    if (!email || !password || !role || !firstName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['client', 'broker'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const supabase = getServiceSupabase()

    console.log('[Signup API] Creating user:', { email, role })

    // admin.createUser does NOT send confirmation emails by default
    // We'll create the user, then manually trigger the confirmation email
    const createUserResponse = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // User needs to verify email
      user_metadata: {
        first_name: firstName,
        last_name: lastName || '',
        phone: phone || '',
        role,
      },
    })

    if (createUserResponse.error || !createUserResponse.data.user) {
      console.error('[Signup API] User creation failed:', createUserResponse.error)
      return NextResponse.json(
        { error: createUserResponse.error?.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    const userId = createUserResponse.data.user.id
    console.log('[Signup API] User created successfully:', userId)
    
    // Generate confirmation link (admin.generateLink does NOT send emails automatically!)
    console.log('[Signup API] Generating confirmation link...')
    let confirmationLink = ''
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://drivedrop.us.com'
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email,
        password: password,
        options: {
          redirectTo: `${siteUrl}/auth/callback`
        }
      })
      
      if (linkError) {
        console.error('[Signup API] Failed to generate confirmation link:', linkError)
      } else {
        confirmationLink = linkData.properties.action_link
        console.log('[Signup API] Confirmation link generated successfully')
      }
    } catch (confirmError) {
      console.error('[Signup API] Confirmation email exception:', confirmError)
    }

    // Send verification email via Brevo with the confirmation link
    if (confirmationLink) {
      console.log('[Signup API] Sending verification email via backend...')
      let backendEmailSent = false
      try {
        const verificationEmailUrl = `${process.env.NEXT_PUBLIC_API_URL}/notifications/email-verification`
        const verificationResponse = await fetch(verificationEmailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email, 
            firstName,
            verificationLink: confirmationLink
          }),
        })
        
        const verificationData = await verificationResponse.json()
        console.log('[Signup API] Verification email response:', {
          status: verificationResponse.status,
          data: verificationData
        })
        
        if (!verificationResponse.ok) {
          console.error('[Signup API] Verification email failed via backend:', verificationData)
        } else {
          console.log('[Signup API] Verification email sent successfully via backend')
          backendEmailSent = true
        }
      } catch (emailError) {
        console.error('[Signup API] Backend verification email exception:', emailError)
      }

      // Fallback: if the backend notification service is unavailable, send directly via SMTP
      if (!backendEmailSent) {
        console.log('[Signup API] Using direct SMTP fallback for verification email...')
        try {
          await sendEmail({
            to: email,
            subject: 'Verify your DriveDrop account',
            html: `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verify Your Email</title>
              </head>
              <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
                  <tr>
                    <td style="padding:40px 20px;">
                      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <tr>
                          <td style="background-color:#030712;padding:32px 40px;text-align:center;">
                            <h1 style="margin:0 0 4px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                              Drive<span style="color:#3b82f6;">Drop</span>
                            </h1>
                            <p style="margin:0;color:#6b7280;font-size:13px;">Verify Your Account</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Hi ${firstName},</h2>
                            <p>Thanks for signing up for DriveDrop! Please click the button below to verify your email address.</p>
                            <p>This link expires in 24 hours.</p>
                            <div style="text-align:center;margin:32px 0;">
                              <a href="${confirmationLink}" style="display:inline-block;background-color:#3b82f6;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Verify Email Address</a>
                            </div>
                            <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link: <a href="${confirmationLink}" style="color:#3b82f6;word-break:break-all;">${confirmationLink}</a></p>
                            <p style="font-size:13px;color:#6b7280;">If you didn't create this account, you can safely ignore this email.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                            <p style="margin:0;">&copy; ${new Date().getFullYear()} DriveDrop Inc. All rights reserved.</p>
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
          console.log('[Signup API] Direct SMTP fallback verification email sent successfully')
        } catch (smtpFallbackError) {
          console.error('[Signup API] Direct SMTP fallback also failed:', smtpFallbackError)
          // Still proceed — user can request a new verification email from login page
        }
      }
    }

    const profileResponse = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          first_name: firstName,
          last_name: lastName || '',
          phone: phone || '',
          role,
          sms_consent: smsConsent === true,
        },
        { onConflict: 'id' }
      )

    if (profileResponse.error) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    if (role === 'broker') {
      if (!brokerProfile) {
        await supabase.auth.admin.deleteUser(userId)
        return NextResponse.json(
          { error: 'Missing broker profile data' },
          { status: 400 }
        )
      }

      const brokerInsert = await supabase
        .from('broker_profiles')
        .insert({
          profile_id: userId,
          company_name: brokerProfile.company_name,
          dba_name: brokerProfile.dba_name || null,
          company_email: brokerProfile.company_email,
          company_phone: brokerProfile.company_phone,
          dot_number: brokerProfile.dot_number || null,
          mc_number: brokerProfile.mc_number || null,
          tax_id: brokerProfile.tax_id || null,
          business_structure: brokerProfile.business_structure || null,
          years_in_business: brokerProfile.years_in_business || null,
          website_url: brokerProfile.website_url || null,
          business_address: brokerProfile.business_address,
          business_city: brokerProfile.business_city,
          business_state: brokerProfile.business_state,
          business_zip: brokerProfile.business_zip,
          business_country: brokerProfile.business_country || 'USA',
          default_commission_rate: brokerProfile.default_commission_rate,
          platform_fee_rate: brokerProfile.platform_fee_rate || 10,
        })
        .select()
        .single()

      if (brokerInsert.error) {
        await supabase.auth.admin.deleteUser(userId)
        return NextResponse.json(
          { error: 'Failed to create broker profile' },
          { status: 500 }
        )
      }
    }

    // Send welcome email (non-blocking - don't fail signup if email fails)
    console.log('[Signup API] Sending welcome email to:', email)
    try {
      const welcomeEmailUrl = `${process.env.NEXT_PUBLIC_API_URL}/notifications/welcome`
      console.log('[Signup API] Welcome email URL:', welcomeEmailUrl)
      
      const welcomeResponse = await fetch(welcomeEmailUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName }),
      })
      
      const welcomeData = await welcomeResponse.json()
      console.log('[Signup API] Welcome email response:', {
        status: welcomeResponse.status,
        data: welcomeData
      })
      
      if (!welcomeResponse.ok) {
        console.error('[Signup API] Welcome email failed:', welcomeData)
      } else {
        console.log('[Signup API] Welcome email sent successfully')
      }
    } catch (emailError) {
      console.error('[Signup API] Welcome email exception:', emailError)
      // Don't throw - email failure shouldn't block signup
    }

    console.log('[Signup API] Signup completed successfully')
    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
