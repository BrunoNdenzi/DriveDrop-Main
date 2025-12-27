/**
 * Bill of Lading API Routes
 * 
 * Endpoints for managing Bills of Lading (legal transport documents).
 * 
 * Routes:
 * - POST   /api/bol                    - Create new BOL
 * - GET    /api/bol                    - List BOLs with filters
 * - GET    /api/bol/:id                - Get BOL details
 * - GET    /api/bol/shipment/:id       - Get BOL by shipment ID
 * - PATCH  /api/bol/:id                - Update BOL
 * - POST   /api/bol/:id/condition      - Record vehicle condition
 * - POST   /api/bol/:id/signature      - Add signature
 * - PATCH  /api/bol/:id/status         - Update BOL status
 * - GET    /api/bol/:id/pdf            - Generate PDF
 */

import { Router, Request, Response } from 'express';
import BOLService from '../services/BOLService';
import { FEATURE_FLAGS } from '../config/features';

const router = Router();
const bolService = new BOLService();

/**
 * Middleware: Check if BOL feature is enabled
 */
const checkBOLFeature = (_req: Request, res: Response, next: Function): void => {
  if (!FEATURE_FLAGS.BOL_SYSTEM) {
    res.status(403).json({
      error: 'BOL system feature is not enabled',
      feature: 'BOL_SYSTEM',
    });
    return;
  }
  next();
};

/**
 * Middleware: Verify authentication (placeholder)
 */
const requireAuth = async (req: Request, res: Response, next: Function): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - Missing token' });
    return;
  }

  // TODO: Verify JWT and extract user info
  next();
};

/**
 * POST /api/bol
 * Create new Bill of Lading
 */
router.post('/', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const bolData = req.body;

    // Validate data
    const validation = bolService.validateBOLData(bolData);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid BOL data',
        validation_errors: validation.errors,
      });
      return;
    }

    // Create BOL
    const result = await bolService.createBOL(bolData);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to create BOL',
        details: result.error,
      });
      return;
    }

    res.status(201).json({
      success: true,
      bol: result.bol,
    });
  } catch (error: any) {
    console.error('Error creating BOL:', error);
    res.status(500).json({
      error: 'Failed to create BOL',
      details: error.message,
    });
  }
});

/**
 * GET /api/bol
 * List Bills of Lading with filters
 */
router.get('/', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, commercial_account_id, date_from, date_to, limit, offset } = req.query;

    const filters: {
      status?: string;
      commercial_account_id?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
      offset?: number;
    } = {};

    if (status) filters.status = status as string;
    if (commercial_account_id) filters.commercial_account_id = commercial_account_id as string;
    if (date_from) filters.date_from = date_from as string;
    if (date_to) filters.date_to = date_to as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const result = await bolService.listBOLs(filters);

    res.json({
      success: true,
      bols: result.bols,
      pagination: {
        total: result.count,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
      },
    });
  } catch (error: any) {
    console.error('Error listing BOLs:', error);
    res.status(500).json({
      error: 'Failed to list BOLs',
      details: error.message,
    });
  }
});

/**
 * GET /api/bol/:id
 * Get BOL details
 */
router.get('/:id', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }

    const bol = await bolService.getBOL(id);

    if (!bol) {
      res.status(404).json({ error: 'BOL not found' });
      return;
    }

    // Check if BOL is complete
    const isComplete = await bolService.isComplete(id);

    res.json({
      success: true,
      bol: {
        ...bol,
        is_complete: isComplete,
      },
    });
  } catch (error: any) {
    console.error('Error fetching BOL:', error);
    res.status(500).json({
      error: 'Failed to fetch BOL',
      details: error.message,
    });
  }
});

/**
 * GET /api/bol/shipment/:id
 * Get BOL by shipment ID
 */
router.get('/shipment/:id', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Shipment ID is required' });
      return;
    }

    const bol = await bolService.getBOLByShipment(id);

    if (!bol) {
      res.status(404).json({ error: 'BOL not found for this shipment' });
      return;
    }

    res.json({
      success: true,
      bol,
    });
  } catch (error: any) {
    console.error('Error fetching BOL by shipment:', error);
    res.status(500).json({
      error: 'Failed to fetch BOL',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/bol/:id
 * Update BOL
 */
router.patch('/:id', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }
    const updates = req.body;

    // Validate updates
    const validation = bolService.validateBOLData(updates);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid BOL data',
        validation_errors: validation.errors,
      });
      return;
    }

    const result = await bolService.updateBOL(id, updates);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to update BOL',
        details: result.error,
      });
      return;
    }

    res.json({
      success: true,
      bol: result.bol,
    });
  } catch (error: any) {
    console.error('Error updating BOL:', error);
    res.status(500).json({
      error: 'Failed to update BOL',
      details: error.message,
    });
  }
});

/**
 * POST /api/bol/:id/condition
 * Record vehicle condition (pickup or delivery inspection)
 */
router.post('/:id/condition', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }
    const conditionData = req.body;

    // Validate required fields
    if (!conditionData.inspection_type || !conditionData.inspector_name) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['inspection_type', 'inspector_name'],
      });
      return;
    }

    // Validate inspection type
    if (!['pickup', 'delivery'].includes(conditionData.inspection_type)) {
      res.status(400).json({
        error: 'Invalid inspection_type',
        valid_types: ['pickup', 'delivery'],
      });
      return;
    }

    const result = await bolService.recordCondition({
      bol_id: id,
      ...conditionData,
      inspection_date: conditionData.inspection_date || new Date().toISOString(),
    });

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to record condition',
        details: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Vehicle condition recorded successfully',
    });
  } catch (error: any) {
    console.error('Error recording condition:', error);
    res.status(500).json({
      error: 'Failed to record condition',
      details: error.message,
    });
  }
});

/**
 * POST /api/bol/:id/signature
 * Add digital signature to BOL
 */
router.post('/:id/signature', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }
    const { signer_type, signer_name, signature_data } = req.body;

    // Validate required fields
    if (!signer_type || !signer_name || !signature_data) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['signer_type', 'signer_name', 'signature_data'],
      });
      return;
    }

    // Validate signer type
    if (!['shipper', 'driver', 'consignee'].includes(signer_type)) {
      res.status(400).json({
        error: 'Invalid signer_type',
        valid_types: ['shipper', 'driver', 'consignee'],
      });
      return;
    }

    const result = await bolService.addSignature({
      bol_id: id,
      signer_type,
      signer_name,
      signature_data,
      signed_at: new Date().toISOString(),
    });

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to add signature',
        details: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Signature added successfully',
    });
  } catch (error: any) {
    console.error('Error adding signature:', error);
    res.status(500).json({
      error: 'Failed to add signature',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/bol/:id/status
 * Update BOL status
 */
router.patch('/:id/status', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }
    const { status } = req.body;

    // Validate status
    const validStatuses = ['draft', 'issued', 'in_transit', 'delivered', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        error: 'Invalid status',
        valid_statuses: validStatuses,
      });
      return;
    }

    const result = await bolService.updateStatus(id, status);

    if (!result.success) {
      res.status(500).json({
        error: 'Failed to update status',
        details: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating status:', error);
    res.status(500).json({
      error: 'Failed to update status',
      details: error.message,
    });
  }
});

/**
 * GET /api/bol/:id/pdf
 * Generate and download BOL as PDF
 */
router.get('/:id/pdf', checkBOLFeature, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'BOL ID is required' });
      return;
    }

    const result = await bolService.generatePDF(id);

    if (!result.success || !result.pdf) {
      res.status(500).json({
        error: 'Failed to generate PDF',
        details: result.error,
      });
      return;
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="BOL-${id}.pdf"`);
    res.send(result.pdf);
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message,
    });
  }
});

export default router;
