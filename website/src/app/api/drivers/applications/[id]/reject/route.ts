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
        reviewed_at: new Date().toISOString(),
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
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Application Update</title>
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
                        <p style="margin:0;color:#6b7280;font-size:13px;">Application Status Update</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;color:#111827;font-size:15px;line-height:1.7;">
                        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Hi ${firstName},</h2>

                        <p>Thank you for your interest in becoming a DriveDrop driver. After careful review of your application, we are unable to approve it at this time.</p>

                        ${reason ? `
                          <div style="background-color:#fffbeb;border-left:3px solid #f59e0b;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;">
                            <strong style="color:#92400e;">Reason:</strong>
                            <p style="margin:6px 0 0;color:#92400e;">${reason}</p>
                          </div>
                        ` : ''}

                        <div style="background-color:#eff6ff;border-left:3px solid #3b82f6;padding:16px 20px;margin:24px 0;border-radius:0 6px 6px 0;font-size:14px;">
                          <strong>Can I reapply?</strong>
                          <p style="margin:6px 0 0;">Yes! You're welcome to submit a new application in the future. Please ensure all requirements are met before reapplying.</p>
                        </div>

                        <p style="color:#6b7280;font-size:13px;">
                          If you have questions about this decision, please contact us at <a href="mailto:support@drivedrop.us.com" style="color:#3b82f6;text-decoration:none;">support@drivedrop.us.com</a>
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
