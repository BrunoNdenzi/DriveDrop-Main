import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'
import { sendEmail } from '@/lib/email'

// Helper function to upload file to Supabase Storage
// Uses service role key for elevated permissions
async function uploadFile(
  file: File,
  bucket: string,
  folder: string
): Promise<string | null> {
  try {
    const supabase = getServiceSupabase()
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error(`Error uploading file to ${bucket}:`, error)
      return null
    }

    // Get public URL (even though buckets are private, we need the path)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error) {
    console.error('Error in uploadFile:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Driver Application Submission Started ===')
    
    // Parse form data (multipart/form-data for file uploads)
    const formData = await request.formData()
    console.log('FormData parsed successfully')

    // Extract form fields
    const fullName = formData.get('fullName') as string
    const dateOfBirth = formData.get('dateOfBirth') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const address = formData.get('address') as string
    // SSN is now optional and removed from the form
    const ssn = formData.get('ssn') as string | null
    
    const licenseNumber = formData.get('licenseNumber') as string
    const licenseState = formData.get('licenseState') as string
    const licenseExpiration = formData.get('licenseExpiration') as string
    const licenseFront = formData.get('licenseFront') as File | null
    const licenseBack = formData.get('licenseBack') as File | null
    const proofOfAddress = formData.get('proofOfAddress') as File | null
    
    const insuranceProvider = formData.get('insuranceProvider') as string
    const policyNumber = formData.get('policyNumber') as string
    const policyExpiration = formData.get('policyExpiration') as string
    const coverageAmount = formData.get('coverageAmount') as string
    const insuranceProof = formData.get('insuranceProof') as File | null
    
    const hasSuspensions = formData.get('hasSuspensions') === 'true'
    const hasCriminalRecord = formData.get('hasCriminalRecord') === 'true'
    const incidentDescription = formData.get('incidentDescription') as string | null
    
    const backgroundCheckConsent = formData.get('backgroundCheckConsent') === 'true'
    const dataUseConsent = formData.get('dataUseConsent') === 'true'
    const insuranceConsent = formData.get('insuranceConsent') === 'true'
    const termsAccepted = formData.get('termsAccepted') === 'true'

    // Validate required fields (SSN no longer required)
    const requiredFields = [
      { name: 'fullName', value: fullName },
      { name: 'dateOfBirth', value: dateOfBirth },
      { name: 'email', value: email },
      { name: 'phone', value: phone },
      { name: 'address', value: address },
      { name: 'licenseNumber', value: licenseNumber },
      { name: 'licenseState', value: licenseState },
      { name: 'licenseExpiration', value: licenseExpiration },
      { name: 'insuranceProvider', value: insuranceProvider },
      { name: 'policyNumber', value: policyNumber },
      { name: 'policyExpiration', value: policyExpiration },
      { name: 'coverageAmount', value: coverageAmount },
    ]

    const missingFields = requiredFields.filter(field => !field.value)
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields.map(f => f.name))
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.map(f => f.name).join(', ')}` },
        { status: 400 }
      )
    }

    console.log('All required fields present')

    // Encrypt SSN if provided (optional now)
    let ssnEncrypted: string | null = null
    if (ssn) {
      try {
        console.log('Encrypting SSN...')
        ssnEncrypted = encrypt(ssn)
        console.log('SSN encrypted successfully')
      } catch (error) {
        console.error('Error encrypting SSN:', error)
        return NextResponse.json(
          { error: 'Failed to process sensitive data securely' },
          { status: 500 }
        )
      }
    }

    // Create a temporary folder ID for file uploads
    const applicationFolderId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`
    console.log('Application folder ID:', applicationFolderId)

    // Upload documents to Supabase Storage
    let licenseFrontUrl: string | null = null
    let licenseBackUrl: string | null = null
    let proofOfAddressUrl: string | null = null
    let insuranceProofUrl: string | null = null

    try {
      if (licenseFront && licenseFront.size > 0) {
        licenseFrontUrl = await uploadFile(licenseFront, 'driver-licenses', applicationFolderId)
        if (!licenseFrontUrl) {
          console.error('Failed to upload license front - bucket may not exist')
        }
      }

      if (licenseBack && licenseBack.size > 0) {
        licenseBackUrl = await uploadFile(licenseBack, 'driver-licenses', applicationFolderId)
        if (!licenseBackUrl) {
          console.error('Failed to upload license back - bucket may not exist')
        }
      }

      if (proofOfAddress && proofOfAddress.size > 0) {
        proofOfAddressUrl = await uploadFile(proofOfAddress, 'proof-of-address', applicationFolderId)
        if (!proofOfAddressUrl) {
          console.error('Failed to upload proof of address - bucket may not exist')
        }
      }

      if (insuranceProof && insuranceProof.size > 0) {
        insuranceProofUrl = await uploadFile(insuranceProof, 'insurance-documents', applicationFolderId)
        if (!insuranceProofUrl) {
          console.error('Failed to upload insurance proof - bucket may not exist')
        }
      }
    } catch (uploadError) {
      console.error('Error during file uploads:', uploadError)
      // Continue with application submission even if uploads fail
      // Admin can request documents via email later
    }

    console.log('File uploads completed (or skipped)')
    console.log('Document URLs:', {
      licenseFrontUrl,
      licenseBackUrl,
      proofOfAddressUrl,
      insuranceProofUrl
    })

    // Insert application into database using service role for elevated permissions
    console.log('Inserting application into database...')
    const supabase = getServiceSupabase()
    const { data: application, error } = await supabase
      .from('driver_applications')
      .insert({
        full_name: fullName,
        date_of_birth: dateOfBirth,
        email: email,
        phone: phone,
        address: address,
        ssn_encrypted: ssnEncrypted, // ✅ Now optional and nullable!
        
        license_number: licenseNumber,
        license_state: licenseState,
        license_expiration: licenseExpiration,
        license_front_url: licenseFrontUrl,
        license_back_url: licenseBackUrl,
        proof_of_address_url: proofOfAddressUrl,
        
        has_suspensions: hasSuspensions,
        has_criminal_record: hasCriminalRecord,
        incident_description: incidentDescription,
        
        insurance_provider: insuranceProvider,
        insurance_policy_number: policyNumber,
        insurance_expiration: policyExpiration,
        coverage_amount: coverageAmount,
        insurance_proof_url: insuranceProofUrl,
        
        background_check_consent: backgroundCheckConsent,
        data_use_consent: dataUseConsent,
        insurance_consent: insuranceConsent,
        terms_accepted: termsAccepted,
        
        status: 'pending',
        background_check_status: 'not_started',
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // Check for duplicate email
      if (error.code === '23505' && error.message.includes('email')) {
        return NextResponse.json(
          { error: 'An application with this email already exists and is pending review.' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to submit application. Please try again.' },
        { status: 500 }
      )
    }

    console.log('Application inserted successfully:', application.id)

    // Send welcome/confirmation email via Brevo (preferred method)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const firstName = fullName.split(' ')[0]
      
      await fetch(`${backendUrl}/api/v1/emails/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          lastName: fullName.split(' ').slice(1).join(' '),
          role: 'driver'
        })
      })
      console.log('Driver welcome email sent via Brevo'
)
    } catch (emailError) {
      console.error('Error sending Brevo email:', emailError)
      // Continue - fallback to nodemailer below
    }

    // Fallback: Send confirmation email to applicant using nodemailer
    try {
      const firstName = fullName.split(' ')[0]
      await sendEmail({
        to: email,
        subject: '✅ Driver Application Received - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Application Received! ✅</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Thank you for applying to become a DriveDrop driver! We have received your application and will review it shortly.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #00B8A9;">
                  <h2 style="margin: 0 0 15px 0; color: #00B8A9; font-size: 18px;">📋 What's Next?</h2>
                  <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                    <li>We'll review your application and documents</li>
                    <li>Background check will be initiated</li>
                    <li>You'll receive an email once we make a decision (typically within 3-5 business days)</li>
                    <li>If approved, you'll receive login credentials</li>
                  </ol>
                </div>
                
                <div style="background: #e8f5f4; padding: 15px; border-radius: 4px; margin-top: 20px;">
                  <p style="margin: 0; font-size: 14px; color: #00695c;">
                    💡 <strong>Application ID:</strong> ${application.id.substring(0, 8).toUpperCase()}<br>
                    Keep this ID for your records.
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
                </p>
                
                <p style="font-size: 16px; margin-top: 30px; margin-bottom: 5px;">Best regards,</p>
                <p style="font-size: 16px; margin-top: 0; font-weight: bold; color: #00B8A9;">The DriveDrop Team</p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      })
      console.log('Applicant confirmation email sent successfully')
    } catch (emailError) {
      console.error('Error sending confirmation email to applicant:', emailError)
      // Don't fail the request if email fails - application is already submitted
    }

    // Send notification email to admin
    try {
      await sendEmail({
        to: 'infos@drivedrop.us.com',
        subject: '🚨 New Driver Application Submitted - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #FF6B6B 0%, #EE5A6F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🚨 New Driver Application</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">
                  A new driver application has been submitted and requires review.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FF6B6B;">
                  <h2 style="margin: 0 0 15px 0; color: #FF6B6B; font-size: 18px;">📋 Applicant Information</h2>
                  <table style="width: 100%; font-size: 14px;">
                    <tr>
                      <td style="padding: 8px 0; color: #666; width: 40%;"><strong>Full Name:</strong></td>
                      <td style="padding: 8px 0;">${fullName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td>
                      <td style="padding: 8px 0;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td>
                      <td style="padding: 8px 0;">${phone}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>License State:</strong></td>
                      <td style="padding: 8px 0;">${licenseState}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Application ID:</strong></td>
                      <td style="padding: 8px 0; font-family: monospace;">${application.id.substring(0, 8).toUpperCase()}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #666;"><strong>Submitted:</strong></td>
                      <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                    </tr>
                  </table>
                </div>

                <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <p style="margin: 0; font-size: 14px; color: #856404;">
                    ⚠️ <strong>Documents Uploaded:</strong><br>
                    ${licenseFrontUrl ? '✅ Driver License (Front)' : '❌ Driver License (Front)'}<br>
                    ${licenseBackUrl ? '✅ Driver License (Back)' : '❌ Driver License (Back)'}<br>
                    ${proofOfAddressUrl ? '✅ Proof of Address' : '❌ Proof of Address'}<br>
                    ${insuranceProofUrl ? '✅ Insurance Document' : '❌ Insurance Document'}
                  </p>
                </div>

                <div style="background: #e8f5f4; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #00695c;">
                    📊 <strong>Background Check Status:</strong> Not Started<br>
                    🚦 <strong>Application Status:</strong> Pending Review
                  </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="https://www.drivedrop.us.com/dashboard/admin/driver-applications" 
                     style="display: inline-block; background: #FF6B6B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    Review Application Now →
                  </a>
                </div>

                <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: center;">
                  This is an automated notification from the DriveDrop driver application system.
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                <p>© ${new Date().getFullYear()} DriveDrop. All rights reserved.</p>
              </div>
            </body>
          </html>
        `,
      })
      console.log('Admin notification email sent successfully')
    } catch (emailError) {
      console.error('Error sending notification email to admin:', emailError)
      // Don't fail the request if email fails
    }

    // TODO: Initiate background check via Checkr API or similar service
    // This would typically be done asynchronously after initial review

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      message: 'Application submitted successfully! Check your email for confirmation.',
    })
  } catch (error) {
    console.error('Application submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
