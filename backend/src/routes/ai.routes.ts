/**
 * AI-Powered Features Routes
 * Document extraction, natural language shipments, bulk uploads
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { AIDocumentExtractionService } from '../services/AIDocumentExtractionService';
import { NaturalLanguageShipmentService } from '../services/NaturalLanguageShipmentService';
import { BulkUploadService } from '../services/BulkUploadService';

const router = Router();

const aiDocService = new AIDocumentExtractionService();
const nlService = new NaturalLanguageShipmentService();
const bulkService = new BulkUploadService();

/**
 * POST /api/v1/ai/extract-document
 * Extract vehicle data from uploaded document image (registration, title, insurance)
 */
router.post('/extract-document', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileUrl, documentType, shipmentId } = req.body;

    if (!fileUrl) {
      res.status(400).json({ error: 'Document file URL is required' });
      return;
    }

    // Queue document for processing
    const queueResult = await aiDocService.queueDocument({
      shipment_id: shipmentId,
      document_type: documentType || 'other',
      file_url: fileUrl,
      uploaded_by: req.user?.id || '',
    });

    // Process immediately
    const result = await aiDocService.processDocument(queueResult.queue_id);

    res.json({
      success: true,
      data: result.extracted_data,
      confidence: result.confidence_score,
      requiresReview: result.review_status === 'pending',
      queueId: queueResult.queue_id,
      message: result.review_status === 'pending'
        ? 'Document extracted but requires human review due to low confidence'
        : 'Document extracted successfully',
    });
  } catch (error: any) {
    console.error('Document extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract document data',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/natural-language-shipment
 * Create shipment from natural language prompt
 * Example: "Ship my 2023 Honda Civic from Los Angeles to New York next week"
 */
router.post('/natural-language-shipment', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, inputMethod = 'text' } = req.body;
    const userId = req.user?.id;

    if (!prompt) {
      res.status(400).json({ error: 'Natural language prompt is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Parse the prompt
    const parseResult = await nlService.parseShipment({
      user_id: userId,
      input_text: prompt,
      input_method: inputMethod as any,
    });

    if (!parseResult.success || !parseResult.parsed_data) {
      res.status(400).json({
        error: 'Failed to parse natural language prompt',
        details: 'Could not extract shipment data from prompt',
      });
      return;
    }

    // Create the shipment
    const result = await nlService.createShipment(parseResult.parsed_data, userId);

    res.json({
      success: true,
      shipment: result,
      extractedData: parseResult.parsed_data,
      confidence: parseResult.confidence_score,
      message: 'Shipment created successfully from natural language',
    });
  } catch (error: any) {
    console.error('Natural language shipment error:', error);
    res.status(500).json({
      error: 'Failed to create shipment from natural language',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/bulk-upload
 * Upload CSV file with multiple shipments
 */
router.post('/bulk-upload', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileUrl } = req.body;
    const userId = req.user?.id;

    if (!fileUrl) {
      res.status(400).json({ error: 'CSV file URL is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await bulkService.startBulkUpload(fileUrl, userId);

    res.json({
      success: true,
      uploadId: result.upload_id,
      status: result.status,
      message: 'Bulk upload started successfully',
    });
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      error: 'Failed to process bulk upload',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/ai/bulk-upload/:uploadId
 * Check status of bulk upload
 */
router.get('/bulk-upload/:uploadId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { uploadId } = req.params;
    const status = await bulkService.getUploadStatus(uploadId);

    if (!status) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    res.json({
      success: true,
      upload: status,
    });
  } catch (error: any) {
    console.error('Get bulk upload status error:', error);
    res.status(500).json({
      error: 'Failed to get upload status',
      details: error.message,
    });
  }
});

/**
 * GET /api/v1/ai/document-queue
 * Get pending documents waiting for AI extraction
 */
router.get('/document-queue', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    const queue = await aiDocService.getReviewQueue({ status: 'pending' });

    res.json({
      success: true,
      queue: queue.items,
      count: queue.total,
    });
  } catch (error: any) {
    console.error('Get document queue error:', error);
    res.status(500).json({
      error: 'Failed to get document queue',
      details: error.message,
    });
  }
});

/**
 * POST /api/v1/ai/review-extraction/:extractionId
 * Human review and correction of AI extraction
 */
router.post('/review-extraction/:extractionId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { extractionId } = req.params;
    const { corrections, notes, approved = true } = req.body;
    const reviewerId = req.user?.id;

    if (!reviewerId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (approved) {
      await aiDocService.approveExtraction(extractionId, reviewerId, corrections);
    } else {
      await aiDocService.rejectExtraction(extractionId, reviewerId, notes || 'Rejected');
    }

    res.json({
      success: true,
      message: 'Extraction reviewed successfully',
    });
  } catch (error: any) {
    console.error('Review extraction error:', error);
    res.status(500).json({
      error: 'Failed to review extraction',
      details: error.message,
    });
  }
});

export default router;
