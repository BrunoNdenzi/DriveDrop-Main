import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drivedrop-main-production.up.railway.app/api/v1'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServiceSupabase()
    const { action, rejectionReason, driverEmail, driverFirstName, documentType } = await request.json()

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (action === 'reject' && !rejectionReason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
    }

    const docId = params.id

    // Get the requesting user to set verified_by
    const authHeader = request.headers.get('cookie') || ''
    // Use service client so we can verify the doc exists
    const { data: doc, error: fetchErr } = await supabase
      .from('driver_documents')
      .select('id, driver_id, status')
      .eq('id', docId)
      .single()

    if (fetchErr || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Update document status
    const updatePayload: Record<string, any> = {
      status: action === 'approve' ? 'approved' : 'rejected',
      verified_at: new Date().toISOString(),
      rejection_reason: action === 'reject' ? rejectionReason : null,
    }

    const { error: updateErr } = await supabase
      .from('driver_documents')
      .update(updatePayload)
      .eq('id', docId)

    if (updateErr) {
      console.error('Update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update document status' }, { status: 500 })
    }

    // Send notification email to driver via Railway/Brevo
    if (driverEmail) {
      try {
        await fetch(`${BACKEND_URL}/emails/send-document-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: driverEmail,
            firstName: driverFirstName || 'Driver',
            documentType,
            status: action === 'approve' ? 'approved' : 'rejected',
            rejectionReason: action === 'reject' ? rejectionReason : undefined,
          }),
        })
      } catch (emailErr) {
        console.error('Email notification failed (non-fatal):', emailErr)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true, status: updatePayload.status })
  } catch (error) {
    console.error('Document review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
