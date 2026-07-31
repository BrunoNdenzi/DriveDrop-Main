import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${API_URL}/api/v1/quick-send${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || 'Quick Send request failed')
  return body.data as T
}

export interface QuickSendConnection {
  connected: boolean
  mailbox: string
  connectedAt: string | null
}

export interface QuickSendBatch {
  id: string
  category: string
  subject: string
  status: 'queued' | 'sending' | 'completed' | 'partial_failed' | 'failed'
  total_count: number
  sent_count: number
  failed_count: number
  suppressed_count: number
  pacing_seconds: number
  created_at: string
}

export interface QuickSendRecipient {
  id: string
  email: string
  name: string | null
  status: 'pending' | 'suppressed' | 'sent' | 'failed'
  gmail_message_id: string | null
  error_message: string | null
  sent_at: string | null
}

export interface QuickSendRecipientInput {
  email: string
  name?: string
}

export function getQuickSendConnection() {
  return request<QuickSendConnection>('/connection')
}

export function getGmailAuthorizationUrl() {
  return request<{ url: string }>('/oauth/authorize', { method: 'POST' })
}

export function disconnectQuickSendGmail() {
  return request<{ connected: boolean }>('/connection', { method: 'DELETE' })
}

export function createQuickSendBatch(data: {
  category: string
  subject: string
  message: string
  recipients: QuickSendRecipientInput[]
  pacingSeconds: number
}) {
  return request<{ id: string; totalCount: number; suppressedCount: number }>('/batches', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function listQuickSendBatches() {
  return request<{ batches: QuickSendBatch[] }>('/batches?limit=50')
}

export function listQuickSendRecipients(batchId: string) {
  return request<{ recipients: QuickSendRecipient[] }>(`/batches/${batchId}/recipients`)
}