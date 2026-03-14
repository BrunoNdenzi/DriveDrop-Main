import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import type { Campaign, CampaignStats, CampaignRecipient } from '@/types/campaigns'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function getHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  }
}

export interface ListCampaignsParams {
  page?: number
  limit?: number
  status?: string
  search?: string
}

export interface ListCampaignsResult {
  campaigns: Campaign[]
  total: number
  page: number
  limit: number
}

export async function listCampaigns(params: ListCampaignsParams = {}): Promise<ListCampaignsResult> {
  const headers = await getHeaders()
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.status) q.set('status', params.status)
  if (params.search) q.set('search', params.search)
  const res = await fetch(`${API_URL}/api/v1/campaigns?${q}`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.statusText}`)
  const json = await res.json()
  return json.data
}

export async function getCampaign(id: string): Promise<Campaign> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}`, { headers })
  if (!res.ok) throw new Error(`Campaign not found`)
  const json = await res.json()
  return json.data
}

export interface CreateCampaignData {
  name: string
  subject: string
  htmlContent?: string
  textContent?: string
  template?: string
  targetAudience?: object
  dailyLimit?: number
  scheduledAt?: string
  tags?: string[]
  notes?: string
  warmupMode?: boolean
}

export async function createCampaign(data: CreateCampaignData): Promise<Campaign> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Failed to create campaign')
  }
  const json = await res.json()
  return json.data
}

export async function updateCampaign(id: string, data: Partial<CreateCampaignData>): Promise<Campaign> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update campaign')
  const json = await res.json()
  return json.data
}

export async function deleteCampaign(id: string): Promise<void> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Failed to delete campaign')
}

export async function startCampaign(id: string): Promise<void> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}/start`, { method: 'POST', headers })
  if (!res.ok) throw new Error('Failed to start campaign')
}

export async function pauseCampaign(id: string): Promise<void> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}/pause`, { method: 'POST', headers })
  if (!res.ok) throw new Error('Failed to pause campaign')
}

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}/stats`, { headers })
  if (!res.ok) throw new Error('Failed to fetch campaign stats')
  const json = await res.json()
  return json.data
}

export interface GetRecipientsParams {
  page?: number
  limit?: number
  status?: string
}

export async function getCampaignRecipients(id: string, params: GetRecipientsParams = {}): Promise<{ recipients: CampaignRecipient[]; total: number; page: number; limit: number }> {
  const headers = await getHeaders()
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.status) q.set('status', params.status)
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}/recipients?${q}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch recipients')
  const json = await res.json()
  return json.data
}

export async function sendTestEmail(id: string, email: string): Promise<void> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/campaigns/${id}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error('Failed to send test email')
}
