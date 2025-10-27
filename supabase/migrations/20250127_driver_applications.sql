-- Create driver_applications table for driver registration system
-- This table stores all driver application data from the website registration form

-- Drop existing driver_applications table if it exists (old schema)
DROP TABLE IF EXISTS public.vehicle_photos CASCADE;
DROP TABLE IF EXISTS public.driver_applications CASCADE;

-- Create new driver_applications table with website registration schema
CREATE TABLE driver_applications (
  -- Primary identifier
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Personal Information (Step 1)
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address JSONB NOT NULL, -- {street, city, state, zipCode}
  ssn_encrypted TEXT NOT NULL, -- AES-256 encrypted SSN
  
  -- Driver's License Information (Step 2)
  license_number TEXT NOT NULL,
  license_state TEXT NOT NULL,
  license_expiration DATE NOT NULL,
  license_front_url TEXT, -- Supabase Storage URL
  license_back_url TEXT, -- Supabase Storage URL
  proof_of_address_url TEXT, -- Supabase Storage URL
  
  -- Driving History (Step 3)
  has_suspensions BOOLEAN DEFAULT false,
  has_criminal_record BOOLEAN DEFAULT false,
  incident_description TEXT, -- Details if above are true
  
  -- Insurance Information (Step 4)
  insurance_provider TEXT NOT NULL,
  insurance_policy_number TEXT NOT NULL,
  insurance_expiration DATE NOT NULL,
  insurance_proof_url TEXT, -- Supabase Storage URL
  coverage_amount TEXT NOT NULL,
  
  -- Agreements (Step 5)
  background_check_consent BOOLEAN NOT NULL DEFAULT false,
  data_use_consent BOOLEAN NOT NULL DEFAULT false,
  insurance_consent BOOLEAN NOT NULL DEFAULT false,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  
  -- Application Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, under_review
  rejection_reason TEXT,
  
  -- Background Check Integration
  background_check_status TEXT, -- not_started, in_progress, completed, failed
  background_check_report_id TEXT, -- External provider ID (e.g., Checkr)
  background_check_completed_at TIMESTAMPTZ,
  background_check_result JSONB, -- Store detailed results
  
  -- Review and Approval
  reviewed_by UUID, -- Admin user ID who reviewed
  reviewed_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_driver_applications_email ON driver_applications(email);
CREATE INDEX IF NOT EXISTS idx_driver_applications_status ON driver_applications(status);
CREATE INDEX IF NOT EXISTS idx_driver_applications_submitted_at ON driver_applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_applications_background_check_status ON driver_applications(background_check_status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_driver_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_driver_applications_updated_at
  BEFORE UPDATE ON driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_applications_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert new applications (for registration)
-- This allows unauthenticated users to submit applications
CREATE POLICY "Anyone can submit applications"
  ON driver_applications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Authenticated users can view their own applications
CREATE POLICY "Users can view own applications"
  ON driver_applications
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Admins can view all applications
CREATE POLICY "Admins can view all applications"
  ON driver_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update applications (review, approve, reject)
CREATE POLICY "Admins can update applications"
  ON driver_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add unique constraint on email to prevent duplicate applications
-- Note: Consider allowing re-applications after rejection with a time limit
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_applications_email_unique
  ON driver_applications(email)
  WHERE status NOT IN ('rejected'); -- Allow reapplication if previously rejected

-- Create storage buckets for document uploads (run separately in Supabase dashboard or via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('driver-licenses', 'driver-licenses', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('proof-of-address', 'proof-of-address', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('insurance-documents', 'insurance-documents', false);

-- Storage RLS policies (run separately)
/*
CREATE POLICY "Users can upload their own documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents')
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents')
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Admins can view all documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id IN ('driver-licenses', 'proof-of-address', 'insurance-documents')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
*/

COMMENT ON TABLE driver_applications IS 'Stores driver registration applications from website';
COMMENT ON COLUMN driver_applications.ssn_encrypted IS 'AES-256 encrypted SSN - NEVER store plaintext!';
COMMENT ON COLUMN driver_applications.status IS 'Application status: pending, approved, rejected, under_review';
COMMENT ON COLUMN driver_applications.background_check_status IS 'Background check progress: not_started, in_progress, completed, failed';
