/**
 * AI Service
 * Handles AI-powered features: document extraction, natural language processing
 */

const PRODUCTION_API_BASE_URL = 'https://drivedrop-main-production.up.railway.app/api/v1'

const resolveApiBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  // Keep local development behavior while avoiding broken production calls.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api/v1'
    }
  }

  return PRODUCTION_API_BASE_URL
}

const API_BASE_URL = resolveApiBaseUrl()

interface DocumentExtractionResponse {
  success: boolean
  data: {
    vin?: string
    year?: number
    make?: string
    model?: string
    color?: string
    licensePlate?: string
    registrationExpiry?: string
    ownerName?: string
    ownerAddress?: string
  }
  confidence: number
  requiresReview: boolean
  lowConfidenceFields: string[]
  message: string
}

interface NaturalLanguageShipmentResponse {
  success: boolean
  shipment_id?: string
  shipment?: {
    id: string
    vehicle_year: number
    vehicle_make: string
    vehicle_model: string
    vehicle_vin?: string
    pickup_address: string
    delivery_address: string
    pickup_date?: string
    is_operable: boolean
    estimated_price: number
  }
  extractedData: {
    vehicle: {
      year: number
      make: string
      model: string
      vin?: string
    }
    pickup: {
      location: string
      date?: string
    }
    delivery: {
      location: string
      date?: string
    }
    urgency: 'expedited' | 'standard' | 'flexible'
  }
  confidence: number
  validationWarnings: string[]
  message: string
  error?: string
  validationErrors?: string[]
}

interface BulkUploadResponse {
  success: boolean
  uploadId: string
  totalRows: number
  status: string
  message: string
}

interface BulkUploadStatus {
  success: boolean
  upload: {
    id: string
    file_name: string
    total_rows: number
    processed_rows: number
    successful_rows: number
    failed_rows: number
    status: string
    progress_percent: number
    created_shipment_ids: string[]
    errors: any[]
  }
}

/** Response shape from POST /api/v1/benji/chat and POST /api/v1/benji/chat/confirm */
interface BenjiChatResponse {
  success: boolean
  traceId?: string
  state?: 'COMPLETE' | 'BLOCKED' | 'AWAIT_CONFIRMATION'
  response?: string
  /** Present when state === 'AWAIT_CONFIRMATION' */
  confirmationPayload?: {
    traceId: string
    riskScore: number
    planSummary: string[]
    message: string
  }
  /** Present when a shipment was created (tool:shipment.create output) */
  shipmentCreated?: {
    shipment_id: string
    estimatedPrice: number
    distanceMiles: number
    vehicle: string
    pickupAddress: string
    deliveryAddress: string
  }
  error?: string
}

/** Metrics returned by GET /api/v1/benji/metrics */
export interface BenjiMetrics {
  windowDays: number
  computedAt: string
  averageOrchestrationLatencyMs: number | null
  toolFailureRates: Array<{
    toolName: string
    totalCalls: number
    failedCalls: number
    failureRate: number
  }>
  policyViolationCounts: Array<{
    ruleId: string
    count: number
    severity: string
  }>
  confirmationAcceptanceRate: number | null
  simulationBlockRate: number | null
  totalTraces: number
  completedTraces: number
  blockedTraces: number
}

/** Single trace row from GET /api/v1/benji/traces */
export interface BenjiTrace {
  trace_id: string
  user_id: string
  intent: string | null
  state: string
  final_outcome: string | null
  started_at: string
  completed_at: string | null
  step_count: number
}

/** Single step from GET /api/v1/benji/traces/:traceId/steps */
export interface BenjiTraceStep {
  step_id: string
  tool_name: string | null
  success: boolean | null
  input_hash: string | null
  output_hash: string | null
  timestamp: string
}

class AIService {
  private async getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null
    
    // Try to get token from Supabase session
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      console.log('🔐 Auth Debug:', {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        tokenPreview: session?.access_token ? `${session.access_token.substring(0, 20)}...` : 'none',
        error: error?.message
      })
      
      return session?.access_token || null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }

  private async getHeaders(includeContentType: boolean = true): Promise<HeadersInit> {
    const token = await this.getAuthToken()
    const headers: HeadersInit = {}
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
  }

  /**
   * Extract vehicle data from uploaded document image
   */
  async extractDocument(
    file: File,
    documentType: 'registration' | 'title' | 'insurance' | 'bill_of_sale' = 'registration',
    shipmentId?: string
  ): Promise<DocumentExtractionResponse> {
    try {
      // Import supabase client
      const { getSupabaseBrowserClient } = await import('@/lib/supabase-client')
      const supabase = getSupabaseBrowserClient()

      // Step 1: Upload file to Supabase storage
      const fileName = `${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`ai-extractions/${fileName}`, file, {
          contentType: file.type,
          upsert: false
        })

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`)
      }

      // Step 2: Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(`ai-extractions/${fileName}`)

      const fileUrl = urlData.publicUrl

      // Step 3: Send URL to backend for AI extraction
      const response = await fetch(`${API_BASE_URL}/ai/extract-document`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({
          fileUrl,
          documentType,
          shipmentId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to extract document')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Document extraction error:', error)
      throw error
    }
  }

  /**
   * Create shipment from natural language prompt
   */
  async createShipmentFromPrompt(
    prompt: string,
    inputMethod: 'text' | 'voice' | 'email' | 'whatsapp' | 'sms' = 'text'
  ): Promise<NaturalLanguageShipmentResponse> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/ai/natural-language-shipment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, inputMethod })
      })

      const data = await response.json()

      if (!response.ok) {
        const validationErrors = Array.isArray(data.validationErrors)
          ? data.validationErrors.join(', ')
          : ''
        const clarificationQuestions = Array.isArray(data.clarificationQuestions)
          ? data.clarificationQuestions.join(' ')
          : ''

        const details = [validationErrors, clarificationQuestions].filter(Boolean).join(' ')
        throw new Error(details ? `${data.error || 'Failed to parse natural language prompt'}: ${details}` : (data.error || 'Failed to parse natural language prompt'))
      }

      return data
    } catch (error: any) {
      console.error('Natural language shipment error:', error)
      throw error
    }
  }

  /**
   * Upload CSV file with multiple shipments
   */
  async bulkUpload(file: File): Promise<BulkUploadResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = await this.getAuthToken()
      const response = await fetch(`${API_BASE_URL}/ai/bulk-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload CSV')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Bulk upload error:', error)
      throw error
    }
  }

  /**
   * Check status of bulk upload
   */
  async getBulkUploadStatus(uploadId: string): Promise<BulkUploadStatus> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/ai/bulk-upload/${uploadId}`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to get upload status')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Get bulk upload status error:', error)
      throw error
    }
  }

  /**
   * Get pending document extractions queue
   */
  async getDocumentQueue(): Promise<any> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/ai/document-queue`, {
        headers
      })

      if (!response.ok) {
        throw new Error('Failed to get document queue')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Get document queue error:', error)
      throw error
    }
  }

  /**
   * Review and correct AI extraction
   */
  async reviewExtraction(
    extractionId: string,
    corrections: Record<string, any>,
    notes: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/ai/review-extraction/${extractionId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ corrections, notes })
      })

      if (!response.ok) {
        throw new Error('Failed to review extraction')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Review extraction error:', error)
      throw error
    }
  }

  /**
   * Benji Chat - Send message and get AI response
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: {
      userType?: 'client' | 'driver' | 'admin' | 'broker'
      currentPage?: string
      shipmentId?: string
      attachments?: Array<{ name: string; url: string; type: string; size: number }>
    }
  ): Promise<{
    success: boolean
    message: string
    confidence: number
    suggestions?: string[]
    timestamp: string
  }> {
    try {
      const headers = await this.getHeaders()
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, context })
      })

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      return await response.json()
    } catch (error: any) {
      console.error('Benji chat error:', error)
      throw error
    }
  }

  /**
   * Benji V2 Chat — send a message to the Benji V2 orchestrator.
   *
   * A 200 response means the request completed (COMPLETE state).
   * A 202 response means the orchestrator is awaiting user confirmation
   * before executing a mutation (e.g. creating a shipment). In that case
   * `confirmationPayload` is present and the caller should prompt the user
   * to confirm, then call `benjiConfirm()`.
   */
  async benjiChat(
    message: string,
    context?: {
      userType?: 'client' | 'driver' | 'admin' | 'broker'
      currentPage?: string
      shipmentId?: string
    }
  ): Promise<BenjiChatResponse> {
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}/benji/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, ...context }),
    })

    const data: BenjiChatResponse = await response.json()

    if (!response.ok && response.status !== 202) {
      throw new Error((data as any).error ?? 'Benji chat request failed')
    }

    return data
  }

  /**
   * Benji V2 Confirm — resume a suspended plan after user approval.
   *
   * Pass `confirmed: true` to proceed or `confirmed: false` to cancel.
   * Returns a final BenjiChatResponse (state: COMPLETE or BLOCKED).
   */
  async benjiConfirm(traceId: string, confirmed: boolean): Promise<BenjiChatResponse> {
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}/benji/chat/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ traceId, confirmed }),
    })

    const data: BenjiChatResponse = await response.json()

    if (!response.ok) {
      throw new Error((data as any).error ?? 'Benji confirm request failed')
    }

    return data
  }

  /**
   * Benji QA — send a message with optional role simulation override.
   * Admin-only: `_qaUserType` is accepted only when BENJI_QA_CONSOLE is enabled
   * and the caller is an admin.
   */
  async benjiQaChat(
    message: string,
    qaUserType: 'client' | 'driver' | 'admin' | 'broker',
    context?: { currentPage?: string; shipmentId?: string },
  ): Promise<BenjiChatResponse> {
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}/benji/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, _qaUserType: qaUserType, ...context }),
    })

    const data: BenjiChatResponse = await response.json()

    if (!response.ok && response.status !== 202) {
      throw new Error((data as any).error ?? 'Benji QA chat request failed')
    }

    return data
  }

  /**
   * Benji QA — fetch the 7-day rolling metrics (admin only).
   */
  async getBenjiMetrics(): Promise<BenjiMetrics> {
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}/benji/metrics`, { headers })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).error ?? 'Failed to fetch Benji metrics')
    }
    return response.json()
  }

  /**
   * Benji QA — fetch recent traces (admin only, requires BENJI_QA_CONSOLE flag).
   */
  async getBenjiTraces(limit = 20, userId?: string): Promise<BenjiTrace[]> {
    const headers = await this.getHeaders()
    const params = new URLSearchParams({ limit: String(limit) })
    if (userId) params.set('userId', userId)
    const response = await fetch(`${API_BASE_URL}/benji/traces?${params.toString()}`, { headers })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).error ?? 'Failed to fetch Benji traces')
    }
    const data = await response.json()
    return (data.traces ?? []) as BenjiTrace[]
  }

  /**
   * Benji QA — fetch steps for a specific trace (admin only).
   */
  async getBenjiTraceSteps(traceId: string): Promise<BenjiTraceStep[]> {
    const headers = await this.getHeaders()
    const response = await fetch(`${API_BASE_URL}/benji/traces/${encodeURIComponent(traceId)}/steps`, { headers })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as any).error ?? 'Failed to fetch trace steps')
    }
    const data = await response.json()
    return (data.steps ?? []) as BenjiTraceStep[]
  }
}

export const aiService = new AIService()
export type { DocumentExtractionResponse, NaturalLanguageShipmentResponse, BenjiChatResponse }