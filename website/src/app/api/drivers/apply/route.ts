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
        subject: 'Driver Application Received - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Application Received</title>
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
                        <p style="margin:0;color:#6b7280;font-size:13px;">Application Received</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Hi ${firstName},</h2>

                        <p>Thank you for applying to become a DriveDrop driver! We have received your application and will review it shortly.</p>

                        <div style="background-color:#f9fafb;border-left:3px solid #f59e0b;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
                          <strong>What's Next?</strong>
                          <ol style="margin:8px 0 0;padding-left:18px;">
                            <li>We'll review your application and documents</li>
                            <li>Background check will be initiated</li>
                            <li>You'll receive an email once we make a decision (typically 3-5 business days)</li>
                            <li>If approved, you'll receive login credentials</li>
                          </ol>
                        </div>

                        <div style="background-color:#f9fafb;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#6b7280;">
                          <strong>Application ID:</strong> <span style="font-family:monospace;">${application.id.substring(0, 8).toUpperCase()}</span> — keep this for your records.
                        </div>

                        <p style="color:#6b7280;font-size:13px;">
                          Questions? Contact us at <a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a>
                        </p>

                        <p>Best regards,<br><strong>The DriveDrop Team</strong></p>
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
      console.log('Applicant confirmation email sent successfully')
    } catch (emailError) {
      console.error('Error sending confirmation email to applicant:', emailError)
      // Don't fail the request if email fails - application is already submitted
    }

    // Send notification email to admin
    try {
      await sendEmail({
        to: 'infos@drivedrop.us.com',
        subject: 'New Driver Application Submitted - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Driver Application</title>
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
                        <p style="margin:0;color:#ef4444;font-size:13px;font-weight:600;">New Driver Application</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                        <p>A new driver application has been submitted and requires review.</p>

                        <div style="background-color:#f9fafb;border-left:3px solid #a855f7;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;">
                          <strong>Applicant Information</strong><br>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;width:40%;font-size:13px;"><strong>Full Name:</strong></td>
                              <td style="padding:6px 0;font-size:13px;">${fullName}</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:13px;"><strong>Email:</strong></td>
                              <td style="padding:6px 0;font-size:13px;">${email}</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:13px;"><strong>Phone:</strong></td>
                              <td style="padding:6px 0;font-size:13px;">${phone}</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:13px;"><strong>License State:</strong></td>
                              <td style="padding:6px 0;font-size:13px;">${licenseState}</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:13px;"><strong>Application ID:</strong></td>
                              <td style="padding:6px 0;font-size:13px;font-family:monospace;">${application.id.substring(0, 8).toUpperCase()}</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:13px;"><strong>Submitted:</strong></td>
                              <td style="padding:6px 0;font-size:13px;">${new Date().toLocaleString()}</td>
                            </tr>
                          </table>
                        </div>

                        <div style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;font-size:13px;line-height:1.8;">
                          <strong style="color:#92400e;">Documents Uploaded:</strong><br>
                          ${licenseFrontUrl ? '&#10003; Driver License (Front)' : '&#10007; Driver License (Front)'}<br>
                          ${licenseBackUrl ? '&#10003; Driver License (Back)' : '&#10007; Driver License (Back)'}<br>
                          ${proofOfAddressUrl ? '&#10003; Proof of Address' : '&#10007; Proof of Address'}<br>
                          ${insuranceProofUrl ? '&#10003; Insurance Document' : '&#10007; Insurance Document'}
                        </div>

                        <div style="background-color:#f9fafb;padding:12px 16px;border-radius:6px;margin:20px 0;font-size:13px;color:#6b7280;">
                          <strong>Background Check:</strong> Not Started &nbsp;&middot;&nbsp; <strong>Status:</strong> Pending Review
                        </div>

                        <div style="text-align:center;margin:28px 0;">
                          <a href="https://www.drivedrop.us.com/dashboard/admin/driver-applications" style="display:inline-block;background-color:#a855f7;color:#ffffff;padding:12px 32px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Review Application</a>
                        </div>

                        <p style="color:#9ca3af;font-size:12px;text-align:center;">This is an automated notification from the DriveDrop driver application system.</p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">
                        <p style="margin:0;">
                          <a href="https://drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">drivedrop.us.com</a>
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
