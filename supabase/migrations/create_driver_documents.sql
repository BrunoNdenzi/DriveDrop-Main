-- ============================================================
-- Create driver_documents table
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK (document_type IN ('license', 'insurance', 'registration', 'background_check', 'other')),
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  expiry_date     DATE,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at     TIMESTAMPTZ,
  verified_by     UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  notes           TEXT
);

-- Index for fast lookup by driver
CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id
  ON public.driver_documents(driver_id);

-- Index for admin view (filter by status)
CREATE INDEX IF NOT EXISTS idx_driver_documents_status
  ON public.driver_documents(status);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own documents
CREATE POLICY "Drivers can view own documents"
  ON public.driver_documents
  FOR SELECT
  USING (driver_id = auth.uid());

-- Drivers can insert their own documents
CREATE POLICY "Drivers can upload own documents"
  ON public.driver_documents
  FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Drivers can delete their own pending documents
CREATE POLICY "Drivers can delete own pending documents"
  ON public.driver_documents
  FOR DELETE
  USING (driver_id = auth.uid() AND status = 'pending');

-- Admins can view all documents (via service role client — no policy needed for service key)
-- The service role bypasses RLS automatically.
