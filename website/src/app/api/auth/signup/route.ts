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

    const createUserResponse = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName || '',
        phone: phone || '',
        role,
      },
    })

    if (createUserResponse.error || !createUserResponse.data.user) {
      return NextResponse.json(
        { error: createUserResponse.error?.message || 'Failed to create user' },
        { status: 400 }
      )
    }

    const userId = createUserResponse.data.user.id

    const profileResponse = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          first_name: firstName,
          last_name: lastName || '',
          full_name: `${firstName} ${lastName || ''}`.trim(),
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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
