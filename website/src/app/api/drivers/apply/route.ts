import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    const requiredFields = ['fullName', 'dateOfBirth', 'email', 'phone', 'address', 'ssn']
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    // TODO: Encrypt SSN before storing
    // For now, we'll store it as-is (YOU SHOULD IMPLEMENT ENCRYPTION)
    
    // Insert into driver_applications table
    const { data: application, error } = await supabase
      .from('driver_applications')
      .insert({
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth,
        email: data.email,
        phone: data.phone,
        address: data.address,
        ssn_encrypted: data.ssn, // TODO: Encrypt this!
        
        license_number: data.licenseNumber,
        license_state: data.licenseState,
        license_expiration: data.licenseExpiration,
        
        has_suspensions: data.hasSuspensions || false,
        has_criminal_record: data.hasCriminalRecord || false,
        incident_description: data.incidentDescription,
        
        insurance_provider: data.insuranceProvider,
        insurance_policy_number: data.policyNumber,
        insurance_expiration: data.policyExpiration,
        coverage_amount: data.coverageAmount,
        
        background_check_consent: data.backgroundCheckConsent,
        data_use_consent: data.dataUseConsent,
        insurance_consent: data.insuranceConsent,
        terms_accepted: data.termsAccepted,
        
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to submit application' },
        { status: 500 }
      )
    }

    // TODO: Send confirmation email to applicant
    // TODO: Send notification email to admin
    // TODO: Initiate background check process (if using Checkr API)

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Application submitted successfully',
    })
  } catch (error) {
    console.error('Application submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
