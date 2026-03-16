import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import type { CarrierContact, FMCSACarrierData } from '@/types/campaigns'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function getHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  }
}

export interface ListCarriersParams {
  page?: number
  limit?: number
  state?: string
  hasEmail?: boolean
  emailVerified?: boolean
  search?: string
  contactType?: 'carrier' | 'broker' | 'dealership' | 'shipper'
}

export interface CarrierStats {
  total: number
  withEmail: number
  verified: number
  byType: Record<string, { total: number; withEmail: number; verified: number }>
}

export async function listCarriers(params: ListCarriersParams = {}): Promise<{ carriers: CarrierContact[]; total: number; page: number; limit: number }> {
  const headers = await getHeaders()
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.state) q.set('state', params.state)
  if (params.hasEmail !== undefined) q.set('hasEmail', String(params.hasEmail))
  if (params.emailVerified !== undefined) q.set('emailVerified', String(params.emailVerified))
  if (params.search) q.set('search', params.search)
  if (params.contactType) q.set('contactType', params.contactType)
  const res = await fetch(`${API_URL}/api/v1/carriers?${q}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch carriers')
  const json = await res.json()
  return json.data
}

export async function getCarrier(id: string): Promise<CarrierContact> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/${id}`, { headers })
  if (!res.ok) throw new Error('Carrier not found')
  const json = await res.json()
  return json.data
}

export async function enrichCarrier(data: FMCSACarrierData): Promise<CarrierContact> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/enrich`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Enrichment failed')
  }
  const json = await res.json()
  return json.data
}

export async function bulkEnrichCarriers(carriers: FMCSACarrierData[]): Promise<{ accepted: number; status: string }> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/enrich/bulk`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ carriers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Bulk enrichment failed')
  }
  const json = await res.json()
  return json.data
}

export async function updateCarrier(id: string, data: Partial<CarrierContact>): Promise<CarrierContact> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update carrier')
  const json = await res.json()
  return json.data
}

export async function verifyCarrierEmail(id: string): Promise<{ verified: boolean; score: number }> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/${id}/verify-email`, { method: 'POST', headers })
  if (!res.ok) throw new Error('Verification failed')
  const json = await res.json()
  return json.data
}

export async function getCarrierStats(): Promise<CarrierStats> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/stats`, { headers })
  if (!res.ok) throw new Error('Failed to fetch carrier stats')
  const json = await res.json()
  return json.data
}

export async function createContact(data: {
  contact_type: 'broker' | 'dealership' | 'shipper'
  company_name: string
  email?: string
  phone?: string
  state?: string
  city?: string
  address?: string
  zip?: string
  website?: string
}): Promise<CarrierContact> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/carriers/contact`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Failed to create contact')
  }
  const json = await res.json()
  return json.data
}
