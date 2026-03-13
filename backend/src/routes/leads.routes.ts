/**
 * Lead Acquisition Routes (Admin only)
 * Handles lead management, FMCSA imports, CSV uploads, campaigns
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { authorize } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import { leadAcquisitionService } from '@services/LeadAcquisitionService';
import { parse } from 'csv-parse/sync';

const router = Router();

// All routes require admin auth
router.use(authenticate);
router.use(authorize(['admin']));

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await leadAcquisitionService.getLeadStats();
  res.json(successResponse(stats));
}));

// ============================================
// LEADS CRUD
// ============================================

// List leads with filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    page, limit, status, lead_type, source, state,
    min_score, search, sort_by, sort_dir, campaign_id,
  } = req.query;

  const parsedPage = page ? parseInt(page as string) : undefined;
  const parsedLimit = limit ? parseInt(limit as string) : undefined;
  const parsedMinScore = min_score ? parseInt(min_score as string) : undefined;

  const result = await leadAcquisitionService.getLeads({
    ...(parsedPage !== undefined && { page: parsedPage }),
    ...(parsedLimit !== undefined && { limit: parsedLimit }),
    ...(status && { status: status as string }),
    ...(lead_type && { leadType: lead_type as string }),
    ...(source && { source: source as string }),
    ...(state && { state: state as string }),
    ...(parsedMinScore !== undefined && { minScore: parsedMinScore }),
    ...(search && { search: search as string }),
    ...(sort_by && { sortBy: sort_by as string }),
    ...(sort_dir && { sortDir: sort_dir as 'asc' | 'desc' }),
    ...(campaign_id && { campaignId: campaign_id as string }),
  });

  res.json(successResponse(result.leads, {
    page: result.page,
    limit: parsedLimit || 25,
    total: result.total,
    totalPages: result.totalPages,
  }));
}));

// Create a single lead
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const lead = await leadAcquisitionService.upsertLead(req.body, req.user?.id);
  res.status(201).json(successResponse(lead));
}));

// Update a lead
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const lead = await leadAcquisitionService.upsertLead(
    { ...req.body, id: req.params['id'] },
    req.user?.id
  );
  res.json(successResponse(lead));
}));

// Update lead status
router.patch('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { status, notes } = req.body;
  const lead = await leadAcquisitionService.updateLeadStatus(req.params['id']!, status, notes);
  res.json(successResponse(lead));
}));

// Bulk update status
router.patch('/bulk/status', asyncHandler(async (req: Request, res: Response) => {
  const { lead_ids, status } = req.body;
  if (!Array.isArray(lead_ids) || !status) {
    res.status(400).json({ success: false, error: { message: 'lead_ids and status required' } });
    return;
  }
  const result = await leadAcquisitionService.bulkUpdateStatus(lead_ids, status);
  res.json(successResponse(result));
}));

// Delete leads
router.delete('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const { lead_ids } = req.body;
  if (!Array.isArray(lead_ids)) {
    res.status(400).json({ success: false, error: { message: 'lead_ids required' } });
    return;
  }
  const result = await leadAcquisitionService.deleteLeads(lead_ids);
  res.json(successResponse(result));
}));

// ============================================
// FMCSA IMPORT
// ============================================

// Search FMCSA (preview before import)
router.get('/fmcsa/search', asyncHandler(async (req: Request, res: Response) => {
  const { state, city, entity_type, page, size } = req.query;
  const parsedPage = page ? parseInt(page as string) : undefined;
  const parsedSize = size ? parseInt(size as string) : undefined;

  const result = await leadAcquisitionService.searchFMCSA({
    ...(state && { state: state as string }),
    ...(city && { city: city as string }),
    ...(entity_type && { entityType: entity_type as string }),
    ...(parsedPage !== undefined && { page: parsedPage }),
    ...(parsedSize !== undefined && { size: parsedSize }),
  });
  res.json(successResponse(result));
}));

// Lookup single FMCSA carrier by DOT number
router.get('/fmcsa/lookup/:dotNumber', asyncHandler(async (req: Request, res: Response) => {
  const carrier = await leadAcquisitionService.lookupFMCSAByDOT(req.params['dotNumber']!);
  if (!carrier) {
    res.status(404).json({ success: false, error: { message: 'Carrier not found' } });
    return;
  }
  res.json(successResponse(carrier));
}));

// Import FMCSA carriers as leads
router.post('/fmcsa/import', asyncHandler(async (req: Request, res: Response) => {
  const { state, city, entity_type, max_records } = req.body;
  const result = await leadAcquisitionService.importFMCSALeads({
    ...(state && { state }),
    ...(city && { city }),
    ...(entity_type && { entityType: entity_type }),
    maxRecords: max_records || 100,
    createdBy: req.user?.id,
  });
  res.json(successResponse(result));
}));

// ============================================
// CSV IMPORT
// ============================================

// Import leads from CSV (expects raw CSV text in body)
router.post('/csv/import', asyncHandler(async (req: Request, res: Response) => {
  const { csv_data, lead_type, column_mapping } = req.body;
  
  if (!csv_data || !lead_type || !column_mapping) {
    res.status(400).json({ 
      success: false, 
      error: { message: 'csv_data, lead_type, and column_mapping are required' } 
    });
    return;
  }

  // Parse CSV
  let records: Record<string, string>[];
  try {
    records = parse(csv_data, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: `CSV parse error: ${err.message}` },
    });
    return;
  }

  const userId = req.user?.id;
  const result = await leadAcquisitionService.importCSVLeads({
    records,
    leadType: lead_type,
    columnMapping: column_mapping,
    ...(userId && { createdBy: userId }),
  });

  res.json(successResponse(result));
}));

// ============================================
// CAMPAIGNS
// ============================================

router.get('/campaigns', asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;
  const parsedPage = page ? parseInt(page as string) : undefined;
  const parsedLimit = limit ? parseInt(limit as string) : undefined;

  const result = await leadAcquisitionService.getCampaigns({
    ...(status && { status: status as string }),
    ...(parsedPage !== undefined && { page: parsedPage }),
    ...(parsedLimit !== undefined && { limit: parsedLimit }),
  });
  res.json(successResponse(result.campaigns, { total: result.total }));
}));

router.post('/campaigns', asyncHandler(async (req: Request, res: Response) => {
  const campaign = await leadAcquisitionService.createCampaign({
    ...req.body,
    created_by: req.user?.id,
  });
  res.status(201).json(successResponse(campaign));
}));

// ============================================
// IMPORT JOBS
// ============================================

router.get('/imports', asyncHandler(async (req: Request, res: Response) => {
  const jobs = await leadAcquisitionService.getImportJobs(
    parseInt(req.query['limit'] as string) || 20
  );
  res.json(successResponse(jobs));
}));

export default router;
