/**
 * Carrier Contact Routes
 * Manage enriched FMCSA carrier contacts.
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/error';
import { successResponse, errorResponse } from '@utils/response';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { carrierEnrichmentService } from '@services/outreach/carrierEnrichmentService';
import { supabaseAdmin } from '@lib/supabase';
import { FMCSACarrierData } from '../types/campaigns.types';

const router = Router();
router.use(authenticate, authorize(['admin']));

/**
 * POST /carriers/enrich
 * Enrich a single carrier with email data and save.
 */
router.post(
  '/enrich',
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body as Partial<FMCSACarrierData>;
    if (!data.dotNumber || !data.companyName) {
      return res.status(400).json(errorResponse('dotNumber and companyName are required'));
    }
    const carrier: FMCSACarrierData = {
      dotNumber: data.dotNumber,
      companyName: data.companyName,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zip || '',
      operatingStatus: data.operatingStatus || 'ACTIVE',
      ...(data.mcNumber && { mcNumber: data.mcNumber }),
      ...(data.phone && { phone: data.phone }),
      ...(data.powerUnits !== undefined && { powerUnits: data.powerUnits }),
      ...(data.drivers !== undefined && { drivers: data.drivers }),
    };

    const enriched = await carrierEnrichmentService.enrichCarrier(carrier);
    if (!enriched) return res.status(404).json(errorResponse('Could not enrich carrier'));

    const id = await carrierEnrichmentService.saveCarrierContact(enriched);
    return res.json(successResponse({ ...enriched, id }));
  })
);

/**
 * POST /carriers/enrich/bulk
 * Bulk enrich multiple carriers (queued, async).
 */
router.post(
  '/enrich/bulk',
  asyncHandler(async (req: Request, res: Response) => {
    const { carriers } = req.body as { carriers?: FMCSACarrierData[] };
    if (!carriers || !Array.isArray(carriers) || carriers.length === 0) {
      return res.status(400).json(errorResponse('carriers array is required'));
    }
    if (carriers.length > 500) {
      return res.status(400).json(errorResponse('Maximum 500 carriers per bulk request'));
    }

    // Fire and forget — return immediately
    const batchSize = 10;
    carrierEnrichmentService.bulkEnrich(carriers, batchSize).catch((err: any) => {
      console.error('Bulk enrich error:', err.message);
    });

    return res.json(
      successResponse({ accepted: carriers.length, status: 'processing' })
    );
  })
);

/**
 * GET /carriers
 * List carrier contacts with filtering and pagination.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(200, parseInt((req.query['limit'] as string) || '50', 10));
    const state = req.query['state'] as string | undefined;
    const emailVerified = req.query['emailVerified'];
    const search = req.query['search'] as string | undefined;
    const hasEmail = req.query['hasEmail'];

    let query = supabaseAdmin
      .from('carrier_contacts')
      .select('*', { count: 'exact' })
      .order('enriched_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (state) query = query.eq('state', state);
    if (emailVerified === 'true') query = query.eq('email_verified', true);
    if (emailVerified === 'false') query = query.eq('email_verified', false);
    if (hasEmail === 'true') query = query.not('email', 'is', null);
    if (hasEmail === 'false') query = query.is('email', null);
    if (search) query = query.ilike('company_name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(500).json(errorResponse(error.message));
    return res.json(successResponse({ carriers: data, total: count, page, limit }));
  })
);

/**
 * GET /carriers/:id
 * Get a single carrier contact.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('carrier_contacts')
      .select('*')
      .eq('id', req.params['id'])
      .single();
    if (error || !data) return res.status(404).json(errorResponse('Carrier not found'));
    return res.json(successResponse(data));
  })
);

/**
 * PATCH /carriers/:id
 * Update a carrier contact (manual email correction, etc.).
 */
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const allowed = ['email', 'email_verified', 'phone', 'website', 'notes', 'operating_status'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabaseAdmin
      .from('carrier_contacts')
      .update(updates)
      .eq('id', req.params['id'])
      .select('*')
      .single();
    if (error) return res.status(500).json(errorResponse(error.message));
    return res.json(successResponse(data));
  })
);

/**
 * POST /carriers/:id/verify-email
 * Re-verify the email for a carrier contact.
 */
router.post(
  '/:id/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { data: carrier, error } = await supabaseAdmin
      .from('carrier_contacts')
      .select('email')
      .eq('id', req.params['id'])
      .single();
    if (error || !carrier) return res.status(404).json(errorResponse('Carrier not found'));
    if (!(carrier as any).email) return res.status(400).json(errorResponse('Carrier has no email to verify'));

    const { verified, score } = await carrierEnrichmentService.verifyEmail((carrier as any).email);
    await supabaseAdmin
      .from('carrier_contacts')
      .update({
        email_verified: verified,
        email_verification_score: score,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params['id']);

    return res.json(successResponse({ verified, score }));
  })
);

export default router;
