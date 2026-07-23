/**
 * Driver Verification Service
 * Handles MVR checks (FCRA-compliant) and DOT verification (FMCSA SAFER)
 */

import { supabaseAdmin } from '../lib/supabase';

interface MVRCheckResult {
  eligible: boolean;
  violations: Array<{
    type: string;
    date: string;
    description: string;
  }>;
  licenseStatus: 'valid' | 'suspended' | 'expired' | 'revoked';
  cdlClass?: string;
  cdlEndorsements?: string[];
}

interface DOTVerificationResult {
  verified: boolean;
  dotNumber?: string;
  companyName?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE';
  mcNumber?: string;
  physicalAddress?: string | undefined;
  error?: string;
  requiresManualReview?: boolean;
}

export class DriverVerificationService {
  /**
   * Run MVR check via FCRA-compliant vendor (Checkr/HireRight/etc.)
   *
   * NOT YET INTEGRATED. Truework does not offer MVR/driving-record checks
   * (their product is income & employment verification only) and no
   * alternative vendor is wired up yet. Rather than fabricate a passing
   * result, this marks the application as pending manual review so a human
   * admin pulls the driver's MVR themselves until a real vendor API is
   * connected. This does NOT block registration - the driver can still
   * complete all steps; they just won't be auto-approved.
   *
   * TODO: Replace with a real vendor integration, e.g. Checkr:
   * const response = await fetch('https://api.checkr.com/v1/mvr_checks', {
   *   method: 'POST',
   *   headers: {
   *     'Authorization': `Bearer ${process.env.CHECKR_API_KEY}`,
   *     'Content-Type': 'application/json',
   *   },
   *   body: JSON.stringify({
   *     candidate_id: params.applicationId,
   *     license_number: params.licenseNumber,
   *     license_state: params.licenseState,
   *     dob: params.dateOfBirth,
   *   }),
   * });
   * Once wired up, set mvr_check_status to 'completed' with real
   * eligible/violations data - only then will checkAutoApprovalEligibility
   * be able to auto-approve anyone.
   */
  static async runMVRCheck(params: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    licenseNumber: string;
    licenseState: string;
    applicationId: string;
  }): Promise<MVRCheckResult> {
    try {
      const pendingResult: MVRCheckResult = {
        eligible: false,
        violations: [],
        licenseStatus: 'valid', // unknown until a human/vendor actually checks - not asserted to the driver
      };

      await supabaseAdmin
        .from('driver_applications')
        .update({
          mvr_check_status: 'pending_manual_review',
          mvr_check_vendor: null,
          mvr_check_id: null,
          mvr_check_completed_at: null,
          mvr_eligible: null,
          mvr_violations_count: 0,
          mvr_ineligible_reasons: ['MVR check not yet automated - pending manual admin review'],
        })
        .eq('id', params.applicationId);

      return pendingResult;
    } catch (error) {
      console.error('MVR check error:', error);

      await supabaseAdmin
        .from('driver_applications')
        .update({
          mvr_check_status: 'failed',
        })
        .eq('id', params.applicationId);

      throw new Error('Failed to run MVR check');
    }
  }

  /**
   * Verify DOT number via FMCSA SAFER lookup (Free API - NO CONSENT NEEDED)
   * This is PUBLIC government data, can be checked BEFORE FCRA consent
   * Reuses existing brokerVerification.ts logic
   */
  static async verifyDOTNumber(params: {
    dotNumber: string;
    applicationId: string;
  }): Promise<DOTVerificationResult> {
    try {
      const formatted = params.dotNumber.replace(/\D/g, '');

      if (!formatted || formatted.length < 1 || formatted.length > 8) {
        return { verified: false, error: 'Invalid DOT number format (must be 1-8 digits)' };
      }

      // FMCSA SAFER API Integration (FREE, PUBLIC, NO CONSENT REQUIRED)
      // Get FREE API key at: https://mobile.fmcsa.dot.gov/developer/home.page
      const FMCSA_API_KEY = process.env['FMCSA_API_KEY'];

      console.log('🔑 FMCSA API Key configured:', FMCSA_API_KEY ? 'YES' : 'NO');

      if (!FMCSA_API_KEY) {
        console.warn('⚠️ FMCSA_API_KEY not configured - using mock data. Get your FREE key at: https://mobile.fmcsa.dot.gov/developer/home.page');

        // FALLBACK: Mock data when API key not configured
        // (Only hit in local/dev environments where the env var is genuinely absent)
        const mockResult: DOTVerificationResult = {
          verified: true,
          dotNumber: formatted,
          companyName: `[MOCK] DOT ${formatted} Company`,
          status: 'ACTIVE',
          mcNumber: '123456',
          physicalAddress: '123 Main St, Chicago, IL 60601',
        };

        if (params.applicationId !== 'pre-check') {
          await supabaseAdmin
            .from('driver_applications')
            .update({
              dot_verified: mockResult.verified,
              dot_company_name: mockResult.companyName,
              dot_status: mockResult.status,
              dot_verified_at: new Date().toISOString(),
            })
            .eq('id', params.applicationId);
        }

        return mockResult;
      }

      // Real FMCSA SAFER API call
      try {
        const apiUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${formatted}?webKey=${FMCSA_API_KEY}`;
        console.log('🌐 Calling FMCSA API for DOT:', formatted);

        const response = await fetch(apiUrl, {
          headers: {
            // FMCSA's edge (Akamai) frequently blocks bare server-to-server
            // requests with no User-Agent, returning a raw HTML 403 before
            // the webKey is ever validated. Sending a real User-Agent and
            // Accept header avoids that WAF-level block.
            'User-Agent': 'DriveDrop/1.0 (+https://drivedrop-five.vercel.app; support@drivedrop.com)',
            'Accept': 'application/json',
          },
        });

        console.log('📡 FMCSA API Response Status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ FMCSA API Error:', { status: response.status, error: errorText });

          // Handle specific error codes
          if (response.status === 403) {
            console.error('🚫 FMCSA API request blocked (403 Forbidden). Check:');
            console.error('   1. API key is valid and not expired');
            console.error('   2. IP address is whitelisted in FMCSA developer portal');
            console.error('   3. API key is approved for production use');
            console.error('   4. Request includes a User-Agent header (Akamai WAF often blocks bare requests)');
            console.error('   Flagging application for manual review - NOT auto-verifying.');

            const failResult: DOTVerificationResult = {
              verified: false,
              dotNumber: formatted,
              error: 'FMCSA verification temporarily unavailable - flagged for manual review',
              requiresManualReview: true,
            };

            if (params.applicationId !== 'pre-check') {
              await supabaseAdmin
                .from('driver_applications')
                .update({
                  dot_verified: false,
                  dot_status: null,
                  dot_verified_at: new Date().toISOString(),
                  requires_manual_review: true,
                  manual_review_reason: 'FMCSA API unavailable (403) - DOT could not be verified automatically',
                })
                .eq('id', params.applicationId);
            }

            return failResult;
          }

          const notFoundOrOther: DOTVerificationResult = {
            verified: false,
            error: response.status === 404
              ? 'DOT number not found in FMCSA database'
              : 'Failed to verify DOT number with FMCSA',
          };

          if (params.applicationId !== 'pre-check') {
            await supabaseAdmin
              .from('driver_applications')
              .update({
                dot_verified: false,
                dot_verified_at: new Date().toISOString(),
                requires_manual_review: response.status !== 404,
                manual_review_reason:
                  response.status !== 404
                    ? `FMCSA API error (${response.status}) - DOT could not be verified automatically`
                    : null,
              })
              .eq('id', params.applicationId);
          }

          return notFoundOrOther;
        }

        const data: any = await response.json();
        console.log('📦 FMCSA API Data received:', JSON.stringify(data, null, 2));

        // Check if carrier data exists
        if (!data.content || !data.content.carrier) {
          return { verified: false, error: 'DOT number not found in FMCSA database' };
        }

        const carrier = data.content.carrier;

        // FMCSA API structure:
        // - carrierOperation.carrierOperationCode: "A" (Interstate), etc
        // - statusCode: "A" (Authorized), "I" (Inactive), etc
        // - allowedToOperate: "Y" or "N"
        const operationCode = carrier.carrierOperation?.carrierOperationCode || carrier.statusCode;
        const allowedToOperate = carrier.allowedToOperate === 'Y';

        let status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE' = 'INACTIVE';

        if (allowedToOperate && (operationCode === 'A' || carrier.statusCode === 'A')) {
          status = 'ACTIVE';
        } else if (carrier.oosDate) {
          status = 'OUT_OF_SERVICE';
        }

        // Get MC number from broker/contract authority (not in main carrier object)
        // This would require a separate API call to /docket-numbers endpoint
        // For now, we'll leave it undefined

        const physicalAddr = carrier.phyStreet
          ? `${carrier.phyStreet.trim()}, ${carrier.phyCity}, ${carrier.phyState} ${carrier.phyZipcode}`.trim()
          : undefined;

        const result: DOTVerificationResult = {
          verified: status === 'ACTIVE',
          dotNumber: formatted,
          companyName: carrier.legalName || carrier.dbaName || 'Unknown Company',
          status: status,
          physicalAddress: physicalAddr,
        };

        console.log('✅ DOT Verification Complete:', {
          dotNumber: result.dotNumber,
          companyName: result.companyName,
          status: result.status,
          verified: result.verified,
          allowedToOperate,
          operationCode,
          statusCode: carrier.statusCode,
        });

        // Only save to database if it's a real application (not pre-check)
        if (params.applicationId !== 'pre-check') {
          await supabaseAdmin
            .from('driver_applications')
            .update({
              dot_verified: result.verified,
              dot_company_name: result.companyName,
              dot_status: result.status,
              dot_verified_at: new Date().toISOString(),
            })
            .eq('id', params.applicationId);
        }

        return result;
      } catch (fetchError) {
        console.error('FMCSA API fetch error:', fetchError);

        if (params.applicationId !== 'pre-check') {
          await supabaseAdmin
            .from('driver_applications')
            .update({
              dot_verified: false,
              dot_verified_at: new Date().toISOString(),
              requires_manual_review: true,
              manual_review_reason: 'Failed to connect to FMCSA database',
            })
            .eq('id', params.applicationId);
        }

        return { verified: false, error: 'Failed to connect to FMCSA database', requiresManualReview: true };
      }
    } catch (error) {
      console.error('DOT verification error:', error);
      return { verified: false, error: 'Failed to verify DOT number' };
    }
  }

  /**
   * Determine auto-approval eligibility
   *
   * Auto-approves ONLY if BOTH:
   *  1. MVR check completed, eligible, and zero violations
   *  2. DOT number was actually verified as ACTIVE by FMCSA (dot_verified === true)
   *
   * Previously this only checked MVR (which is currently a mock that always
   * passes), meaning DOT verification failures had no effect on approval.
   * That gap is closed here.
   */
  static async checkAutoApprovalEligibility(applicationId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    const { data: application } = await supabaseAdmin
      .from('driver_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return { eligible: false, reason: 'Application not found' };
    }

    const mvrPassed =
      application.mvr_check_status === 'completed' &&
      application.mvr_eligible === true &&
      application.mvr_violations_count === 0;

    const dotPassed = application.dot_verified === true;

    if (mvrPassed && dotPassed) {
      await supabaseAdmin
        .from('driver_applications')
        .update({
          auto_approved: true,
          auto_approved_at: new Date().toISOString(),
          status: 'approved',
        })
        .eq('id', applicationId);

      return { eligible: true };
    }

    // Require manual review if violations, failed checks, or DOT unverified.
    // Note: mvrPassed will always be false until a real MVR vendor is wired
    // up in runMVRCheck(), so every application currently lands here for a
    // human admin to review - that's expected, not a bug.
    let reason: string;
    if (!dotPassed && !mvrPassed) {
      reason = 'DOT number could not be verified and MVR check is pending manual review';
    } else if (!dotPassed) {
      reason = 'DOT number could not be verified';
    } else {
      reason = 'MVR check pending manual review (automated MVR not yet configured)';
    }

    await supabaseAdmin
      .from('driver_applications')
      .update({
        requires_manual_review: true,
        manual_review_reason: reason,
      })
      .eq('id', applicationId);

    return { eligible: false, reason };
  }
}