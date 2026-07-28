import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

const ADMIN_EMAIL = 'infos@calkons.com'

const submissionSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  companyType: z.string().trim().max(80).optional().default(''),
  vehicleTypes: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
  spacesNeeded: z.coerce.number().int().min(1).max(500),
  parkingFrequency: z.enum(['Monthly', 'Daily', 'Both daily and monthly', 'Not sure yet']),
  monthlyPriceRange: z.enum(['Under $150', '$150-$199', '$200-$249', '$250-$299', '$300 or more', 'Need more information']),
  neededBy: z.enum(['Immediately', 'Within 30 days', 'Within 1-3 months', 'Within 3-6 months', 'More than 6 months', 'Planning ahead']),
  requestedServices: z.string().trim().max(1500).optional().default(''),
  contactConsent: z.literal('true'),
  website: z.string().max(0).optional().default(''),
})

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function sendAdminSms(payload: {
  fullName: string
  companyName: string
  email: string
  phone: string
  spacesNeeded: number
  vehicleTypes: string[]
  parkingFrequency: string
  neededBy: string
}) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  const signingKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!backendUrl || !signingKey) {
    throw new Error('Backend URL or server signing key is not configured')
  }

  const body = JSON.stringify(payload)
  const timestamp = Date.now().toString()
  const signature = createHmac('sha256', signingKey)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  const response = await fetch(`${backendUrl}/sms/parking-interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Parking-Timestamp': timestamp,
      'X-Parking-Signature': signature,
    },
    body,
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Backend SMS request failed (${response.status}): ${details}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()

    if (typeof rawBody?.website === 'string' && rawBody.website.length > 0) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const parsed = submissionSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the required fields and try again.' }, { status: 400 })
    }

    const submission = parsed.data
    const supabase = getServiceSupabase()
    const { data: saved, error: insertError } = await supabase
      .from('parking_interest_submissions')
      .insert({
        full_name: submission.fullName,
        company_name: submission.companyName,
        email: submission.email.toLowerCase(),
        phone: submission.phone,
        company_type: submission.companyType || null,
        vehicle_types: submission.vehicleTypes,
        spaces_needed: submission.spacesNeeded,
        parking_frequency: submission.parkingFrequency,
        monthly_price_range: submission.monthlyPriceRange,
        needed_by: submission.neededBy,
        requested_services: submission.requestedServices || null,
        contact_consent: true,
        source: 'parking_interest_page',
      })
      .select('id')
      .single()

    if (insertError || !saved) {
      console.error('[parking-interest] Database insert failed:', insertError)
      return NextResponse.json({ error: 'We could not save your response. Please try again.' }, { status: 500 })
    }

    const safe = {
      fullName: escapeHtml(submission.fullName),
      companyName: escapeHtml(submission.companyName),
      email: escapeHtml(submission.email),
      phone: escapeHtml(submission.phone),
      companyType: escapeHtml(submission.companyType || 'Not provided'),
      vehicles: submission.vehicleTypes.map(escapeHtml).join(', '),
      frequency: escapeHtml(submission.parkingFrequency),
      price: escapeHtml(submission.monthlyPriceRange),
      neededBy: escapeHtml(submission.neededBy),
      services: escapeHtml(submission.requestedServices || 'None provided').replaceAll('\n', '<br>'),
    }

    const emailPromise = sendEmail({
      to: ADMIN_EMAIL,
      subject: `New parking interest: ${submission.companyName} (${submission.spacesNeeded} spaces)`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#1e293b;line-height:1.6">
          <div style="background:#0f172a;color:#fff;padding:24px 28px">
            <div style="font-size:13px;color:#5eead4;text-transform:uppercase;letter-spacing:1px">DriveDrop Parking Demand</div>
            <h1 style="font-size:24px;margin:8px 0 0">New expression of interest</h1>
          </div>
          <div style="padding:28px;border:1px solid #e2e8f0;border-top:0">
            <p><strong>${safe.companyName}</strong> is interested in <strong>${submission.spacesNeeded} parking space${submission.spacesNeeded === 1 ? '' : 's'}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:20px">
              <tr><td style="padding:8px 0;color:#64748b;width:38%">Contact</td><td>${safe.fullName}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Email</td><td><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Phone</td><td><a href="tel:${safe.phone}">${safe.phone}</a></td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Company type</td><td>${safe.companyType}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Vehicles/equipment</td><td>${safe.vehicles}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Parking frequency</td><td>${safe.frequency}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Monthly price</td><td>${safe.price}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b">Needed</td><td>${safe.neededBy}</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Requested services</td><td>${safe.services}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:12px;color:#64748b">Submission ID: ${saved.id}</p>
          </div>
        </div>
      `,
    })

    const smsPromise = sendAdminSms({
      fullName: submission.fullName,
      companyName: submission.companyName,
      email: submission.email,
      phone: submission.phone,
      spacesNeeded: submission.spacesNeeded,
      vehicleTypes: submission.vehicleTypes,
      parkingFrequency: submission.parkingFrequency,
      neededBy: submission.neededBy,
    })

    const [emailResult, smsResult] = await Promise.allSettled([emailPromise, smsPromise])
    const emailSent = emailResult.status === 'fulfilled'
    const smsSent = smsResult.status === 'fulfilled'

    if (!emailSent) console.error('[parking-interest] Admin email failed:', emailResult.reason)
    if (!smsSent) console.error('[parking-interest] Admin SMS failed:', smsResult.reason)

    const { error: updateError } = await supabase
      .from('parking_interest_submissions')
      .update({
        email_notification_status: emailSent ? 'sent' : 'failed',
        sms_notification_status: smsSent ? 'sent' : 'failed',
        notification_attempted_at: new Date().toISOString(),
      })
      .eq('id', saved.id)

    if (updateError) console.error('[parking-interest] Notification status update failed:', updateError)

    return NextResponse.json({ success: true, id: saved.id }, { status: 201 })
  } catch (error) {
    console.error('[parking-interest] Unexpected submission error:', error)
    return NextResponse.json({ error: 'We could not submit your response. Please try again.' }, { status: 500 })
  }
}