/**
 * AI Service
 * Handles AI-powered features: document extraction, natural language processing
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

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
        throw new Error(data.error || 'Failed to parse natural language prompt')
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
}

export const aiService = new AIService()
export type { DocumentExtractionResponse, NaturalLanguageShipmentResponse }
