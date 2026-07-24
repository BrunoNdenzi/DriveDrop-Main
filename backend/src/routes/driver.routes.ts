/**
 * Driver routes
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { 
  getDriverApplications
} from '@controllers/application.controller';
import { supabaseAdmin } from '../lib/supabase';
import { DriverVerificationService } from '../services/driverVerification.service';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route GET /api/v1/drivers/applications
 * @desc Get all applications for the authenticated driver
 * @access Private (Driver)
 * @query status - Optional filter by application status (pending, accepted, rejected)
 * @example 
 * GET /api/v1/drivers/applications
 * GET /api/v1/drivers/applications?status=pending
 */
router.get('/applications', authenticate, authorize(['driver']), getDriverApplications);

/**
 * @route POST /api/v1/drivers/verify-dot
 * @desc Pre-verify DOT number via FREE FMCSA SAFER API (no consent needed - public data)
 * @access Public
 */
router.post('/verify-dot', async (req, res) => {
  try {
    const { dotNumber } = req.body;

    console.log('🔍 DOT Verification Request:', { dotNumber, body: req.body });

    if (!dotNumber) {
      console.error('❌ DOT Verification Failed: No DOT number provided');
      return res.status(400).json({ error: 'DOT number required' });
    }

    const result = await DriverVerificationService.verifyDOTNumber({
      dotNumber,
      applicationId: 'pre-check', // Not saved yet
    });

    console.log('✅ DOT Verification Result:', result);

    // FMCSA being unreachable is a service problem, not a bad DOT number -
    // never block registration for it. Return 200 with a manual-review flag
    // so the driver proceeds and gets checked by a human later.
    if (result.requiresManualReview) {
      console.warn('⚠️ DOT verification unavailable - proceeding, flagged for manual review:', result);
      return res.status(200).json({
        verified: false,
        requiresManualReview: true,
        message: 'DOT verification is temporarily unavailable. You can continue - our team will verify it manually.',
      });
    }

    // Only block on a genuinely invalid/not-found DOT number, so the driver
    // can correct a typo before proceeding.
    if (!result.verified) {
      console.warn('⚠️ DOT Not Verified:', result);
      return res.status(400).json({
        verified: false,
        error: result.error || 'DOT number not found in FMCSA database',
      });
    }

    return res.status(200).json({
      verified: true,
      dotNumber: result.dotNumber,
      companyName: result.companyName,
      status: result.status,
      mcNumber: result.mcNumber,
      physicalAddress: result.physicalAddress,
    });
  } catch (error) {
    console.error('❌ DOT pre-verification error:', error);
    return res.status(500).json({ error: 'Failed to verify DOT number' });
  }
});

/**
 * @route POST /api/v1/drivers/verify
 * @desc Step 1: Verify driver license and optional DOT number
 * @access Public
 */
router.post('/verify', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      licenseNumber,
      licenseState,
      dotNumber,
      email,
      phone,
      fcraConsentObtained,
      fcraConsentSignature,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !licenseNumber || !licenseState || !email || !phone) {
      return res.status(400).json({
        error: 'Missing required fields: firstName, lastName, dateOfBirth, licenseNumber, licenseState, email, phone',
      });
    }

    // Validate FCRA consent
    if (!fcraConsentObtained) {
      return res.status(400).json({
        error: 'FCRA consent required before running background check',
      });
    }

    // Extract client IP from request (Railway/Vercel sets X-Forwarded-For)
    const clientIp = req.ip || 
                     req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
                     req.headers['x-real-ip']?.toString() || 
                     req.socket.remoteAddress || 
                     null;

    console.log('📍 Client IP extracted:', clientIp);

    // Create draft application
    const { data: application, error: createError } = await supabaseAdmin
      .from('driver_applications')
      .insert({
        full_name: `${firstName} ${lastName}`,
        date_of_birth: dateOfBirth,
        email: email,
        phone: phone,
        address: { street: '', city: '', state: '', zipCode: '' }, // Will be updated
        ssn_encrypted: 'pending', // Will be updated
        license_number: licenseNumber,
        license_state: licenseState,
        license_expiration: '2099-12-31', // Will be updated with MVR data
        insurance_provider: 'pending',
        insurance_policy_number: 'pending',
        insurance_expiration: '2099-12-31',
        coverage_amount: 'pending',
        background_check_consent: true,
        data_use_consent: true,
        insurance_consent: false,
        terms_accepted: false,
        status: 'under_review',
        dot_number: dotNumber || null,
        fcra_disclosure_shown_at: new Date().toISOString(),
        fcra_consent_obtained_at: new Date().toISOString(),
        fcra_consent_ip_address: clientIp,
        fcra_consent_signature: fcraConsentSignature,
      })
      .select()
      .single();

    if (createError) {
      console.error('Application creation error:', createError);
      return res.status(500).json({ error: 'Failed to create application' });
    }

    // Run MVR check
    const mvrResult = await DriverVerificationService.runMVRCheck({
      firstName,
      lastName,
      dateOfBirth,
      licenseNumber,
      licenseState,
      applicationId: application.id,
    });

    // Run DOT verification if provided
    let dotResult = null;
    if (dotNumber) {
      dotResult = await DriverVerificationService.verifyDOTNumber({
        dotNumber,
        applicationId: application.id,
      });
    }

    // Check auto-approval eligibility
    const autoApproval = await DriverVerificationService.checkAutoApprovalEligibility(
      application.id
    );

    return res.status(200).json({
      success: true,
      applicationId: application.id,
      mvr: {
        eligible: mvrResult.eligible,
        licenseStatus: mvrResult.licenseStatus,
        violations: mvrResult.violations,
        cdlClass: mvrResult.cdlClass,
        cdlEndorsements: mvrResult.cdlEndorsements,
      },
      dot: dotResult
        ? {
            verified: dotResult.verified,
            companyName: dotResult.companyName,
            status: dotResult.status,
          }
        : null,
      autoApproved: autoApproval.eligible,
      requiresManualReview: !autoApproval.eligible,
      message: autoApproval.eligible
        ? 'Verification successful! Complete remaining steps to finalize.'
        : 'Verification complete. Application requires manual admin review.',
    });
  } catch (error) {
    console.error('Driver verification error:', error);
    return res.status(500).json({ error: 'Failed to verify driver' });
  }
});

/**
 * @route POST /api/v1/drivers/complete-application
 * @desc Step 2: Complete application with remaining data (insurance, vehicle, etc.)
 * @access Public
 */
router.post('/complete-application', upload.any(), async (req, res) => {
  try {
    const {
      applicationId,
      email,
      phone,
      address,
      ssnEncrypted,
      insuranceProvider,
      policyNumber,
      policyExpiration,
      coverageAmount,
      insuranceConsent,
      termsAccepted,
    } = req.body;

    // Validate required fields
    if (!applicationId || !email || !phone || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update application with complete data
    const { error: updateError } = await supabaseAdmin
      .from('driver_applications')
      .update({
        email,
        phone,
        address: typeof address === 'string' ? JSON.parse(address) : address,
        ssn_encrypted: ssnEncrypted,
        insurance_provider: insuranceProvider,
        insurance_policy_number: policyNumber,
        insurance_expiration: policyExpiration,
        coverage_amount: coverageAmount,
        insurance_consent: insuranceConsent === 'true',
        terms_accepted: termsAccepted === 'true',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('Application update error:', updateError);
      return res.status(500).json({ error: 'Failed to update application' });
    }

    return res.status(200).json({
      success: true,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    console.error('Complete application error:', error);
    return res.status(500).json({ error: 'Failed to complete application' });
  }
});

export default router;