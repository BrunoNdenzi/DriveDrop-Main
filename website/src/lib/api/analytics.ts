import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import type { AnalyticsOverview, TimeSeriesPoint, GeoDataPoint, DeviceDataPoint, FunnelStep, LeaderboardEntry, CampaignPerformance } from '@/types/campaigns'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function getHeaders(): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  }
}

export async function getOverview(): Promise<AnalyticsOverview> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/analytics/overview`, { headers })
  if (!res.ok) throw new Error('Failed to fetch overview')
  const json = await res.json()
  return json.data
}

export async function getCampaignPerformance(id: string): Promise<CampaignPerformance> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/analytics/campaigns/${id}/performance`, { headers })
  if (!res.ok) throw new Error('Failed to fetch performance')
  const json = await res.json()
  return json.data
}

export async function getTimeline(id?: string, days = 30): Promise<TimeSeriesPoint[]> {
  const headers = await getHeaders()
  const url = id
    ? `${API_URL}/api/v1/analytics/campaigns/${id}/timeline?days=${days}`
    : `${API_URL}/api/v1/analytics/timeline?days=${days}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch timeline')
  const json = await res.json()
  return json.data ?? []
}

export async function getGeography(id?: string): Promise<GeoDataPoint[]> {
  const headers = await getHeaders()
  const url = id
    ? `${API_URL}/api/v1/analytics/campaigns/${id}/geography`
    : `${API_URL}/api/v1/analytics/geography`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch geography')
  const json = await res.json()
  return json.data ?? []
}

export async function getDevices(id?: string): Promise<DeviceDataPoint[]> {
  const headers = await getHeaders()
  const url = id
    ? `${API_URL}/api/v1/analytics/campaigns/${id}/devices`
    : `${API_URL}/api/v1/analytics/devices`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch devices')
  const json = await res.json()
  return json.data ?? []
}

export async function getFunnel(id?: string): Promise<FunnelStep[]> {
  const headers = await getHeaders()
  const url = id
    ? `${API_URL}/api/v1/analytics/campaigns/${id}/funnel`
    : `${API_URL}/api/v1/analytics/funnel`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error('Failed to fetch funnel')
  const json = await res.json()
  return json.data ?? []
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}/api/v1/analytics/leaderboard?limit=${limit}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  const json = await res.json()
  return json.data
}

export async function exportReport(campaignId?: string, format: 'json' | 'csv' = 'csv'): Promise<Blob> {
  const headers = await getHeaders()
  const id = campaignId || 'all'
  const res = await fetch(`${API_URL}/api/v1/analytics/export/${id}?format=${format}`, { headers })
  if (!res.ok) throw new Error('Failed to export report')
  return res.blob()
}
