/**
 * Admin Routes
 * Endpoints for admin-only operations
 */
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { pricingConfigService } from '@services/pricingConfig.service';
import { supabaseAdmin } from '@lib/supabase';
import { emailService } from '@services/email.service';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

/**
 * GET /api/v1/admin/pricing/config
 * Get the active pricing configuration
 */
router.get('/pricing/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = await pricingConfigService.getActiveConfig();
  res.status(200).json(successResponse(config));
}));

/**
 * GET /api/v1/admin/pricing/configs
 * Get all pricing configurations
 */
router.get('/pricing/configs', asyncHandler(async (_req: Request, res: Response) => {
  const configs = await pricingConfigService.getAllConfigs();
  res.status(200).json(successResponse(configs));
}));

/**
 * PUT /api/v1/admin/pricing/config/:id
 * Update a pricing configuration
 * Body: { min_quote?, accident_min_quote?, base_fuel_price?, current_fuel_price?, surge_multiplier?, ... }
 * Required: change_reason (string)
 */
router.put('/pricing/config/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { change_reason, ...updates } = req.body;
  
  if (!id) {
    throw createError('Configuration ID is required', 400, 'MISSING_ID');
  }

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  if (!change_reason) {
    throw createError('change_reason is required for audit trail', 400, 'MISSING_FIELD');
  }

  // Remove change_reason from updates as it's handled separately
  const config = await pricingConfigService.updateConfig(
    id,
    updates,
    req.user.id,
    change_reason
  );

  res.status(200).json(successResponse(config));
}));

/**
 * POST /api/v1/admin/pricing/config
 * Create a new pricing configuration
 * Body: Full pricing config object + set_as_active (boolean)
 */
router.post('/pricing/config', asyncHandler(async (req: Request, res: Response) => {
  const { set_as_active = false, ...configData } = req.body;

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  const config = await pricingConfigService.createConfig(
    configData,
    req.user.id,
    set_as_active
  );

  res.status(201).json(successResponse(config));
}));

/**
 * POST /api/v1/admin/pricing/config/:id/activate
 * Set a pricing configuration as active
 */
router.post('/pricing/config/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Configuration ID is required', 400, 'MISSING_ID');
  }

  if (!req.user?.id) {
    throw createError('User ID not found', 401, 'UNAUTHORIZED');
  }

  const config = await pricingConfigService.setActiveConfig(id, req.user.id);

  res.status(200).json(successResponse(config));
}));

/**
 * GET /api/v1/admin/pricing/config/:id/history
 * Get the change history for a pricing configuration
 */
router.get('/pricing/config/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit } = req.query;

  const history = await pricingConfigService.getConfigHistory(
    id,
    limit ? Number(limit) : undefined
  );

  res.status(200).json(successResponse(history));
}));

/**
 * POST /api/v1/admin/pricing/cache/clear
 * Clear the pricing configuration cache (force refresh)
 */
router.post('/pricing/cache/clear', asyncHandler(async (_req: Request, res: Response) => {
  pricingConfigService.clearCache();
  res.status(200).json(successResponse({ cleared: true, timestamp: new Date().toISOString() }));
}));

// ─── In-House Driver Management ───────────────────────────────────────────────

/**
 * POST /api/v1/admin/drivers/create
 * Create an in-house driver (bypasses registration flow)
 * Body: { email, password, first_name, last_name, phone, vehicle_type, license_number, years_experience }
 */
router.post('/drivers/create', asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    first_name,
    last_name,
    phone,
    vehicle_type = 'open',
    license_number = '',
    send_welcome_email = true,
  } = req.body;

  // Validate required fields
  if (!email || !password || !first_name || !last_name) {
    throw createError(
      'email, password, first_name, and last_name are required',
      400,
      'MISSING_FIELDS'
    );
  }

  if (password.length < 8) {
    throw createError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
  }

  // Step 1: Create auth user via Supabase Admin
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      first_name,
      last_name,
      role: 'driver',
      created_by_admin: true,
      force_password_change: true, // Force driver to set their own password on first login
    },
  });

  if (authError) {
    throw createError(
      `Failed to create auth user: ${authError.message}`,
      400,
      'AUTH_CREATE_FAILED'
    );
  }

  const userId = authData.user.id;

  try {
    // Step 2: Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        first_name,
        last_name,
        phone: phone || null,
        role: 'driver',
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw createError(
        `Failed to create profile: ${profileError.message}`,
        500,
        'PROFILE_CREATE_FAILED'
      );
    }

    // Step 3: Create pre-approved driver application
    // Supply placeholder values for required NOT NULL fields since we're bypassing registration
    const { error: appError } = await supabaseAdmin
      .from('driver_applications')
      .insert({
        full_name: `${first_name} ${last_name}`,
        date_of_birth: '1990-01-01',
        email,
        phone: phone || '000-000-0000',
        address: JSON.stringify({ street: 'In-house driver', city: 'Charlotte', state: 'NC', zip: '28202' }),
        ssn_encrypted: 'IN_HOUSE_DRIVER',
        license_number: license_number || 'PENDING',
        license_state: 'NC',
        license_expiration: '2030-12-31',
        insurance_provider: 'Company Fleet',
        insurance_policy_number: 'IN-HOUSE',
        insurance_expiration: '2030-12-31',
        coverage_amount: '1000000',
        background_check_consent: true,
        data_use_consent: true,
        insurance_consent: true,
        terms_accepted: true,
        status: 'approved',
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString(),
        approval_notes: `In-house driver created by admin`,
        submitted_at: new Date().toISOString(),
      });

    if (appError) {
      console.warn('Driver application insert warning (non-critical):', appError.message);
      // Non-critical — driver can still function without this record
    }

    // Step 4: Send welcome email with credentials and first-login instructions
    if (send_welcome_email) {
      try {
        const loginUrl = `${process.env['FRONTEND_URL'] || 'https://www.drivedrop.us.com'}/login`;
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to DriveDrop! 🚗</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Your driver account is ready</p>
              </div>
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Hi ${first_name},</p>
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Your DriveDrop driver account has been created by our admin team. You can now log in and start accepting shipments.
                </p>
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 12px; color: #856404;">Your Login Credentials</h3>
                  <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
                  <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${password}</p>
                </div>
                <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; color: #0c5460; font-size: 14px;">
                    <strong>⚠️ Important:</strong> For your security, you will be prompted to set a new password the first time you log in.
                  </p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="background: #F59E0B; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                    Log In to DriveDrop →
                  </a>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 24px;">
                  If you have any questions, contact us at support@drivedrop.us.com
                </p>
              </div>
            </body>
          </html>
        `;
        const textContent = `Welcome to DriveDrop, ${first_name}!\n\nYour driver account is ready.\n\nEmail: ${email}\nTemporary Password: ${password}\n\nIMPORTANT: You will be asked to change your password on first login.\n\nLogin at: ${loginUrl}\n\nQuestions? Email support@drivedrop.us.com`;

        const sent = await emailService.sendEmail({
          to: email,
          subject: '🚗 Welcome to DriveDrop — Your Driver Account is Ready',
          htmlContent,
          textContent,
        });
        if (!sent) {
          console.warn(`[Admin] Welcome email delivery failed for ${email} — credentials still created`);
        } else {
          console.log(`[Admin] Welcome email sent to in-house driver: ${email} (${userId})`);
        }
      } catch (emailErr) {
        console.warn('[Admin] Welcome email threw an error (non-critical):', emailErr);
      }
    }

    res.status(201).json(successResponse({
      id: userId,
      email,
      first_name,
      last_name,
      phone,
      role: 'driver',
      status: 'active',
      vehicle_type,
      created_by: req.user?.id,
      created_at: new Date().toISOString(),
    }));

  } catch (err: any) {
    // If any step fails after auth user creation, try to clean up
    if (err.code !== 'AUTH_CREATE_FAILED') {
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error('Cleanup of auth user failed:', cleanupErr);
      }
    }
    throw err;
  }
}));

/**
 * GET /api/v1/admin/drivers
 * List all drivers with their application status
 */
router.get('/drivers', asyncHandler(async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, phone, role, is_verified, created_at, updated_at')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });

  if (error) {
    throw createError(`Failed to fetch drivers: ${error.message}`, 500, 'FETCH_FAILED');
  }

  res.status(200).json(successResponse(data));
}));

/**
 * DELETE /api/v1/admin/drivers/:id
 * Deactivate a driver (soft delete — sets status to 'suspended')
 */
router.delete('/drivers/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_verified: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('role', 'driver');

  if (error) {
    throw createError(`Failed to deactivate driver: ${error.message}`, 500, 'DEACTIVATE_FAILED');
  }

  res.status(200).json(successResponse({ id, deactivated: true }));
}));

export default router;
