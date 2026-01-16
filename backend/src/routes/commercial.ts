/**
 * Commercial Accounts API Routes
 * 
 * Endpoints for managing B2B commercial client accounts.
 * 
 * Routes:
 * - POST   /api/commercial/accounts           - Create commercial account
 * - GET    /api/commercial/accounts           - List accounts with filters
 * - GET    /api/commercial/accounts/:id       - Get account details
 * - PATCH  /api/commercial/accounts/:id       - Update account
 * - POST   /api/commercial/accounts/:id/api-key - Generate API key
 * - DELETE /api/commercial/accounts/:id/api-key - Revoke API key
 * - GET    /api/commercial/accounts/:id/usage - Get API usage stats
 * - PATCH  /api/commercial/accounts/:id/credit - Update credit limit
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { FEATURE_FLAGS } from '../config/features';

const router = Router();

// Initialize Supabase client
const supabase = createClient(
  process.env['SUPABASE_URL'] || '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
);

/**
 * Middleware: Check if commercial accounts feature is enabled
 */
const checkCommercialFeature = (_req: Request, res: Response, next: Function): void => {
  if (!FEATURE_FLAGS.COMMERCIAL_ACCOUNTS) {
    res.status(403).json({
      error: 'Commercial accounts feature is not enabled',
      feature: 'COMMERCIAL_ACCOUNTS',
    });
    return;
  }
  next();
};

/**
 * Middleware: Verify admin access
 */
const requireAdmin = async (req: Request, res: Response, next: Function): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized - Missing token' });
    return;
  }

  // TODO: Verify JWT and check user role
  next();
};

/**
 * Generate secure API key
 */
function generateAPIKey(): string {
  const prefix = 'dd_live_'; // DriveDrop live key
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

/**
 * Hash API key for storage
 */
function hashAPIKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * POST /api/commercial/accounts
 * Create new commercial account
 */
router.post('/', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      user_id,
      company_name,
      business_type,
      tax_id,
      billing_address,
      billing_email,
      billing_phone,
      payment_terms,
      credit_limit,
      rate_limit_per_hour,
      auto_approve_shipments,
      webhook_url,
      webhook_secret,
    } = req.body;

    // Validation
    if (!user_id || !company_name || !billing_email) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['user_id', 'company_name', 'billing_email'],
      });
      return;
    }

    // Validate payment terms
    const validPaymentTerms = ['immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'net_90'];
    if (payment_terms && !validPaymentTerms.includes(payment_terms)) {
      res.status(400).json({
        error: 'Invalid payment_terms',
        valid_terms: validPaymentTerms,
      });
      return;
    }

    // Create account
    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .insert({
        user_id,
        company_name,
        business_type,
        tax_id,
        billing_address,
        billing_email,
        billing_phone,
        payment_terms: payment_terms || 'net_30',
        credit_limit: credit_limit || 10000,
        current_balance: 0,
        rate_limit_per_hour: rate_limit_per_hour || 1000,
        auto_approve_shipments: auto_approve_shipments !== false,
        webhook_url,
        webhook_secret,
        status: 'active',
        is_verified: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      success: true,
      account,
      message: 'Commercial account created successfully',
    });
  } catch (error: any) {
    console.error('Error creating commercial account:', error);
    res.status(500).json({
      error: 'Failed to create commercial account',
      details: error.message,
    });
  }
});

/**
 * GET /api/commercial/accounts
 * List commercial accounts with filters
 */
router.get('/', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, business_type, is_verified, limit, offset } = req.query;

    let query = supabase
      .from('commercial_accounts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (business_type) {
      query = query.eq('business_type', business_type);
    }

    if (is_verified !== undefined) {
      query = query.eq('is_verified', is_verified === 'true');
    }

    const limitNum = limit ? parseInt(limit as string) : 50;
    const offsetNum = offset ? parseInt(offset as string) : 0;
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      accounts: data,
      pagination: {
        total: count,
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error: any) {
    console.error('Error listing commercial accounts:', error);
    res.status(500).json({
      error: 'Failed to list commercial accounts',
      details: error.message,
    });
  }
});

/**
 * GET /api/commercial/accounts/:id
 * Get commercial account details
 */
router.get('/:id', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }

    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !account) {
      res.status(404).json({ error: 'Commercial account not found' });
      return;
    }

    // Get related integrations count
    const { count: integrationsCount } = await supabase
      .from('auction_integrations')
      .select('*', { count: 'exact', head: true })
      .eq('commercial_account_id', id);

    // Get shipments count
    const { count: shipmentsCount } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('is_commercial', true);

    res.json({
      success: true,
      account: {
        ...account,
        stats: {
          integrations: integrationsCount || 0,
          shipments: shipmentsCount || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching commercial account:', error);
    res.status(500).json({
      error: 'Failed to fetch commercial account',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/commercial/accounts/:id
 * Update commercial account
 */
router.patch('/:id', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }

    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.current_balance;
    delete updates.api_key_hash;

    // Validate payment terms if provided
    if (updates.payment_terms) {
      const validPaymentTerms = ['immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'net_90'];
      if (!validPaymentTerms.includes(updates.payment_terms)) {
        res.status(400).json({
          error: 'Invalid payment_terms',
          valid_terms: validPaymentTerms,
        });
        return;
      }
    }

    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !account) {
      res.status(404).json({ error: 'Commercial account not found' });
      return;
    }

    res.json({
      success: true,
      account,
      message: 'Commercial account updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating commercial account:', error);
    res.status(500).json({
      error: 'Failed to update commercial account',
      details: error.message,
    });
  }
});

/**
 * POST /api/commercial/accounts/:id/api-key
 * Generate new API key for account
 */
router.post('/:id/api-key', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }

    // Generate new API key
    const apiKey = generateAPIKey();
    const apiKeyHash = hashAPIKey(apiKey);

    // Update account with new API key
    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .update({
        api_key_hash: apiKeyHash,
        api_key_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !account) {
      res.status(404).json({ error: 'Commercial account not found' });
      return;
    }

    // Return the plain API key (only time it's shown)
    res.json({
      success: true,
      api_key: apiKey,
      message: 'API key generated successfully. Store this key securely - it will not be shown again.',
      warning: 'This API key will only be displayed once. Store it securely.',
    });
  } catch (error: any) {
    console.error('Error generating API key:', error);
    res.status(500).json({
      error: 'Failed to generate API key',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/commercial/accounts/:id/api-key
 * Revoke API key for account
 */
router.delete('/:id/api-key', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }

    // Clear API key
    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .update({
        api_key_hash: null,
        api_key_created_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !account) {
      res.status(404).json({ error: 'Commercial account not found' });
      return;
    }

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      error: 'Failed to revoke API key',
      details: error.message,
    });
  }
});

/**
 * GET /api/commercial/accounts/:id/usage
 * Get API usage statistics
 */
router.get('/:id/usage', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }
    const { period = '7d' } = req.query;

    // Calculate date range
    let daysAgo = 7;
    if (period === '24h') daysAgo = 1;
    else if (period === '30d') daysAgo = 30;
    else if (period === '90d') daysAgo = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Get integration logs (API calls)
    const { data: logs, count: totalCalls } = await supabase
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString());

    // Get shipments created
    const { count: shipmentsCreated } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('is_commercial', true)
      .gte('created_at', startDate.toISOString());

    // Calculate success rate
    const successfulCalls = logs?.filter((log: any) => log.status === 'success').length || 0;
    const successRate = totalCalls ? (successfulCalls / totalCalls) * 100 : 100;

    // Get account details
    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('rate_limit_per_hour, current_balance, credit_limit')
      .eq('id', id)
      .single();

    res.json({
      success: true,
      usage: {
        period,
        total_api_calls: totalCalls || 0,
        successful_calls: successfulCalls,
        failed_calls: (totalCalls || 0) - successfulCalls,
        success_rate: Math.round(successRate),
        shipments_created: shipmentsCreated || 0,
        current_balance: account?.current_balance || 0,
        credit_limit: account?.credit_limit || 0,
        credit_available: (account?.credit_limit || 0) - (account?.current_balance || 0),
        rate_limit_per_hour: account?.rate_limit_per_hour || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch usage statistics',
      details: error.message,
    });
  }
});

/**
 * PATCH /api/commercial/accounts/:id/credit
 * Update credit limit or adjust balance
 */
router.patch('/:id/credit', checkCommercialFeature, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Account ID is required' });
      return;
    }
    const { credit_limit, balance_adjustment, reason } = req.body;

    // Get current account
    const { data: account, error: fetchError } = await supabase
      .from('commercial_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !account) {
      res.status(404).json({ error: 'Commercial account not found' });
      return;
    }

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    // Update credit limit
    if (credit_limit !== undefined) {
      if (credit_limit < 0) {
        res.status(400).json({ error: 'Credit limit cannot be negative' });
        return;
      }
      updates.credit_limit = credit_limit;
    }

    // Adjust balance
    if (balance_adjustment !== undefined) {
      const newBalance = account.current_balance + balance_adjustment;
      if (newBalance < 0) {
        res.status(400).json({ error: 'Balance cannot be negative' });
        return;
      }
      updates.current_balance = newBalance;
    }

    // Update account
    const { data: updatedAccount, error: updateError } = await supabase
      .from('commercial_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the adjustment (optional - could create audit log table)
    console.log(`Credit adjustment for account ${id}: ${JSON.stringify({ credit_limit, balance_adjustment, reason })}`);

    res.json({
      success: true,
      account: updatedAccount,
      message: 'Credit settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating credit settings:', error);
    res.status(500).json({
      error: 'Failed to update credit settings',
      details: error.message,
    });
  }
});

/**
 * Middleware: Verify API key authentication (for commercial API endpoints)
 */
export async function verifyAPIKey(req: Request, res: Response, next: Function): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  try {
    // Hash the provided API key
    const apiKeyHash = hashAPIKey(apiKey);

    // Find account with this API key
    const { data: account, error } = await supabase
      .from('commercial_accounts')
      .select('*')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (error || !account) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Check if account is active
    if (account.status !== 'active') {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    // Check credit limit
    if (account.current_balance >= account.credit_limit) {
      res.status(403).json({ error: 'Credit limit exceeded' });
      return;
    }

    // Attach account to request
    (req as any).commercialAccount = account;

    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
}

export default router;
