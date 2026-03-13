/**
 * Outreach Routes (Admin only)
 * POST /api/v1/outreach/search  — Find contacts for a company
 * POST /api/v1/outreach/verify  — Verify email(s)
 * POST /api/v1/outreach/send    — Send campaign email (respects daily limit)
 * GET  /api/v1/outreach/stats   — Warmup & delivery stats
 */
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { asyncHandler } from '@utils/error';
import { successResponse } from '@utils/response';
import { outreachOrchestrator } from '@services/outreach/outreachOrchestrator';

const router = Router();

router.use(authenticate);
router.use(authorize(['admin']));

// ----------------------------------------------------------------
// GET /stats — delivery stats, warmup status, daily quota
// ----------------------------------------------------------------
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await outreachOrchestrator.getStats();
  res.json(successResponse(stats));
}));

// ----------------------------------------------------------------
// POST /search — find contacts for a company/domain
// Body: { companyName, domain?, state?, targetTitles? }
// ----------------------------------------------------------------
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const { companyName, domain, state, targetTitles } = req.body;

  if (!companyName) {
    res.status(400).json({ success: false, error: { message: 'companyName is required' } });
    return;
  }

  const contacts = await outreachOrchestrator.findContacts({
    companyName,
    ...(domain && { domain }),
    ...(state && { state }),
    ...(Array.isArray(targetTitles) && { targetTitles }),
  });

  res.json(successResponse({ contacts, total: contacts.length }));
}));

// ----------------------------------------------------------------
// POST /verify — verify one or many email addresses
// Body: { email } — single
//   OR: { emails: string[] } — batch (up to 100)
// ----------------------------------------------------------------
router.post('/verify', asyncHandler(async (req: Request, res: Response) => {
  const { email, emails, source } = req.body;

  if (email) {
    // Single
    const result = await outreachOrchestrator.verifyEmail({ email, source });
    res.json(successResponse(result));
    return;
  }

  if (Array.isArray(emails) && emails.length > 0) {
    if (emails.length > 100) {
      res.status(400).json({ success: false, error: { message: 'Maximum 100 emails per batch' } });
      return;
    }
    const results = await outreachOrchestrator.verifyBatch(emails);
    res.json(successResponse({ results, total: results.length, safe: results.filter(r => r.safe).length }));
    return;
  }

  res.status(400).json({ success: false, error: { message: 'Provide "email" (single) or "emails" array (batch)' } });
}));

// ----------------------------------------------------------------
// POST /enrich — enrich a company profile
// Body: { name, domain?, state? }
// ----------------------------------------------------------------
router.post('/enrich', asyncHandler(async (req: Request, res: Response) => {
  const { name, domain, state } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: { message: 'name is required' } });
    return;
  }

  const result = await outreachOrchestrator.enrichCompany({
    name,
    ...(domain && { domain }),
    ...(state && { state }),
  });

  res.json(successResponse(result));
}));

// ----------------------------------------------------------------
// POST /send — send a campaign email (rate-limited + warmup-gated)
// Body: { campaignId, leadId, to: {email, name?}, subject, htmlContent, textContent?, replyTo? }
// ----------------------------------------------------------------
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const { campaignId, leadId, to, subject, htmlContent, textContent, replyTo } = req.body;

  if (!campaignId || !leadId || !to?.email || !subject || !htmlContent) {
    res.status(400).json({
      success: false,
      error: { message: 'campaignId, leadId, to.email, subject, and htmlContent are required' },
    });
    return;
  }

  const result = await outreachOrchestrator.sendCampaignEmail({
    campaignId,
    leadId,
    to,
    subject,
    htmlContent,
    ...(textContent && { textContent }),
    ...(replyTo && { replyTo }),
  });

  const statusCode = result.skipped ? 429 : 200;
  res.status(statusCode).json(successResponse(result));
}));

export default router;
