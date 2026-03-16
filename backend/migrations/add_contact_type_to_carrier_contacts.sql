-- Migration: Add contact_type to carrier_contacts
-- Expands the carrier_contacts table to store broker, dealership, and shipper
-- contacts in addition to FMCSA carriers.
--
-- Run via Supabase SQL editor or psql.

-- 1. Add contact_type column (default 'carrier' keeps all existing rows valid)
ALTER TABLE public.carrier_contacts
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'carrier'
  CONSTRAINT carrier_contacts_contact_type_check
  CHECK (contact_type IN ('carrier', 'broker', 'dealership', 'shipper'));

-- 2. Make dot_number nullable — brokers/shippers/dealerships don't have a DOT
ALTER TABLE public.carrier_contacts
  ALTER COLUMN dot_number DROP NOT NULL;

-- 3. Drop the old unique constraint on dot_number (it fails for NULLs anyway,
--    but this makes the intent explicit)
ALTER TABLE public.carrier_contacts
  DROP CONSTRAINT IF EXISTS carrier_contacts_dot_number_key;

-- 4. Replace with a partial unique index: unique DOT only when it is set
CREATE UNIQUE INDEX IF NOT EXISTS carrier_contacts_dot_number_unique
  ON public.carrier_contacts (dot_number)
  WHERE dot_number IS NOT NULL;

-- 5. Add a generated unique identifier for non-DOT contacts so the table has
--    a stable natural key: (contact_type, company_name, email) — soft uniqueness.
--    No hard constraint because emails can be missing at insert time.

-- 6. Index on contact_type for fast tab queries
CREATE INDEX IF NOT EXISTS carrier_contacts_contact_type_idx
  ON public.carrier_contacts (contact_type);

-- 7. Update RLS policies if needed (carrier_contacts is admin-only, so no user-facing RLS)
-- No change required — existing policies remain valid.

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carrier_contacts' AND column_name = 'contact_type'
  ) THEN
    RAISE EXCEPTION 'Migration failed: contact_type column not found';
  END IF;
  RAISE NOTICE 'Migration successful: contact_type added to carrier_contacts';
END $$;
