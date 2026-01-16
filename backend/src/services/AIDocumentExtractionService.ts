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
// @ts-ignore - Used when AI document extraction is enabled
import OpenAI from 'openai';
import { FEATURE_FLAGS } from '../config/features';

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

// TODO: Initialize OpenAI after package install
/*
const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});
*/

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
   * Perform OCR on document
   * TODO: Implement with Google Cloud Vision or AWS Textract after package install
   */
  private async performOCR(documentUrl: string): Promise<string> {
    // Placeholder implementation
    // In production, integrate with:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision

    console.log(`OCR processing: ${documentUrl}`);

    // TODO: Actual OCR implementation
    /*
    // Example with Google Cloud Vision:
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();
    
    const [result] = await client.textDetection(documentUrl);
    const detections = result.textAnnotations;
    const text = detections[0]?.description || '';
    
    return text;
    */

    // Temporary placeholder
    return `[OCR PLACEHOLDER - Install Google Cloud Vision or AWS Textract]
Document URL: ${documentUrl}
Note: This would contain the actual extracted text from the document.`;
  }

  /**
   * Extract structured data using GPT-4
   */
  private async extractStructuredData(
    ocrText: string,
    documentType: string
  ): Promise<{ extracted_data: ExtractedData }> {
    // TODO: Implement with OpenAI GPT-4 after package install
    /*
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a document extraction specialist for vehicle shipping documents.
Extract structured data from the OCR text into JSON format.
Document type: ${documentType}
Always return valid JSON with these possible fields:
- vehicle_info: {vin, year, make, model, color, mileage, license_plate}
- seller_info: {name, address, phone, email}
- buyer_info: {name, address, phone, email}
- sale_info: {sale_date, sale_price, payment_method}
- insurance_info: {policy_number, provider, coverage_amount, expiration_date}
- inspection_info: {inspection_date, inspector_name, pass_status, notes}
Only include fields you can confidently extract.`,
        },
        {
          role: 'user',
          content: `Extract data from this OCR text:\n\n${ocrText}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistency
    });

    const extracted = JSON.parse(completion.choices[0].message.content || '{}');
    return { extracted_data: extracted };
    */

    // Placeholder implementation
    console.log(`GPT-4 extraction for ${documentType}: ${ocrText.substring(0, 100)}...`);

    // Return placeholder data
    const placeholderData: ExtractedData = {
      vehicle_info: {
        vin: 'PLACEHOLDER_VIN',
        year: 2020,
        make: 'PLACEHOLDER',
        model: 'NEEDS_GPT4',
      },
    };

    return { extracted_data: placeholderData };
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
