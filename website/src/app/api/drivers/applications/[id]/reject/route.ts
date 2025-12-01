import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reason } = await request.json()
    const applicationId = params.id
    const supabase = getServiceSupabase()

    // Get application details
    const { data: application, error: fetchError} = await supabase
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

    // Update application status to rejected
    const { error: updateError } = await supabase
      .from('driver_applications')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        admin_comment: reason || null,
      })
      .eq('id', applicationId)

    if (updateError) {
      console.error('Error updating application:', updateError)
      return NextResponse.json(
        { error: 'Failed to update application status' },
        { status: 500 }
      )
    }

    // Send rejection email
    try {
      const firstName = application.full_name.split(' ')[0]
      await sendEmail({
        to: application.email,
        subject: 'Driver Application Update - DriveDrop',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #00B8A9 0%, #008B80 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Application Status Update</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${firstName},</p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Thank you for your interest in becoming a DriveDrop driver. After careful review of your application, we are unable to approve it at this time.
                </p>
                
                ${reason ? `
                  <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #856404;">
                      <strong>Reason:</strong> ${reason}
                    </p>
                  </div>
                ` : ''}
                
                <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #0d47a1;">
                    💡 <strong>Can I reapply?</strong> Yes! You're welcome to submit a new application in the future. Please ensure all requirements are met before reapplying.
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  If you have questions about this decision, please contact us at <a href="mailto:support@drivedrop.us.com" style="color: #00B8A9;">support@drivedrop.us.com</a>
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
    } catch (emailError) {
      console.error('Error sending rejection email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Application rejected successfully',
    })
  } catch (error) {
    console.error('Error rejecting application:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
