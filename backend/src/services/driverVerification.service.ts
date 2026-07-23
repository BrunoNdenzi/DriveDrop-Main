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
  error?: string;
}

export class DriverVerificationService {
  /**
   * Run MVR check via FCRA-compliant vendor (Checkr/HireRight/Truework)
   * This is a PLACEHOLDER - requires actual vendor API integration
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
      // TODO: Integrate with chosen MVR vendor API
      // Example for Checkr:
      // const response = await fetch('https://api.checkr.com/v1/mvr_checks', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.CHECKR_API_KEY}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     candidate_id: params.applicationId,
      //     license_number: params.licenseNumber,
      //     license_state: params.licenseState,
      //     dob: params.dateOfBirth,
      //   }),
      // });

      // Update database with check status
      await supabaseAdmin
        .from('driver_applications')
        .update({
          mvr_check_status: 'pending',
          mvr_check_vendor: 'checkr', // or 'hireright', 'truework'
          mvr_check_id: 'placeholder-check-id',
        })
        .eq('id', params.applicationId);

      // MOCK RESPONSE FOR DEVELOPMENT
      // Real implementation would poll vendor API or use webhooks
      const mockResult: MVRCheckResult = {
        eligible: true,
        violations: [],
        licenseStatus: 'valid',
        cdlClass: 'A',
        cdlEndorsements: ['H', 'N'],
      };

      // Update with results
      await supabaseAdmin
        .from('driver_applications')
        .update({
          mvr_check_status: 'completed',
          mvr_check_result: mockResult,
          mvr_check_completed_at: new Date().toISOString(),
          mvr_violations_count: mockResult.violations.length,
          mvr_eligible: mockResult.eligible,
          mvr_ineligible_reasons: mockResult.eligible ? [] : ['License not valid'],
        })
        .eq('id', params.applicationId);

      return mockResult;
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

      // TODO: Integrate with FMCSA SAFER API (FREE, PUBLIC, NO CONSENT REQUIRED)
      // Real API endpoint: https://mobile.fmcsa.dot.gov/qc/services/carriers/{dotNumber}
      // Get FREE API key at: https://mobile.fmcsa.dot.gov/developer/home.page
      // Example:
      // const response = await fetch(
      //   `https://mobile.fmcsa.dot.gov/qc/services/carriers/${formatted}?webKey=${process.env.FMCSA_API_KEY}`
      // );
      // if (!response.ok) {
      //   return { verified: false, error: 'DOT number not found in FMCSA database' };
      // }
      // const data = await response.json();
      // return {
      //   verified: data.content.carrier.carrierOperationCode === 'A', // A = ACTIVE
      //   dotNumber: formatted,
      //   companyName: data.content.carrier.legalName,
      //   status: data.content.carrier.carrierOperationCode === 'A' ? 'ACTIVE' : 'INACTIVE',
      // };

      // MOCK DATA for development
      // In production, this will be REAL FMCSA data
      const mockResult: DOTVerificationResult = {
        verified: true,
        dotNumber: formatted,
        companyName: 'Verified Transport LLC',
        status: 'ACTIVE',
      };

      // Only save to database if it's a real application (not pre-check)
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
    } catch (error) {
      console.error('DOT verification error:', error);
      return { verified: false, error: 'Failed to verify DOT number' };
    }
  }

  /**
   * Determine auto-approval eligibility
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

    // Auto-approve if:
    // 1. MVR check completed and eligible
    // 2. No violations
    // 3. License status is valid
    if (
      application.mvr_check_status === 'completed' &&
      application.mvr_eligible === true &&
      application.mvr_violations_count === 0
    ) {
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

    // Require manual review if violations or failed checks
    await supabaseAdmin
      .from('driver_applications')
      .update({
        requires_manual_review: true,
        manual_review_reason: 'MVR violations or verification issues',
      })
      .eq('id', applicationId);

    return { eligible: false, reason: 'Requires manual review' };
  }
}
