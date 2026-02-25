-- ============================================================================
-- Migration: broker_change_requests table + broker_carriers RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Create broker_change_requests table for business info change approvals
CREATE TABLE IF NOT EXISTS public.broker_change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES public.broker_profiles(id) ON DELETE CASCADE,
  changes JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for broker_change_requests
ALTER TABLE public.broker_change_requests ENABLE ROW LEVEL SECURITY;

-- Brokers can view their own change requests
CREATE POLICY "Brokers can view own change requests"
  ON public.broker_change_requests FOR SELECT
  USING (
    broker_id IN (
      SELECT id FROM public.broker_profiles WHERE profile_id = auth.uid()
    )
  );

-- Brokers can insert their own change requests
CREATE POLICY "Brokers can create change requests"
  ON public.broker_change_requests FOR INSERT
  WITH CHECK (
    broker_id IN (
      SELECT id FROM public.broker_profiles WHERE profile_id = auth.uid()
    )
  );

-- Admins can view all change requests
CREATE POLICY "Admins can view all change requests"
  ON public.broker_change_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update change requests (approve/reject)
CREATE POLICY "Admins can update change requests"
  ON public.broker_change_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Ensure broker_carriers has proper RLS for drivers to update their invitations
-- Allow drivers to read their own carrier relationships
DO $$ BEGIN
  CREATE POLICY "Drivers can view own carrier relationships"
    ON public.broker_carriers FOR SELECT
    USING (carrier_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow drivers to update their own carrier relationships (accept/decline invitations)
DO $$ BEGIN
  CREATE POLICY "Drivers can update own carrier relationships"
    ON public.broker_carriers FOR UPDATE
    USING (carrier_id = auth.uid())
    WITH CHECK (carrier_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow brokers to manage carrier relationships they created
DO $$ BEGIN
  CREATE POLICY "Brokers can manage own carrier relationships"
    ON public.broker_carriers FOR ALL
    USING (
      broker_id IN (
        SELECT id FROM public.broker_profiles WHERE profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS is enabled on broker_carriers
ALTER TABLE public.broker_carriers ENABLE ROW LEVEL SECURITY;

-- 3. Grant permissions
GRANT SELECT, INSERT ON public.broker_change_requests TO authenticated;
GRANT UPDATE ON public.broker_change_requests TO authenticated;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_broker_change_requests_broker_id 
  ON public.broker_change_requests(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_change_requests_status 
  ON public.broker_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_broker_carriers_carrier_id 
  ON public.broker_carriers(carrier_id);
