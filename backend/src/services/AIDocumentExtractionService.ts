/**
 * AI Document Extraction Service
 * 
 * Automatically extracts structured data from vehicle shipping documents using OCR + AI.
 * 
 * Features:
 * - OCR processing (Google Cloud Vision or AWS Textract)
 * - GPT-4 structured data extraction
 * - Confidence scoring (0.00 - 1.00)
 * - Human review queue for low-confidence extractions (<0.85)
 * - Support for multiple document types (Bill of Sale, Title, Insurance, Inspection Report)
 * - Batch processing capability
 * 
 * Workflow:
 * 1. Document uploaded → Added to extraction queue
 * 2. OCR extracts text from image/PDF
 * 3. GPT-4 parses text into structured JSON
 * 4. Confidence score calculated
 * 5. High confidence (≥0.85) → Auto-approve
 *    Low confidence (<0.85) → Human review queue
 */

import { createClient } from '@supabase/supabase-js';
import { createChatCompletion } from '@benji/ai/client/openai.client';
import {
  getDocumentOcrSystemPrompt,
  getDocumentOcrUserText,
  getDocumentExtractionSystemPrompt,
  buildExtractionUserContent,
} from '@benji/ai/prompt.registry';
import { FEATURE_FLAGS } from '../config/features';
import { SERVICE_MODEL_MAP, aiUsageTracker } from '../config/ai.config';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

// OpenAI client is now the shared singleton from @benji/ai/openai.client

export interface DocumentUpload {
  shipment_id: string;
  document_type: 'bill_of_sale' | 'title' | 'insurance' | 'inspection_report' | 'other';
  file_url: string;
  uploaded_by: string;
}

export interface ExtractedData {
  vehicle_info?: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    color?: string;
    mileage?: number;
    license_plate?: string;
  };
  seller_info?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  buyer_info?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  sale_info?: {
    sale_date?: string;
    sale_price?: number;
    payment_method?: string;
  };
  insurance_info?: {
    policy_number?: string;
    provider?: string;
    coverage_amount?: number;
    expiration_date?: string;
  };
  inspection_info?: {
    inspection_date?: string;
    inspector_name?: string;
    pass_status?: boolean;
    notes?: string;
  };
}

export interface ExtractionResult {
  success: boolean;
  extracted_data?: ExtractedData;
  confidence_score?: number;
  requires_review?: boolean;
  ocr_text?: string;
  error?: string;
}

export class AIDocumentExtractionService {
  /**
   * Add document to extraction queue
   */
  async queueDocument(upload: DocumentUpload): Promise<{
    success: boolean;
    queue_id?: string;
    error?: string;
  }> {
    // Check feature flag
    if (!FEATURE_FLAGS.AI_DOCUMENT_EXTRACTION) {
      return {
        success: false,
        error: 'AI document extraction feature is not enabled',
      };
    }

    try {
      const { data, error } = await supabase
        .from('document_extraction_queue')
        .insert({
          shipment_id: upload.shipment_id,
          document_type: upload.document_type,
          document_url: upload.file_url,
          uploaded_by: upload.uploaded_by,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Start processing asynchronously (in production, use job queue)
      this.processDocument(data.id).catch(err => 
        console.error('Background processing error:', err)
      );

      return {
        success: true,
        queue_id: data.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process document: OCR → GPT-4 extraction → confidence scoring
   */
  async processDocument(queueId: string): Promise<ExtractionResult> {
    try {
      // Get queue item
      const { data: queueItem, error: fetchError } = await supabase
        .from('document_extraction_queue')
        .select('*')
        .eq('id', queueId)
        .single();

      if (fetchError || !queueItem) {
        throw new Error('Queue item not found');
      }

      // Update status to processing
      await supabase
        .from('document_extraction_queue')
        .update({ status: 'processing', processing_started_at: new Date().toISOString() })
        .eq('id', queueId);

      // Step 1: OCR - Extract text from document
      const ocrText = await this.performOCR(queueItem.document_url);

      // Step 2: GPT-4 - Extract structured data
      const extractionResult = await this.extractStructuredData(
        ocrText,
        queueItem.document_type
      );

      // Step 3: Calculate confidence score
      const confidenceScore = this.calculateConfidence(extractionResult.extracted_data, ocrText);

      // Step 4: Determine if human review needed
      const requiresReview = confidenceScore < 0.85;

      // Update queue with results
      await supabase
        .from('document_extraction_queue')
        .update({
          status: requiresReview ? 'requires_review' : 'completed',
          ocr_text: ocrText,
          extracted_data: extractionResult.extracted_data,
          confidence_score: confidenceScore,
          requires_human_review: requiresReview,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return {
        success: true,
        extracted_data: extractionResult.extracted_data,
        confidence_score: confidenceScore,
        requires_review: requiresReview,
        ocr_text: ocrText,
      };
    } catch (error: any) {
      // Update queue with error
      await supabase
        .from('document_extraction_queue')
        .update({
          status: 'failed',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Perform OCR and extraction on document using GPT-4o Vision
   * Combines OCR + extraction in one API call for efficiency
   */
  private async performOCR(documentUrl: string): Promise<string> {
    try {
      if (!process.env['OPENAI_API_KEY']) {
        throw new Error('OpenAI API key not configured');
      }

      const modelConfig = SERVICE_MODEL_MAP['document-ocr'];
      console.log(`Processing document with ${modelConfig.model} Vision: ${documentUrl}`);

      const startTime = Date.now();

      // Use GPT-4o Vision to extract text from the image
      const response = await createChatCompletion({
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: getDocumentOcrSystemPrompt(),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: getDocumentOcrUserText(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: documentUrl,
                  detail: 'high', // Use high detail for better OCR accuracy
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }, { serviceName: 'document-ocr' });

      const durationMs = Date.now() - startTime;

      // Track token usage
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || 0;
      const estimatedCost = aiUsageTracker.calculateCost(promptTokens, completionTokens, modelConfig);

      aiUsageTracker.track({
        service: 'document-ocr',
        model: modelConfig.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        timestamp: new Date().toISOString(),
        durationMs,
      });

      const extractedText = response.choices[0]?.message?.content || '';
      
      if (!extractedText) {
        throw new Error('No text extracted from document');
      }

      console.log(`Extracted ${extractedText.length} characters from document`);
      return extractedText;
    } catch (error: any) {
      console.error('OCR error:', error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract structured data using GPT-4
   */
  private async extractStructuredData(
    ocrText: string,
    documentType: string
  ): Promise<{ extracted_data: ExtractedData }> {
    try {
      if (!process.env['OPENAI_API_KEY']) {
        throw new Error('OpenAI API key not configured');
      }

      const modelConfig = SERVICE_MODEL_MAP['document-extraction'];
      console.log(`Extracting structured data from ${documentType} document using ${modelConfig.model}`);

      const startTime = Date.now();

      const completion = await createChatCompletion({
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: getDocumentExtractionSystemPrompt(documentType),
          },
          {
            role: 'user',
            content: buildExtractionUserContent(ocrText),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1500,
      }, { serviceName: 'document-extraction' });

      const durationMs = Date.now() - startTime;

      // Track token usage
      const promptTokens = completion.usage?.prompt_tokens || 0;
      const completionTokens = completion.usage?.completion_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;
      const estimatedCost = aiUsageTracker.calculateCost(promptTokens, completionTokens, modelConfig);

      aiUsageTracker.track({
        service: 'document-extraction',
        model: modelConfig.model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        timestamp: new Date().toISOString(),
        durationMs,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4');
      }

      const extracted = JSON.parse(content) as ExtractedData;
      console.log(`Extracted data:`, JSON.stringify(extracted, null, 2));
      
      return { extracted_data: extracted };
    } catch (error: any) {
      console.error('Structured extraction error:', error);
      throw new Error(`Extraction failed: ${error.message}`);
    }
  }

  /**
   * Calculate confidence score based on extracted data completeness
   */
  private calculateConfidence(extractedData: ExtractedData | undefined, ocrText: string): number {
    if (!extractedData) return 0.0;

    let score = 0.0;
    let totalFields = 0;
    let filledFields = 0;

    // Check vehicle info completeness
    if (extractedData.vehicle_info) {
      const vehicleFields = ['vin', 'year', 'make', 'model'];
      vehicleFields.forEach(field => {
        totalFields++;
        if (extractedData.vehicle_info && (extractedData.vehicle_info as any)[field]) {
          filledFields++;
        }
      });
    }

    // Check seller info completeness
    if (extractedData.seller_info) {
      const sellerFields = ['name', 'address'];
      sellerFields.forEach(field => {
        totalFields++;
        if (extractedData.seller_info && (extractedData.seller_info as any)[field]) {
          filledFields++;
        }
      });
    }

    // Check buyer info completeness
    if (extractedData.buyer_info) {
      const buyerFields = ['name', 'address'];
      buyerFields.forEach(field => {
        totalFields++;
        if (extractedData.buyer_info && (extractedData.buyer_info as any)[field]) {
          filledFields++;
        }
      });
    }

    // Base score from field completeness
    if (totalFields > 0) {
      score = filledFields / totalFields;
    }

    // Boost score if VIN is present and valid (17 characters)
    if (extractedData.vehicle_info?.vin && extractedData.vehicle_info.vin.length === 17) {
      score = Math.min(1.0, score + 0.15);
    }

    // Penalize if OCR text is very short (likely poor quality scan)
    if (ocrText.length < 100) {
      score *= 0.7;
    }

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Get documents pending human review
   */
  async getReviewQueue(filters: {
    limit?: number;
    offset?: number;
  }): Promise<{ documents: any[]; count: number }> {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const { data, error, count } = await supabase
      .from('document_extraction_queue')
      .select('*', { count: 'exact' })
      .eq('requires_human_review', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching review queue:', error);
      return { documents: [], count: 0 };
    }

    return {
      documents: data || [],
      count: count || 0,
    };
  }

  /**
   * Approve extraction after human review
   */
  async approveExtraction(
    queueId: string,
    correctedData?: ExtractedData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: any = {
        status: 'completed',
        requires_human_review: false,
        reviewed_at: new Date().toISOString(),
      };

      if (correctedData) {
        updates.extracted_data = correctedData;
        updates.confidence_score = 1.0; // Human-verified = 100% confidence
      }

      await supabase
        .from('document_extraction_queue')
        .update(updates)
        .eq('id', queueId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject extraction
   */
  async rejectExtraction(
    queueId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase
        .from('document_extraction_queue')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', queueId);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get extraction statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    requires_review: number;
    failed: number;
    average_confidence: number;
  }> {
    const { data } = await supabase
      .from('document_extraction_queue')
      .select('status, confidence_score');

    if (!data || data.length === 0) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        requires_review: 0,
        failed: 0,
        average_confidence: 0,
      };
    }

    const stats = {
      total: data.length,
      pending: data.filter((d: any) => d.status === 'pending').length,
      processing: data.filter((d: any) => d.status === 'processing').length,
      completed: data.filter((d: any) => d.status === 'completed').length,
      requires_review: data.filter((d: any) => d.status === 'requires_review').length,
      failed: data.filter((d: any) => d.status === 'failed').length,
      average_confidence: 0,
    };

    const confidenceScores = data
      .filter((d: any) => d.confidence_score !== null)
      .map((d: any) => d.confidence_score);

    if (confidenceScores.length > 0) {
      stats.average_confidence = 
        confidenceScores.reduce((sum: number, score: number) => sum + score, 0) / 
        confidenceScores.length;
    }

    return stats;
  }
}

export default AIDocumentExtractionService;
