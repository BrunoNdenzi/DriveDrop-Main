-- Migration: Consolidate shipment_applications and job_applications tables
-- This migration:
-- 1. Migrates data from shipment_applications to job_applications
-- 2. Drops the shipment_applications table
-- 3. Creates a view for backward compatibility

-- Step 1: Migrate data from shipment_applications to job_applications if needed
-- First check if both tables exist and have data
DO $$
DECLARE
  app_count INTEGER;
BEGIN
  -- Check if shipment_applications table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_applications') THEN
    -- Count records in shipment_applications
    SELECT COUNT(*) INTO app_count FROM public.shipment_applications;
    
    -- If there are records to migrate
    IF app_count > 0 THEN
      -- Insert records from shipment_applications to job_applications
      -- avoiding duplicates based on shipment_id + driver_id
      INSERT INTO public.job_applications (
        shipment_id,
        driver_id,
        status,
        applied_at,
        created_at,
        updated_at
      )
      SELECT
        sa.shipment_id,
        sa.driver_id,
        sa.status,
        sa.applied_at,
        sa.created_at,
        sa.created_at AS updated_at
      FROM public.shipment_applications sa
      WHERE NOT EXISTS (
        SELECT 1 FROM public.job_applications ja
        WHERE ja.shipment_id = sa.shipment_id AND ja.driver_id = sa.driver_id
      );
      
      RAISE NOTICE 'Migrated % records from shipment_applications to job_applications', app_count;
    ELSE
      RAISE NOTICE 'No records to migrate from shipment_applications';
    END IF;
  ELSE
    RAISE NOTICE 'shipment_applications table does not exist, no migration needed';
  END IF;
END $$;

-- Step 2: Add any missing indexes to job_applications table
CREATE INDEX IF NOT EXISTS job_applications_shipment_id_idx ON public.job_applications(shipment_id);
CREATE INDEX IF NOT EXISTS job_applications_driver_id_idx ON public.job_applications(driver_id);
CREATE INDEX IF NOT EXISTS job_applications_status_idx ON public.job_applications(status);

-- Step 3: Drop the shipment_applications table if it exists
DROP TABLE IF EXISTS public.shipment_applications;

-- Step 4: Now create the view for backward compatibility after the old table is gone
CREATE OR REPLACE VIEW shipment_applications_view AS
SELECT
  id,
  shipment_id,
  driver_id,
  status,
  applied_at,
  created_at,
  updated_at
FROM job_applications;

-- Step 5: Update database.types.ts (this needs to be done manually in the TypeScript code)
-- Add a comment to help developers update the types
COMMENT ON VIEW shipment_applications_view IS 'Compatibility view for the removed shipment_applications table. Applications should use job_applications table directly.';
