-- Add MVR and DOT verification fields to driver_applications table
-- Required for FCRA-compliant driver verification flow

-- MVR Check Fields (FCRA-compliant vendor: Checkr/HireRight/Truework)
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_check_status TEXT; -- not_started, pending, completed, failed
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_check_vendor TEXT; -- checkr, hireright, truework
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_check_id TEXT; -- Vendor's check ID
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_check_result JSONB; -- Full MVR report data
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_check_completed_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_violations_count INTEGER DEFAULT 0;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_eligible BOOLEAN; -- Auto-approval eligible
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_ineligible_reasons TEXT[]; -- Array of disqualification reasons

-- DOT Verification Fields (FMCSA SAFER lookup - free)
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS dot_number TEXT;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS dot_verified BOOLEAN DEFAULT false;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS dot_company_name TEXT;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS dot_status TEXT; -- ACTIVE, INACTIVE, OUT_OF_SERVICE
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS dot_verified_at TIMESTAMPTZ;

-- FCRA Compliance Fields (Critical)
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS fcra_disclosure_shown_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS fcra_consent_obtained_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS fcra_consent_ip_address INET;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS fcra_consent_signature TEXT; -- Electronic signature
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS adverse_action_pre_notice_sent_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS adverse_action_final_sent_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS mvr_report_copy_provided_at TIMESTAMPTZ;

-- Auto-approval tracking
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMPTZ;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false;
ALTER TABLE driver_applications ADD COLUMN IF NOT EXISTS manual_review_reason TEXT;

-- Create indexes for verification queries
CREATE INDEX IF NOT EXISTS idx_driver_applications_mvr_status ON driver_applications(mvr_check_status);
CREATE INDEX IF NOT EXISTS idx_driver_applications_dot_number ON driver_applications(dot_number) WHERE dot_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_applications_mvr_eligible ON driver_applications(mvr_eligible) WHERE mvr_eligible = true;
CREATE INDEX IF NOT EXISTS idx_driver_applications_requires_review ON driver_applications(requires_manual_review) WHERE requires_manual_review = true;

COMMENT ON COLUMN driver_applications.mvr_check_status IS 'MVR check progress via FCRA-compliant vendor';
COMMENT ON COLUMN driver_applications.mvr_eligible IS 'True if MVR shows clean record eligible for auto-approval';
COMMENT ON COLUMN driver_applications.dot_verified IS 'True if DOT number verified via FMCSA SAFER lookup';
COMMENT ON COLUMN driver_applications.fcra_consent_obtained_at IS 'Timestamp when driver provided written authorization for MVR check';
COMMENT ON COLUMN driver_applications.auto_approved IS 'True if application was auto-approved based on clean MVR + DOT verification';
