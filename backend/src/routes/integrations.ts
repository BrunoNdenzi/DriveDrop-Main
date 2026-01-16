/**
 * Integration Management API Routes
 * 
 * Endpoints for managing universal integrations with auction houses and dealerships.
 * 
 * Routes:
 * - POST   /api/integrations          - Create new integration
 * - GET    /api/integrations          - List all integrations
 * - GET    /api/integrations/:id      - Get integration details
 * - PATCH  /api/integrations/:id      - Update integration
 * - DELETE /api/integrations/:id      - Delete integration
 * - POST   /api/integrations/:id/test - Test integration connection
 * - POST   /api/integrations/:id/sync - Trigger manual sync
 * - GET    /api/integrations/:id/logs - Get integration logs
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import UniversalAuctionIntegrationService from '../services/UniversalAuctionIntegrationService';
import { FEATURE_FLAGS } from '../config/features';

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

// Initialize integration service
const integrationService = new UniversalAuctionIntegrationService();

/**
 * Middleware: Check if integrations feature is enabled
 */
const checkIntegrationsFeature = (_req: Request, res: Response, next: Function): void => {
  if (!FEATURE_FLAGS.UNIVERSAL_INTEGRATIONS) {
    res.status(403).json({
      error: 'Universal integrations feature is not enabled',
      feature: 'UNIVERSAL_INTEGRATIONS',
    });
    return;
  }
  next();
};

/**
 * Middleware: Verify admin access
 * TODO: Implement proper JWT auth middleware
 */
const requireAdmin = async (req: Request, res: Response, next: Function): Promise<void> => {
  // For now, check Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - Missing token' });
    return;
  }

  // TODO: Verify JWT and check user role
  // const token = authHeader.substring(7);
  // Temporarily allow all requests for development
  next();
};

/**
 * POST /api/integrations
 * Create new integration
 */
router.post('/', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      commercial_account_id,
      name,
      integration_type,
      auth_method,
      base_url,
      api_endpoint,
      auth_config,
      field_mapping,
      sync_frequency,
    } = req.body;

    // Validation
    if (!commercial_account_id || !name || !integration_type || !auth_method || !field_mapping) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['commercial_account_id', 'name', 'integration_type', 'auth_method', 'field_mapping'],
      });
      return;
    }

    // Validate integration_type
    const validTypes = ['api', 'sftp', 'email', 'manual_csv', 'webhook'];
    if (!validTypes.includes(integration_type)) {
      res.status(400).json({
        error: 'Invalid integration_type',
        valid_types: validTypes,
      });
      return;
    }

    // Validate auth_method
    const validAuthMethods = ['oauth2', 'api_key', 'basic_auth', 'jwt', 'sftp_credentials', 'none'];
    if (!validAuthMethods.includes(auth_method)) {
      res.status(400).json({
        error: 'Invalid auth_method',
        valid_methods: validAuthMethods,
      });
      return;
    }

    // Create integration
    const { data, error } = await supabase
      .from('auction_integrations')
      .insert({
        commercial_account_id,
        name,
        integration_type,
        auth_method,
        base_url,
        api_endpoint,
        auth_config,
        field_mapping,
        sync_frequency: sync_frequency || 'manual',
        is_active: true,
        health_status: 'healthy',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      integration: data,
    });
  } catch (error: any) {
    console.error('Error creating integration:', error);
    res.status(500).json({
      error: 'Failed to create integration',
      details: error.message,
    });
  }
});

/**
 * GET /api/integrations
 * List all integrations
 */
router.get('/', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { commercial_account_id, is_active } = req.query;

    let query = supabase
      .from('auction_integrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (commercial_account_id) {
      query = query.eq('commercial_account_id', commercial_account_id);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      integrations: data,
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error listing integrations:', error);
    res.status(500).json({
      error: 'Failed to list integrations',
      details: error.message,
    });
  }
});

/**
 * GET /api/integrations/:id
 * Get integration details
 */
router.get('/:id', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    const { data, error } = await supabase
      .from('auction_integrations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Integration not found',
      });
      return;
    }

    // Get health status
    const healthStatus = await integrationService.getHealthStatus(id);

    res.json({
      success: true,
      integration: {
        ...data,
        health: healthStatus,
      },
    });
  } catch (error: any) {
    console.error('Error getting integration:', error);
    res.status(500).json({
      error: 'Failed to get integration',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/integrations/:id
 * Update integration
 */
router.patch('/:id', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.id;
    delete updates.created_at;
    delete updates.commercial_account_id;

    const { data, error } = await supabase
      .from('auction_integrations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Integration not found',
      });
      return;
    }

    res.json({
      success: true,
      integration: data,
    });
  } catch (error: any) {
    console.error('Error updating integration:', error);
    res.status(500).json({
      error: 'Failed to update integration',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/integrations/:id
 * Delete integration (soft delete - set is_active to false)
 */
router.delete('/:id', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === 'true') {
      // Hard delete
      const { error } = await supabase
        .from('auction_integrations')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }
    } else {
      // Soft delete
      const { error } = await supabase
        .from('auction_integrations')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        throw error;
      }
    }

    res.json({
      success: true,
      message: permanent === 'true' ? 'Integration permanently deleted' : 'Integration deactivated',
    });
  } catch (error: any) {
    console.error('Error deleting integration:', error);
    res.status(500).json({
      error: 'Failed to delete integration',
      details: error.message,
    });
  }
});

/**
 * POST /api/integrations/:id/test
 * Test integration connection
 */
router.post('/:id/test', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    const result = await integrationService.testConnection(id);

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error testing integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test integration',
      details: error.message,
    });
  }
});

/**
 * POST /api/integrations/:id/sync
 * Trigger manual sync
 */
router.post('/:id/sync', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    // Start sync (this could be made async with job queue)
    const result = await integrationService.syncIntegration(id);

    res.json({
      success: result.success,
      summary: {
        vehicles_fetched: result.vehicles_fetched,
        vehicles_created: result.vehicles_created,
        vehicles_updated: result.vehicles_updated,
        vehicles_failed: result.vehicles_failed,
        duration_ms: result.duration_ms,
      },
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Error syncing integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync integration',
      details: error.message,
    });
  }
});

/**
 * GET /api/integrations/:id/logs
 * Get integration logs
 */
router.get('/:id/logs', checkIntegrationsFeature, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0', status } = req.query;

    let query = supabase
      .from('integration_logs')
      .select('*')
      .eq('integration_id', id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      logs: data,
      pagination: {
        total: count,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    console.error('Error getting integration logs:', error);
    res.status(500).json({
      error: 'Failed to get integration logs',
      details: error.message,
    });
  }
});

export default router;
