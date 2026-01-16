/**
 * AI-Powered Features Routes
 * Document extraction, natural language shipments, bulk uploads
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import { AIDocumentExtractionService } from '../services/AIDocumentExtractionService';
import { NaturalLanguageShipmentService } from '../services/NaturalLanguageShipmentService';
import { BulkUploadService } from '../services/BulkUploadService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

const aiDocService = new AIDocumentExtractionService();
const nlService = new NaturalLanguageShipmentService();
const bulkService = new BulkUploadService();

/**
 * POST /api/v1/ai/extract-document
 * Extract vehicle data from uploaded document image (registration, title, insurance)
 */
router.post('/extract-document', authMiddleware, upload.single('document'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { shipmentId, documentType } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }

    const result = await aiDocService.extractDocumentData(
      file.buffer,
      file.mimetype,
      documentType || 'registration'
    );

    // If shipment ID provided, associate with shipment
    if (shipmentId && result.extractedData) {
      await aiDocService.saveExtraction(shipmentId, {
        documentType: result.documentType,
        extractedData: result.extractedData,
        confidence: result.confidence,
        requiresReview: result.requiresReview,
        ocrText: result.ocrText,
      });
    }

    res.json({
      success: true,
      data: result.extractedData,
      confidence: result.confidence,
      requiresReview: result.requiresReview,
      lowConfidenceFields: result.lowConfidenceFields,
      message: result.requiresReview
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
router.post('/natural-language-shipment', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prompt, inputMethod = 'text' } = req.body;
    const userId = req.user?.id;

    if (!prompt) {
      return res.status(400).json({ error: 'Natural language prompt is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await nlService.createShipmentFromPrompt(prompt, userId, inputMethod);

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to parse natural language prompt',
        details: result.error,
        validationErrors: result.validationErrors,
        extractedData: result.extractedData, // Return partial data even if failed
      });
    }

    res.json({
      success: true,
      shipment: result.shipment,
      extractedData: result.extractedData,
      confidence: result.confidence,
      validationWarnings: result.validationWarnings,
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
router.post('/bulk-upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const userId = req.user?.id;

    if (!file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await bulkService.processBulkUpload(file.buffer, file.originalname, userId);

    res.json({
      success: true,
      uploadId: result.uploadId,
      totalRows: result.totalRows,
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
router.get('/bulk-upload/:uploadId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const status = await bulkService.getUploadStatus(uploadId);

    if (!status) {
      return res.status(404).json({ error: 'Upload not found' });
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
router.get('/document-queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    const queue = await aiDocService.getExtractionQueue();

    res.json({
      success: true,
      queue,
      count: queue.length,
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
router.post('/review-extraction/:extractionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { extractionId } = req.params;
    const { corrections, notes } = req.body;
    const reviewerId = req.user?.id;

    if (!reviewerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await aiDocService.reviewExtraction(extractionId, reviewerId, corrections, notes);

    res.json({
      success: true,
      message: 'Extraction reviewed and corrected successfully',
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
