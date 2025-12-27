/**
 * Webhook API Routes
 * Endpoints for managing webhook endpoints and delivery
 */

import { Router } from 'express';
import { WebhookService } from '../services/WebhookService';
import { FEATURE_FLAGS } from '../config/features';

const router = Router();
const webhookService = new WebhookService();

// Middleware to check Webhook System feature flag
function checkWebhookFeature(_req: any, res: any, next: any) {
  if (!FEATURE_FLAGS.WEBHOOK_SYSTEM) {
    return res.status(403).json({
      error: 'Webhook system feature is not enabled',
    });
  }
  next();
}

/**
 * POST /api/webhooks
 * Create a new webhook endpoint for a commercial account
 */
router.post('/', checkWebhookFeature, async (req, res) => {
  try {
    const { commercial_account_id, url, events } = req.body;

    if (!commercial_account_id) {
      return res.status(400).json({ error: 'Commercial account ID is required' });
    }

    if (!url) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const result = await webhookService.createWebhook(
      commercial_account_id,
      url,
      events
    );

    return res.status(201).json({
      success: true,
      webhook: result,
      message: 'Webhook created successfully. Store the secret securely.',
    });
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    return res.status(500).json({
      error: 'Failed to create webhook',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/webhooks/:webhookId
 * Update webhook endpoint configuration
 */
router.patch('/:webhookId', checkWebhookFeature, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { url, events, active } = req.body;

    if (!webhookId) {
      return res.status(400).json({ error: 'Webhook ID is required' });
    }

    const updates: any = {};
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = events;
    if (active !== undefined) updates.active = active;

    await webhookService.updateWebhook(webhookId, updates);

    return res.json({
      success: true,
      message: 'Webhook updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating webhook:', error);
    return res.status(500).json({
      error: 'Failed to update webhook',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/webhooks/:webhookId
 * Delete a webhook endpoint
 */
router.delete('/:webhookId', checkWebhookFeature, async (req, res) => {
  try {
    const { webhookId } = req.params;

    if (!webhookId) {
      return res.status(400).json({ error: 'Webhook ID is required' });
    }

    await webhookService.deleteWebhook(webhookId);

    return res.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    return res.status(500).json({
      error: 'Failed to delete webhook',
      message: error.message,
    });
  }
});

/**
 * POST /api/webhooks/:webhookId/test
 * Test webhook endpoint with a sample payload
 */
router.post('/:webhookId/test', checkWebhookFeature, async (req, res) => {
  try {
    const { webhookId } = req.params;

    if (!webhookId) {
      return res.status(400).json({ error: 'Webhook ID is required' });
    }

    const result = await webhookService.testWebhook(webhookId);

    return res.json({
      success: result.success,
      message: result.message,
      response_code: result.response_code,
    });
  } catch (error: any) {
    console.error('Error testing webhook:', error);
    return res.status(500).json({
      error: 'Failed to test webhook',
      message: error.message,
    });
  }
});

/**
 * GET /api/webhooks/:webhookId/logs
 * Get webhook delivery logs for debugging
 */
router.get('/:webhookId/logs', checkWebhookFeature, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const limit = parseInt(req.query['limit'] as string) || 50;

    if (!webhookId) {
      return res.status(400).json({ error: 'Webhook ID is required' });
    }

    const logs = await webhookService.getWebhookLogs(webhookId, limit);

    return res.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Error fetching webhook logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch webhook logs',
      message: error.message,
    });
  }
});

/**
 * GET /api/webhooks/:webhookId/stats
 * Get webhook performance statistics
 */
router.get('/:webhookId/stats', checkWebhookFeature, async (req, res) => {
  try {
    const { webhookId } = req.params;
    const days = parseInt(req.query['days'] as string) || 7;

    if (!webhookId) {
      return res.status(400).json({ error: 'Webhook ID is required' });
    }

    const stats = await webhookService.getWebhookStats(webhookId, days);

    return res.json({
      success: true,
      statistics: stats,
      period_days: days,
    });
  } catch (error: any) {
    console.error('Error fetching webhook stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch webhook stats',
      message: error.message,
    });
  }
});

export default router;
