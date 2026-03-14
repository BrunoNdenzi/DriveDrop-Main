/**
 * Campaign Routes
 * CRUD + lifecycle management for email campaigns.
 */
import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/error';
import { successResponse, errorResponse } from '@utils/response';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { campaignManagerService } from '@services/outreach/campaignManagerService';
import { supabaseAdmin } from '@lib/supabase';
import { emailTemplates, TemplateName } from '@services/outreach/templates/carrierOutreach';

const router = Router();

// All campaign routes require admin auth
router.use(authenticate, authorize(['admin']));

/**
 * POST /campaigns
 * Create a new campaign (draft).
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      name, subject, htmlContent, textContent, targetAudience,
      dailyLimit, scheduledAt, tags, notes, template,
    } = req.body as Record<string, any>;

    if (!name || !subject) {
      return res.status(400).json(errorResponse('name and subject are required'));
    }

    let finalHtml = htmlContent;
    let finalText = textContent;

    // If a named template was requested, generate content
    if (template && !htmlContent) {
      const tmplFn = emailTemplates[template as TemplateName];
      if (!tmplFn) return res.status(400).json(errorResponse(`Unknown template: ${template}`));
      const generated = tmplFn({ companyName: '{{companyName}}', state: '{{state}}', city: '{{city}}', unsubUrl: '{{unsubUrl}}' });
      finalHtml = generated.html;
      finalText = generated.text;
    }

    if (!finalHtml) {
      return res.status(400).json(errorResponse('htmlContent or template is required'));
    }

    const campaign = await campaignManagerService.createCampaign({
      name,
      subject,
      htmlContent: finalHtml,
      ...(finalText && { textContent: finalText }),
      ...(targetAudience && { targetAudience }),
      ...(dailyLimit && { dailyLimit: Number(dailyLimit) }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt as string) }),
      ...(tags && { tags }),
      ...(notes && { notes }),
      createdBy: (req as any).user?.id || 'admin',
    });

    return res.status(201).json(successResponse(campaign));
  })
);

/**
 * GET /campaigns
 * List all campaigns with pagination.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(100, parseInt((req.query['limit'] as string) || '20', 10));
    const status = req.query['status'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    let query = supabaseAdmin
      .from('email_campaigns')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query;
    if (error) return res.status(500).json(errorResponse(error.message));

    return res.json(successResponse({ campaigns: data, total: count, page, limit }));
  })
);

/**
 * GET /campaigns/:id
 * Get a single campaign.
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .select('*')
      .eq('id', req.params['id'])
      .single();
    if (error || !data) return res.status(404).json(errorResponse('Campaign not found'));
    return res.json(successResponse(data));
  })
);

/**
 * PATCH /campaigns/:id
 * Update campaign (only allowed in draft/paused status).
 */
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', req.params['id'])
      .single();
    if (fetchErr || !existing) return res.status(404).json(errorResponse('Campaign not found'));
    if (!['draft', 'paused', 'scheduled'].includes((existing as any).status)) {
      return res.status(409).json(errorResponse(`Cannot edit campaign in status: ${(existing as any).status}`));
    }

    const allowed = ['name', 'subject', 'html_content', 'text_content', 'target_audience',
      'daily_limit', 'scheduled_at', 'tags', 'notes', 'warmup_mode'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // camelCase support
    if (req.body['htmlContent'] !== undefined) updates['html_content'] = req.body['htmlContent'];
    if (req.body['textContent'] !== undefined) updates['text_content'] = req.body['textContent'];
    if (req.body['targetAudience'] !== undefined) updates['target_audience'] = req.body['targetAudience'];
    if (req.body['dailyLimit'] !== undefined) updates['daily_limit'] = req.body['dailyLimit'];
    if (req.body['scheduledAt'] !== undefined) updates['scheduled_at'] = req.body['scheduledAt'];
    if (req.body['warmupMode'] !== undefined) updates['warmup_mode'] = req.body['warmupMode'];

    const { data, error } = await supabaseAdmin
      .from('email_campaigns')
      .update(updates)
      .eq('id', req.params['id'])
      .select('*')
      .single();
    if (error) return res.status(500).json(errorResponse(error.message));
    return res.json(successResponse(data));
  })
);

/**
 * POST /campaigns/:id/start
 * Start or resume a campaign.
 */
router.post(
  '/:id/start',
  asyncHandler(async (req: Request, res: Response) => {
    const startId = req.params['id']!;
    await campaignManagerService.startCampaign(startId);
    return res.json(successResponse({ campaignId: startId, status: 'sending' }));
  })
);

/**
 * POST /campaigns/:id/pause
 * Pause an active campaign.
 */
router.post(
  '/:id/pause',
  asyncHandler(async (req: Request, res: Response) => {
    const pauseId = req.params['id']!;
    await campaignManagerService.pauseCampaign(pauseId);
    return res.json(successResponse({ campaignId: pauseId, status: 'paused' }));
  })
);

/**
 * DELETE /campaigns/:id
 * Delete a draft campaign (not allowed if active/completed).
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { data: existing } = await supabaseAdmin
      .from('email_campaigns')
      .select('status')
      .eq('id', req.params['id'])
      .single();
    if (!existing) return res.status(404).json(errorResponse('Campaign not found'));
    if ((existing as any).status === 'sending') {
      return res.status(409).json(errorResponse('Cannot delete a running campaign — pause it first'));
    }

    const { error } = await supabaseAdmin
      .from('email_campaigns')
      .delete()
      .eq('id', req.params['id']);
    if (error) return res.status(500).json(errorResponse(error.message));
    return res.json(successResponse(null));
  })
);

/**
 * GET /campaigns/:id/stats
 * Get computed stats for a campaign.
 */
router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await campaignManagerService.getCampaignStats(req.params['id']!);
    return res.json(successResponse(stats));
  })
);

/**
 * GET /campaigns/:id/recipients
 * List recipients for a campaign with pagination.
 */
router.get(
  '/:id/recipients',
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(200, parseInt((req.query['limit'] as string) || '50', 10));
    const status = req.query['status'] as string | undefined;

    let query = supabaseAdmin
      .from('campaign_recipients')
      .select('*, carrier_contacts(company_name, state, email)', { count: 'exact' })
      .eq('campaign_id', req.params['id'])
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return res.status(500).json(errorResponse(error.message));
    return res.json(successResponse({ recipients: data, total: count, page, limit }));
  })
);

/**
 * POST /campaigns/:id/test
 * Send a test email to a specified address.
 */
router.post(
  '/:id/test',
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json(errorResponse('email is required'));

    const { data: camp } = await supabaseAdmin
      .from('email_campaigns')
      .select('subject, html_content, text_content')
      .eq('id', req.params['id'])
      .single();
    if (!camp) return res.status(404).json(errorResponse('Campaign not found'));

    const { brevoOutreachService } = await import('@services/outreach/brevoOutreachService');
    const result = await brevoOutreachService.send({
      to: { email },
      subject: `[TEST] ${(camp as any).subject}`,
      htmlContent: (camp as any).html_content,
      ...((camp as any).text_content && { textContent: (camp as any).text_content }),
      campaignId: req.params['id'],
      dryRun: false, // Test sends are real
    });

    if (!result.success) return res.status(502).json(errorResponse(result.error || 'Send failed'));
    return res.json(successResponse({ messageId: result.messageId }));
  })
);

export default router;
