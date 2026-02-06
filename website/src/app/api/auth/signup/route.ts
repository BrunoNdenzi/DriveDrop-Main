import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

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
    
    // Manually send the confirmation email
    console.log('[Signup API] Sending confirmation email via Supabase...')
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://drivedrop.us.com'
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          redirectTo: `${siteUrl}/auth/callback`
        }
      })
      
      if (linkError) {
        console.error('[Signup API] Failed to generate confirmation link:', linkError)
      } else {
        console.log('[Signup API] Confirmation link generated:', linkData.properties.action_link)
        // The link is generated but Supabase should have sent the email via SMTP
        // If SMTP is configured, the email is sent automatically when generate Link is called
      }
    } catch (confirmError) {
      console.error('[Signup API] Confirmation email exception:', confirmError)
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
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
