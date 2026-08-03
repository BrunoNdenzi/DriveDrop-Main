import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${API_URL}/quick-send${path}`, {
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

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const supabase = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${API_URL}/quick-send${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: formData,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.message || 'Quick Send request failed')
  return body.data as T
}

// =====================================================
// Type Definitions
// =====================================================
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
  custom_fields?: Record<string, string>
}

export interface QuickSendRecipientInput {
  email: string
  name?: string
  customFields?: Record<string, string>
}

export interface TemplateField {
  fieldName: string
  label: string
  required: boolean
  fallback?: string
}

export interface Template {
  id: string
  name: string
  category: string
  subject: string
  message: string
  description?: string
  fieldMappings: TemplateField[]
  isSystem: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
  useCount: number
}

export interface ParsedRecipient {
  email: string
  name?: string
  customFields: Record<string, string>
  isValid: boolean
  validationError?: string
}

export interface ParseResult {
  recipients: ParsedRecipient[]
  validCount: number
  invalidCount: number
  duplicateCount: number
  fieldNames: string[]
}

export interface AIGenerationResult {
  subject?: string
  body?: string
  variations?: Array<{ subject: string; body: string }>
  tokensUsed: number
}

// =====================================================
// Connection Management
// =====================================================
export function getQuickSendConnection() {
  return request<QuickSendConnection>('/connection')
}

export function getGmailAuthorizationUrl() {
  return request<{ url: string }>('/oauth/authorize', { method: 'POST' })
}

export function disconnectQuickSendGmail() {
  return request<{ connected: boolean }>('/connection', { method: 'DELETE' })
}

// =====================================================
// Template Management
// =====================================================
export function listTemplates(category?: string) {
  const query = category ? `?category=${encodeURIComponent(category)}` : ''
  return request<{ templates: Template[] }>(`/templates${query}`)
}

export function getTemplate(id: string) {
  return request<{ template: Template }>(`/templates/${id}`)
}

export function createTemplate(data: {
  name: string
  category: string
  subject: string
  message: string
  description?: string
  fieldMappings?: TemplateField[]
}) {
  return request<{ template: Template }>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTemplate(id: string, data: Partial<{
  name: string
  category: string
  subject: string
  message: string
  description?: string
  fieldMappings?: TemplateField[]
}>) {
  return request<{ template: Template }>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteTemplate(id: string) {
  return request<{ deleted: boolean }>(`/templates/${id}`, { method: 'DELETE' })
}

export function cloneTemplate(id: string) {
  return request<{ template: Template }>(`/templates/${id}/clone`, { method: 'POST' })
}

export function getTemplateCategories() {
  return request<{ categories: string[] }>('/templates/categories')
}

// =====================================================
// AI Content Generation
// =====================================================
export function generateContent(data: {
  type: 'subject' | 'body' | 'both' | 'rewrite' | 'variations'
  prompt?: string
  subject?: string
  body?: string
  tone?: 'professional' | 'friendly' | 'urgent' | 'sales' | 'casual'
  category?: string
  variations?: number
}) {
  return request<AIGenerationResult>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function suggestPersonalization(content: string) {
  return request<{ fields: string[] }>('/ai/suggest-personalization', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

// =====================================================
// Recipient Parsing
// =====================================================
export function parseTextInput(text: string) {
  return request<ParseResult>('/parse/text', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function extractEmails(content: string) {
  return request<ParseResult>('/parse/extract', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function parseCSV(file: File, mapping?: any) {
  const formData = new FormData()
  formData.append('file', file)
  if (mapping) {
    formData.append('mapping', JSON.stringify(mapping))
  }
  return uploadRequest<ParseResult>('/parse/csv', formData)
}

export function getCSVColumns(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return uploadRequest<{ columns: string[] }>('/parse/csv/columns', formData)
}

// =====================================================
// Batch Management
// =====================================================
export function createQuickSendBatch(data: {
  category: string
  subject: string
  message: string
  recipients: QuickSendRecipientInput[]
  pacingSeconds: number
  templateId?: string
  fieldMappings?: Record<string, string>
  sourceType?: 'manual' | 'csv' | 'database'
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