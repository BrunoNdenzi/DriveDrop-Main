import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

/**
 * GET /api/admin/documents
 * Fetch all driver documents using the service role client (bypasses RLS).
 * Supports optional ?status=pending|approved|rejected query param.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('driver_documents')
      .select(`
        id, driver_id, document_type, file_url, file_name,
        status, expiry_date, uploaded_at, verified_at, rejection_reason,
        profiles:driver_id ( first_name, last_name, email )
      `)
      .order('uploaded_at', { ascending: false })

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Admin Documents API] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    const docs = (data || []).map((d: any) => ({
      id: d.id,
      driver_id: d.driver_id,
      document_type: d.document_type,
      file_url: d.file_url,
      file_name: d.file_name,
      status: d.status,
      expiry_date: d.expiry_date,
      uploaded_at: d.uploaded_at,
      verified_at: d.verified_at,
      rejection_reason: d.rejection_reason,
      driver_name: d.profiles
        ? `${d.profiles.first_name || ''} ${d.profiles.last_name || ''}`.trim()
        : 'Unknown Driver',
      driver_email: d.profiles?.email || '',
    }))

    return NextResponse.json({ docs })
  } catch (error) {
    console.error('[Admin Documents API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
