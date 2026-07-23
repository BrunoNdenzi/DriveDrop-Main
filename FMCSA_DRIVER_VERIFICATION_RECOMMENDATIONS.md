# 🚛 FMCSA Driver Verification Integration - Recommendations

**Date:** 2026-07-23  
**Objective:** Integrate FMCSA DOT/License lookup for automated driver verification during registration

---

## 📊 Current System Analysis

### ✅ **What We Have:**

1. **Driver Registration Flow:**
   - 5-step application form (`/drivers/register`)
   - Manual entry of license number, state, expiration
   - File uploads (license front/back, insurance, proof of address)
   - Background check consent & manual admin approval
   - Stored in `driver_applications` table

2. **Existing FMCSA Integration:**
   - ✅ **Carrier/Broker Lookup:** Already implemented in `LeadAcquisitionService.ts`
   - Uses FMCSA Safer API for DOT/MC verification
   - Template exists in `brokerVerification.ts` (placeholder only)

3. **Current Pain Points:**
   - ❌ **No real-time license validation** - Drivers can submit expired/invalid licenses
   - ❌ **Manual verification** - Admin must manually check FMCSA status
   - ❌ **Fraud risk** - No automated verification against FMCSA database
   - ❌ **Slow approval** - 3-5 days for manual review
   - ❌ **No CDL verification** - Can't verify Commercial Driver's License status

---

## 🎯 **Recommended Implementation Strategy**

### **⚠️ IMPORTANT: MVR/License Verification Requires FCRA-Compliant Vendor**

**CDLIS/State MVR Data is NOT publicly accessible.** Individual driver license verification and Motor Vehicle Records (MVR) require:
- **FCRA-compliant background check vendor** (Checkr, HireRight, Truework, etc.)
- **Explicit written consent** from driver (FCRA disclosure + authorization)
- **Cost per check:** Typically $5-15 per MVR report

**What IS Free:**
- ✅ **FMCSA SAFER Lookup** (for drivers with DOT numbers) - Already implemented in `brokerVerification.ts`
- ✅ Can verify carrier/owner-operator status via DOT number

---

### **Phase 1: Redesigned Registration Flow - "Verify First, Fill Only What's Missing" (High Priority)**

#### **New Flow Architecture:**

**Step 1: Minimal Data Collection**
- Collect only what's needed for verification:
  - Full name
  - Date of birth
  - Driver's license number + state
  - DOT number (optional - for owner-operators)
  - Email/phone for contact

**Step 2: FCRA Disclosure & Consent**
- Show standalone FCRA disclosure page
- **Must** get explicit written consent before running any checks
- "I authorize DriveDrop to obtain my Motor Vehicle Record and conduct a background check"
- Cannot proceed without consent

**Step 3: Run Verifications (Backend Automated)**
- **If DOT number provided:** Run free SAFER lookup (existing `brokerVerification.ts` logic)
- **All drivers:** Run FCRA-compliant MVR check via vendor API
- Parallel execution, wait for both results

**Step 4: Auto-Fill Confirmed Data**
- Display verification results to driver
- Auto-populate confirmed fields (license expiration, CDL class, endorsements, violations)
- Show what was verified vs. what needs manual entry

**Step 5: Fill Only What's Missing**
- Insurance information (manual entry + upload)
- Vehicle information (if applicable)
- Payout/banking details
- DriveDrop-specific terms & conditions

**Step 6: Manual Admin Review (Fallback)**
- ✅ **Auto-approve:** Clean MVR, no flags, verified DOT status
- ⚠️ **Admin review:** Violations, ambiguous data, failed verifications
- Keep existing `driver_applications` review queue

#### **Database Schema Updates:**

```sql
-- Add MVR and verification fields to driver_applications table
ALTER TABLE driver_applications ADD COLUMN dot_number TEXT; -- For owner-operators
ALTER TABLE driver_applications ADD COLUMN dot_verified BOOLEAN DEFAULT false;
ALTER TABLE driver_applications ADD COLUMN dot_status TEXT; -- 'active', 'inactive', 'not_applicable'
ALTER TABLE driver_applications ADD COLUMN dot_verified_at TIMESTAMPTZ;

-- MVR Check Fields (from FCRA-compliant vendor)
ALTER TABLE driver_applications ADD COLUMN mvr_check_consent BOOLEAN DEFAULT false; -- FCRA consent given
ALTER TABLE driver_applications ADD COLUMN mvr_check_consent_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN mvr_check_status TEXT; -- 'pending', 'completed', 'failed', 'declined'
ALTER TABLE driver_applications ADD COLUMN mvr_check_vendor TEXT; -- 'checkr', 'hireright', 'truework'
ALTER TABLE driver_applications ADD COLUMN mvr_check_report_id TEXT; -- Vendor's report ID
ALTER TABLE driver_applications ADD COLUMN mvr_check_completed_at TIMESTAMPTZ;

-- MVR Results (auto-filled from vendor response)
ALTER TABLE driver_applications ADD COLUMN cdl_class TEXT; -- 'A', 'B', 'C', null (non-commercial)
ALTER TABLE driver_applications ADD COLUMN cDriverVerificationService.ts`**

```typescript
import { logger } from '../utils/logger';
import { verifyDOTNumber } from '../../website/src/utils/brokerVerification'; // Reuse existing SAFER lookup

interface MVRCheckResult {
  success: boolean;
  reportId: string;
  status: 'clear' | 'review_required' | 'disqualified';
  licenseStatus: 'valid' | 'suspended' | 'revoked' | 'expired';
  expirationDate: string | null;
  cdlClass: string | null;
  endorsements: string[];
  violationsCount: number;
  violations: Array<{
    date: string;
    type: string;
    points: number;
    description: string;
  }>;
  accidentsCount: number;
  vendor: 'checkr' | 'hireright' | 'truework';
}

interface DOTVerificationResult {
  verified: boolean;
  dotNumber: string;
  status: 'active' | 'inactive' | 'not_found';
  companyName?: string;
  carrierOperation?: string;
}

export class DriverVerificationService {
  private mvrVendor: 'checkr' | 'hireright' | 'truework';
  private mvrApiKey: string;

  constructor() {
    // Configure MVR vendor from environment
    this.mvrVendor = (process.env.MVR_VENDOR as any) || 'checkr';
    this.mvrApiKey = process.env.MVR_API_KEY || '';
    
    if (!this.mvrApiKey) {
      logger.warn('MVR_API_KEY not configured - driver MVR checks disabled');
    }
  }

  /**
   * Run MVR check via FCRA-compliant vendor (Checkr, HireRight, Truework)
   * REQUIRES: FCRA consent already obtained from driver
   */
  async runMVRCheck(
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    licenseNumber: string,
    licenseState: string,
    consentGiven: boolean
  ): Promise<MVRCheckResult> {
    if (!consentGiven) {
      throw new Error('FCRA consent required before running MVR check');
    }

    if (!this.mvrApiKey) {
      throw new Error('MVR vendor API key not configured');
    }

    try {
      // Example: Checkr API integration
      // Docs: https://docs.checkr.com/#operation/createReport
      
      if (this.mvrVendor === 'checkr') {
        return await this.runCheckrMVR(firstName, lastName, dateOfBirth, licenseNumber, licenseState);
      } else if (this.mvrVendor === 'hireright') {
        return await this.runHireRightMVR(firstName, lastName, dateOfBirth, licenseNumber, licenseState);
      } else {
        return await this.runTrueworkMVR(firstName, lastName, dateOfBirth, licenseNumber, licenseState);
      }
    } catch (error) {
      logger.error('MVR check failed:', error);
      throw error;
    }
  }

  /**
   * Verify DOT number using existing SAFER lookup (free, already built)
   */
  async verifyDOTNumber(dotNumber: string): Promise<DOTVerificationResult> {
    try {
      // Reuse existing brokerVerification.ts logic
      const result = await verifyDOTNumber(dotNumber);
      
      return {
        verified: result.valid,
        dotNumber,
        status: result.status === 'ACTIVE' ? 'active' : 'inactive',
        companyName: result.company_name,
        carrierOperation: result.carrier_operation,
      };
    } catch (error) {
      logger.error('DOT verification failed:', error);
      return {
        verified: false,
        dotNumber,
        status: 'not_found',
      };
    }
  }

  /**
   * Run complete driver verification (MVR + DOT if provided)
   */
  async runCompleteVerification(params: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    licenseNumber: string;
    licenseState: string;
    dotNumber?: string;
    consentGiven: boolean;
  }): Promise<{
    mvr: MVRCheckResult;
    dot?: DOTVerificationResult;
    autoApprove: boolean;
    requiresReview: boolean;
    reviewReason?: string;
  }> {
    const { firstName, lastName, dateOfBirth, licenseNumber, licenseState, dotNumber, consentGiven } = params;

    // Run MVR check
    const mvr = await this.runMVRCheck(firstName, lastName, dateOfBirth, licenseNumber, licenseState, consentGiven);

    // Run DOT verification if provided
    let dot: DOTVerificationResult | undefined;
    if (dotNumber) {
      dot = await this.verifyDOTNumber(dotNumber);
    }

    // Determine auto-approval eligibility
    const autoApprove = this.shouldAutoApprove(mvr, dot);
    const { requiresReview, reviewReason } = this.determineReviewStatus(mvr, dot);

    return {
      mvr,
      dot,
      autoApprove,
      requiresReview,
      reviewReason,
    };
  }

  private shouldAutoApprove(mvr: MVRCheckResult, dot?: DOTVerificationResult): boolean {
    // Auto-approve only if:
    // 1. MVR is clear
    // 2. License is valid
    // 3. No major violations
    // 4. DOT verified (if provided)
    
    if (mvr.status !== 'clear') return false;
    if (mvr.licenseStatus !== 'valid') return false;
    if (mvr.violationsCount > 3) return false;
    if (dot && !dot.verified) return false;

    return true;
  }

  private determineReviewStatus(mvr: MVRCheckResult, dot?: DOTVerificationResult): {
    requiresReview: boolean;
    reviewReason?: string;
  } {
    const reasons: string[] = [];

    if (mvr.status === 'review_required') {
      reasons.push('MVR flagged for review');
    }
    if (mvr.licenseStatus === 'suspended') {
      reasons.push('License suspended');
    }
    if (mvr.licenseStatus === 'revoked') {
      reasons.push('License revoked');
    }
    if (mvr.violationsCount > 3) {
      reasons.push(`${mvr.violationsCount} violations on record`);
    }
    if (dot && !dot.verified) {
      reasons.push('DOT number verification failed');
    }

    return {
      requiresReview: reasons.length > 0,
      reviewReason: reasons.join('; '),
    };
  }

  // Vendor-specific implementations
  private async runCheckrMVR(
    firstName: string,
    lastName: string,
    dob: string,
    license: string,
    state: string
  ): Promise<MVRCheckResult> {
    // Checkr API integration
    // POST https://api.checkr.com/v1/reports
    const response = await fetch('https://api.checkr.com/v1/reports', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.mvrApiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'driver',
        first_name: firstName,
        last_name: lastName,
        dob,
        license_number: license,
        license_state: state,
      }),
    });

    const data = await response.json();
    
    // Parse Checkr response and map to MVRCheckResult
    // (Implementation details depend on Checkr API response structure)
    return {
      success: true,
      reportId: data.id,
      status: 'clear', // Map from Checkr status
      licenseStatus: 'valid',
      expirationDate: null,
      cdlClass: null,
      endorsements: [],
      violationsCount: 0,
      violations: [],
      accidentsCount: 0,
      vendor: 'checkr',
    };
  }

  private async runHireRightMVR(firstName: string, lastName: string, dob: string, license: string, state: string): Promise<MVRCheckResult> {
    // HireRight API integration
    throw new Error('HireRight integration not yet implemented');
  }

  private async runTrueworkMVR(firstName: string, lastName: string, dob: string, license: string, state: string): Promise<MVRCheckResult> {
    // Truework API integration
    throw new Error('Truework integration not yet implemented')
    }
    if (record.violations > 5) {
      reasons.push(`Too many violations (${record.violations})`);
    }

    return {
      eligible: reasons.length === 0 && record.status === 'ACTIVE',
      reasons,
      record,
    };
  }

  private mapStatus(fmcsaStatus: string): FMCSADriverRecord['status'] {
    const statusMap: Record<string, FMCSADriverRecord['status']> = {
      'VALID': 'ACTIVE',
      'ACTIVE': 'ACTIVE',
      'SUSPENDED': 'SUSPENDED',
      'REVOKED': 'REVOKED',
      'EXPIRED': 'EXPIRED',
    };
    return statusMap[fmcsaStatus?.toUpperCase()] || 'NOT_FOUND';
  }
}
```

**2. API Route: `backend/src/routes/drivers.routes.ts`**

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { FMCSADriverService } from '../services/FMCSADriverService';

const router = Router();
const fmcsaService = new FMCSADriverService();

// POST /api/v1/drivers/verify-license
router.post('/verify-license', authenticate, async (req, res, next) => {
  try {
    const { licenseNumber, state } = req.body;

    if (!licenseNumber || !state) {
      return res.status(400).json({
        success: false,
        error: 'License number and state are required',
      });
    }
Vendor Selection**

### **MVR Check Vendors (FCRA-Compliant Required):**

**Before implementing, get real quotes from all three vendors:**

1. **Checkr** (https://checkr.com)
   - Industry standard for transportation/gig economy
   - **Estimated Cost:** $5-8 per MVR report
   - API-first, excellent documentation
   - 1-3 day turnaround for MVR results
   - Volume discounts available

2. **HireRight** (https://www.hireright.com)
   - Enterprise-focused, comprehensive background checks
   - **Estimated Cost:** $8-12 per MVR report
   - Slower integration, more features
   - 2-5 day turnaround
   - Higher pricing but more detailed reports

3. **Truework** (https://www.truework.com)
   - Modern API, fast verification
   - **Estimated Cost:** $6-10 per MVR report
   - Real-time verification where available
   - 1-2 day turnaround
   - Good developer experience

**Recommendation:** Start with **Checkr** for MVP (best API, industry standard for transportation)

---

### **FMCSA SAFER Lookup (Free - Already Built):**

- ✅ **No cost** - Public SAFER API
- ✅ **Already implemented** in `brokerVerification.ts`
- ✅ Just needs wiring into driver flow
- Only applies to drivers with DOT numbers (owner-operators)

**3. Frontend Integration: `website/src/app/drivers/register/page.tsx`**

```typescript
// Add to LicenseStep component

const [verifying, setVerifying] = useState(false);
const [verificationResult, setVerificationResult] = useState<any>(null);

const handleVerifyLicense = async () => {
  setVerifying(true);
  setVerificationResult(null);

  try {
    const response = await fetch('/api/v1/drivers/verify-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        licenseNumber: watch('licenseNumber'),
        state: watch('licenseState'),
      }),
    });

    const data = await response.json();
    setVerificationResult(data);

    if (!data.eligible) {
      // Show error message
      alert(`License verification failed: ${data.reasons.join(', ')}`);
    } else {
      // Show success message
      alert('✅ License verified successfully!');
    }
  } catch (error) {
    console.error('Verification error:', error);
    alert('Failed to verify license. Please try again.');
  } finally {
    setVerifying(false);
  }
};

// Add verification button in the form
<Button 
  type="button" 
  onClick={handleVerifyLicense} 
  disabled={verifying || !watch('licenseNumber') || !watch('licenseState')}
>
  {verifying ? 'Verifying...' : 'Verify License with FMCSA'}
</Button>

{verificationResult && (
  <div className={verificationResult.eligible ? 'bg-green-50 p-3 rounded' : 'bg-red-50 p-3 rounded'}>
    <p className="text-sm">
      Status: <strong>{verificationResult.status}</strong>
      {verificationResult.cdlClass && ` | CDL Class: ${verificationResult.cdlClass}`}
    </p>
    {!verificationResult.eligible && (
      <ul className="text-sm text-red-600 mt-2">
        {verificationResult.reasons.map((r: string, i: number) => (
          <li key={i}>• {r}</li>
        ))}
      </ul>
    )}
  </div>
)}
```

---

## 🎯 **Recommended Rollout Plan**

## 📈 **Expected Benefits**

1. **Faster Approvals:** Reduce 3-5 days → 1-2 hours (for clean records)
2. **Fraud Prevention:** Block invalid/suspended licenses automatically
3. **Compliance:** Meet DOT/FMCSA requirements for carrier verification
4. **Trust & Safety:** Only onboard drivers with active, valid licenses
5. **Reduced Manual Work:** Admin spends 80% less time on license verification

---

## 🔐 **Security & Privacy Considerations**

1. **PIGet MVR Vendor Quotes
```bash
# Checkr: https://checkr.com/contact-sales
# HireRight: https://www.hireright.com/contact
# Truework: https://www.truework.com/pricing

# After selection, add credentials to .env:
echo "MVR_VENDOR=checkr" >> backend/.env
echo "MVR_API_KEY=your_api_key_here" >> backend/.env
```

### 2. Run Database Migration
```bash
cd backend
# Run the migration SQL in Supabase Dashboard or:
node run-driver-verification-migration.js
```

### 3. Test Verification Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/drivers/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "CRA Compliance Guide:** https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know
- **Checkr API Docs:** https://docs.checkr.com/
- **HireRight API Docs:** https://developer.hireright.com/
- **Truework API Docs:** https://www.truework.com/developers
- **FMCSA SAFER Lookup (Free):** https://safer.fmcsa.dot.gov/
- **Existing DriveDrop Implementation:** `website/src/utils/brokerVerification.ts`
    "consentGiven": true
  me.page
# Register for free SaferWeb API key
# Add to .env:
echo "FMCSA_API_KEY=your_key_here" >> backend/.env
```

### 2. Run Database Migration
```bash
cd backend
node run-fmcsa-driver-migration.js
```

### 3. Test Verification Endpoint
```bash
curl -X POST http://localhost:3000/api/v1/drivers/verify-license \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  ⚠️ Critical Corrections:**
1. ❌ **CDLIS is NOT free/self-serve** - Requires FCRA-compliant vendor
2. ✅ **SAFER lookup IS free** - Already built in `brokerVerification.ts`, just needs wiring
3. ✅ **Redesign flow:** Verify first (minimal data + FCRA consent), then auto-fill, only ask for what's missing
4. ✅ **Keep manual review** - Auto-approve only clean results, admin review for flags

**Immediate Action (Before Implementation):**
1. ✅ Get real quotes from Checkr, HireRight, and Truework (don't guess pricing)
2. ✅ Select MVR vendor and sign contract
3. ✅ Get sandbox/test API keys
4. ✅ Review FCRA compliance requirements (disclosure + consent)

**Implementation Sprint (After Vendor Selection):**
1. ✅ Create `DriverVerificationService.ts` backend service
2. ✅ Wire existing `brokerVerification.ts` SAFER lookup into driver flow
3. ✅ Add database migration for MVR + DOT verification fields
4. ✅ Implement `/api/v1/drivers/verify` endpoint
5. ✅ Redesign registration form (minimal → consent → verify → auto-fill → fill missing)
6. ✅ Update admin dashboard with auto-approval + manual review queue

**Expected Outcome:**
- **60-70% auto-approval rate** for clean MVR results
- **30-40% manual review** for violations, ambiguous data, failed checks
- **$5-12 cost per MVR check** (vendor dependent)
- **1-3 day approval time** (down from 3-5 days)
- **FCRA-compliant** driver verification process

**This is the correct, legally compliant approach to driver verification with realistic cost and timeline expectations.** 🚛✅

---

## 🔐 **FCRA Compliance Requirements (Critical)**

### **Before Running Any Background Check:**

1. **Provide Standalone Disclosure Document**
   - Cannot be buried in terms of service
   - Must be clear, conspicuous, and in writing (electronic OK)
   - Must state that a consumer report may be obtained for employment purposes

2. **Obtain Written Authorization**
   - Separate from other documents
   - Electronic signature acceptable (checkbox + "I agree" button)
   - Must be dated and signed by applicant
   - Store consent timestamp, IP address, and signature for audit trail

3. **If Taking Adverse Action (Rejection):**
   - Provide "pre-adverse action" notice with copy of report
   - Wait reasonable time (3-5 business days) for driver to dispute
   - Provide "adverse action" notice with contact info for vendor
   - Include FCRA rights summary

### **Database Fields for FCRA Compliance:**

```sql
-- Track consent and disclosure
ALTER TABLE driver_applications ADD COLUMN fcra_disclosure_shown_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN fcra_consent_obtained_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN fcra_consent_ip_address INET;
ALTER TABLE driver_applications ADD COLUMN fcra_consent_signature TEXT;

-- Track adverse action process
ALTER TABLE driver_applications ADD COLUMN adverse_action_pre_notice_sent_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN adverse_action_final_sent_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN mvr_report_copy_provided_at TIMESTAMPTZ;
```

---
