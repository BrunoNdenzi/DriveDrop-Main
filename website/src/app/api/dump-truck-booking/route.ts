import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { getServiceSupabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'infos@calkons.com'
const EASTERN_TIME_ZONE = 'America/New_York'
const CUTOFF_MINUTES = 13 * 60 + 30

const submissionSchema = z.object({
  customerType: z.enum(['Individual', 'Business', 'Government agency', 'Prime contractor', 'Subcontractor', 'Other']),
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().max(160).optional().default(''),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  projectType: z.enum(['NCDOT', 'State or local government', 'SAM.gov / federal', 'Commercial construction', 'Residential construction', 'Land development', 'Other']),
  projectName: z.string().trim().max(180).optional().default(''),
  solicitationNumber: z.string().trim().max(120).optional().default(''),
  trucksNeeded: z.coerce.number().int().min(1).max(100),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.enum(['Up to 4 hours', 'Full day', 'Multiple days', 'Ongoing / recurring', 'Not sure yet']),
  estimatedDays: z.union([z.literal(''), z.coerce.number().int().min(1).max(365)]).optional().default(''),
  jobSiteAddress: z.string().trim().min(5).max(300),
  dumpSiteAddress: z.string().trim().max(300).optional().default(''),
  materialType: z.enum(['Dirt / soil', 'Aggregate / stone', 'Asphalt', 'Concrete', 'Demolition debris', 'Clearing debris', 'Other']),
  estimatedLoadsPerDay: z.union([z.literal(''), z.coerce.number().int().min(1).max(1000)]).optional().default(''),
  loadingMethod: z.string().trim().max(160).optional().default(''),
  siteRequirements: z.string().trim().max(2000).optional().default(''),
  complianceRequirements: z.array(z.string().trim().min(1).max(100)).max(8).optional().default([]),
  purchaseOrderAvailable: z.boolean().optional().default(false),
  additionalDetails: z.string().trim().max(3000).optional().default(''),
  contactConsent: z.literal('true'),
  website: z.string().max(0).optional().default(''),
})

function getEasternNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  }
}

function previousCalendarDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}

function meetsBookingCutoff(serviceDate: string, now = new Date()) {
  const easternNow = getEasternNowParts(now)
  const cutoffDate = previousCalendarDate(serviceDate)
  return easternNow.date < cutoffDate || (easternNow.date === cutoffDate && easternNow.minutes <= CUTOFF_MINUTES)
}

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
  phone: string
  trucksNeeded: number
  serviceDate: string
  startTime: string
  duration: string
  jobSiteAddress: string
  materialType: string
}) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  const signingKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!backendUrl || !signingKey) throw new Error('Backend URL or server signing key is not configured')

  const body = JSON.stringify(payload)
  const timestamp = Date.now().toString()
  const signature = createHmac('sha256', signingKey).update(`${timestamp}.${body}`).digest('hex')
  const response = await fetch(`${backendUrl}/sms/dump-truck-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Parking-Timestamp': timestamp,
      'X-Parking-Signature': signature,
    },
    body,
  })

  if (!response.ok) throw new Error(`Backend SMS request failed (${response.status}): ${await response.text()}`)
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
    if (!meetsBookingCutoff(submission.serviceDate)) {
      return NextResponse.json({
        error: 'Requests must be submitted by 1:30 PM ET on the calendar day before service. Please choose a later date or call 704-266-2317.',
      }, { status: 400 })
    }

    const companyName = submission.companyName || 'Individual request'
    const supabase = getServiceSupabase()
    const { data: saved, error: insertError } = await supabase
      .from('dump_truck_booking_requests')
      .insert({
        customer_type: submission.customerType,
        full_name: submission.fullName,
        company_name: submission.companyName || null,
        email: submission.email.toLowerCase(),
        phone: submission.phone,
        project_type: submission.projectType,
        project_name: submission.projectName || null,
        solicitation_number: submission.solicitationNumber || null,
        trucks_needed: submission.trucksNeeded,
        service_date: submission.serviceDate,
        start_time: submission.startTime,
        duration: submission.duration,
        estimated_days: submission.estimatedDays === '' ? null : submission.estimatedDays,
        job_site_address: submission.jobSiteAddress,
        dump_site_address: submission.dumpSiteAddress || null,
        material_type: submission.materialType,
        estimated_loads_per_day: submission.estimatedLoadsPerDay === '' ? null : submission.estimatedLoadsPerDay,
        loading_method: submission.loadingMethod || null,
        site_requirements: submission.siteRequirements || null,
        compliance_requirements: submission.complianceRequirements,
        purchase_order_available: submission.purchaseOrderAvailable,
        additional_details: submission.additionalDetails || null,
        contact_consent: true,
      })
      .select('id')
      .single()

    if (insertError || !saved) {
      console.error('[dump-truck-booking] Database insert failed:', insertError)
      return NextResponse.json({ error: 'We could not save your request. Please try again.' }, { status: 500 })
    }

    const safe = Object.fromEntries(Object.entries({
      fullName: submission.fullName,
      companyName,
      customerType: submission.customerType,
      email: submission.email,
      phone: submission.phone,
      projectType: submission.projectType,
      projectName: submission.projectName || 'Not provided',
      solicitationNumber: submission.solicitationNumber || 'Not provided',
      serviceDate: submission.serviceDate,
      startTime: submission.startTime,
      duration: submission.duration,
      estimatedDays: submission.estimatedDays === '' ? 'Not provided' : String(submission.estimatedDays),
      jobSiteAddress: submission.jobSiteAddress,
      dumpSiteAddress: submission.dumpSiteAddress || 'Not provided',
      materialType: submission.materialType,
      estimatedLoadsPerDay: submission.estimatedLoadsPerDay === '' ? 'Not provided' : String(submission.estimatedLoadsPerDay),
      loadingMethod: submission.loadingMethod || 'Not provided',
      compliance: submission.complianceRequirements.join(', ') || 'None selected',
      purchaseOrder: submission.purchaseOrderAvailable ? 'Yes' : 'No',
      siteRequirements: submission.siteRequirements || 'None provided',
      additionalDetails: submission.additionalDetails || 'None provided',
    }).map(([key, value]) => [key, escapeHtml(value)])) as Record<string, string>

    const row = (label: string, value: string) => `<tr><td style="padding:8px 0;color:#64748b;width:35%;vertical-align:top">${label}</td><td style="padding:8px 0">${value}</td></tr>`
    const emailPromise = sendEmail({
      to: ADMIN_EMAIL,
      subject: `Dump truck request: ${submission.trucksNeeded} truck${submission.trucksNeeded === 1 ? '' : 's'} on ${submission.serviceDate} - ${companyName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#1e293b;line-height:1.6">
        <div style="background:#173436;color:#fff;padding:24px 28px"><div style="font-size:13px;color:#5eead4;text-transform:uppercase;letter-spacing:1px">Benji Operations Alert</div><h1 style="font-size:24px;margin:8px 0 0">New dump truck booking request</h1></div>
        <div style="padding:28px;border:1px solid #dbe5e4;border-top:0">
          <p><strong>${safe.companyName}</strong> requests <strong>${submission.trucksNeeded} dump truck${submission.trucksNeeded === 1 ? '' : 's'}</strong> for ${safe.serviceDate} at ${safe.startTime}.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:20px">
            ${row('Contact', safe.fullName)}${row('Customer type', safe.customerType)}${row('Email', `<a href="mailto:${safe.email}">${safe.email}</a>`)}${row('Phone', `<a href="tel:${safe.phone}">${safe.phone}</a>`)}
            ${row('Project type', safe.projectType)}${row('Project name', safe.projectName)}${row('Solicitation / contract', safe.solicitationNumber)}${row('Trucks requested', String(submission.trucksNeeded))}
            ${row('Service date / start', `${safe.serviceDate} at ${safe.startTime}`)}${row('Duration', safe.duration)}${row('Estimated days', safe.estimatedDays)}${row('Job site', safe.jobSiteAddress)}${row('Dump site', safe.dumpSiteAddress)}
            ${row('Material', safe.materialType)}${row('Loads per day', safe.estimatedLoadsPerDay)}${row('Loading method', safe.loadingMethod)}${row('Compliance', safe.compliance)}${row('PO available', safe.purchaseOrder)}
            ${row('Site requirements', safe.siteRequirements.replaceAll('\n', '<br>'))}${row('Additional details', safe.additionalDetails.replaceAll('\n', '<br>'))}
          </table><p style="margin-top:24px;font-size:12px;color:#64748b">Request ID: ${saved.id}. This is a request pending availability and written confirmation.</p>
        </div></div>`,
    })

    const smsPromise = sendAdminSms({
      fullName: submission.fullName,
      companyName,
      phone: submission.phone,
      trucksNeeded: submission.trucksNeeded,
      serviceDate: submission.serviceDate,
      startTime: submission.startTime,
      duration: submission.duration,
      jobSiteAddress: submission.jobSiteAddress,
      materialType: submission.materialType,
    })

    const [emailResult, smsResult] = await Promise.allSettled([emailPromise, smsPromise])
    const emailSent = emailResult.status === 'fulfilled'
    const smsSent = smsResult.status === 'fulfilled'
    if (!emailSent) console.error('[dump-truck-booking] Admin email failed:', emailResult.reason)
    if (!smsSent) console.error('[dump-truck-booking] Admin SMS failed:', smsResult.reason)

    const { error: updateError } = await supabase
      .from('dump_truck_booking_requests')
      .update({
        email_notification_status: emailSent ? 'sent' : 'failed',
        sms_notification_status: smsSent ? 'sent' : 'failed',
        notification_attempted_at: new Date().toISOString(),
      })
      .eq('id', saved.id)
    if (updateError) console.error('[dump-truck-booking] Notification status update failed:', updateError)

    return NextResponse.json({ success: true, id: saved.id }, { status: 201 })
  } catch (error) {
    console.error('[dump-truck-booking] Unexpected submission error:', error)
    return NextResponse.json({ error: 'We could not submit your request. Please try again or call 704-266-2317.' }, { status: 500 })
  }
}
