import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// Always fetch live data — never cache
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

/**
 * GET /api/admin/documents
 * Fetch all driver documents using the service role client (bypasses RLS).
 * Uses two separate queries to avoid PostgREST join silently dropping rows.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Step 1: fetch documents (no join — joins can silently drop rows)
    let docsQuery = supabase
      .from('driver_documents')
      .select('id, driver_id, document_type, file_url, file_name, status, expiry_date, uploaded_at, verified_at, rejection_reason')
      .order('uploaded_at', { ascending: false })

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      docsQuery = docsQuery.eq('status', status)
    }

    const { data: rawDocs, error: docsError } = await docsQuery

    if (docsError) {
      console.error('[Admin Documents API] Fetch error:', docsError)
      return NextResponse.json(
        { error: 'Failed to fetch documents', detail: docsError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      )
    }

    if (!rawDocs || rawDocs.length === 0) {
      return NextResponse.json({ docs: [] }, { headers: NO_CACHE_HEADERS })
    }

    // Step 2: fetch profiles for all unique driver_ids
    const driverIds = [...new Set(rawDocs.map((d: any) => d.driver_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', driverIds)

    const profileMap: Record<string, any> = {}
    for (const p of profiles || []) {
      profileMap[p.id] = p
    }

    // Step 3: merge
    const docs = rawDocs.map((d: any) => {
      const profile = profileMap[d.driver_id]
      return {
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
        driver_name: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : 'Unknown Driver',
        driver_email: profile?.email || '',
      }
    })

    return NextResponse.json({ docs }, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    console.error('[Admin Documents API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS })
  }
}
