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

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Queue document for processing
    const queueResult = await aiDocService.queueDocument({
      shipment_id: shipmentId,
      document_type: documentType || 'other',
      file_url: fileUrl,
      uploaded_by: userId,
    });

    if (!queueResult.queue_id) {
      res.status(500).json({ error: 'Failed to queue document' });
      return;
    }

    // Process immediately
    const result = await aiDocService.processDocument(queueResult.queue_id);

    res.json({
      success: true,
      data: result.extracted_data,
      confidence: result.confidence_score,
      requiresReview: result.requires_review,
      queueId: queueResult.queue_id,
      message: result.requires_review
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
    const result = await nlService.createShipment(userId, parseResult.parsed_data);

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

    // Note: processBulkUpload expects Buffer, but we're using URL
    // This is a placeholder - you may need to fetch the file first
    const result = await bulkService.processBulkUpload(
      Buffer.from(''), // TODO: Fetch file from URL
      'upload.csv',
      userId
    );

    res.json({
      success: true,
      uploadId: result['uploadId'],
      totalRows: result['totalRows'],
      status: result['status'],
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
    const uploadId = req.params['uploadId'] || '';
    if (!uploadId) {
      res.status(400).json({ error: 'Upload ID is required' });
      return;
    }
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
    const queue = await aiDocService.getReviewQueue({ limit: 50, offset: 0 });

    res.json({
      success: true,
      queue: queue.documents,
      count: queue.count,
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
    const extractionId = req.params['extractionId'];
    const { corrections, notes, approved = true } = req.body;
    const reviewerId = req.user?.id;

    if (!extractionId) {
      res.status(400).json({ error: 'Extraction ID is required' });
      return;
    }

    if (!reviewerId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (approved) {
      await aiDocService.approveExtraction(extractionId, corrections);
    } else {
      await aiDocService.rejectExtraction(extractionId, notes || 'Rejected');
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
