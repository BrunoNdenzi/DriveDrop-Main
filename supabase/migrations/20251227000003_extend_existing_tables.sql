-- ============================================================================
-- Extend Existing Tables for Commercial Features
-- Migration: 20251227000003
-- Description: Safely adds new columns to existing tables with defaults
-- Author: DriveDrop Development Team
-- Date: December 27, 2025
-- ============================================================================

-- ============================================================================
-- EXTEND SHIPMENTS TABLE
-- Add commercial fields while keeping residential shipments working
-- ============================================================================

-- Commercial Classification
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS is_commercial BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.shipments.is_commercial IS 'FALSE = residential (current), TRUE = commercial/B2B';

-- Commercial Account Reference
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS commercial_account_id UUID REFERENCES public.commercial_accounts(id);

-- Bulk Upload Tracking
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS bulk_upload_id UUID REFERENCES public.bulk_uploads(id);

-- Bill of Lading Reference
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS bol_id UUID REFERENCES public.bills_of_lading(id);

-- Multiple Vehicles Support (for batches)
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS parent_shipment_id UUID REFERENCES public.shipments(id),
    ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
    ADD COLUMN IF NOT EXISTS is_batch_parent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.shipments.parent_shipment_id IS 'For grouped shipments - links to parent batch';
COMMENT ON COLUMN public.shipments.sequence_number IS 'Order in batch (1, 2, 3, etc.)';
COMMENT ON COLUMN public.shipments.is_batch_parent IS 'TRUE if this is parent of a batch';

-- Enhanced Vehicle Details (commercial requirements)
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_mileage INTEGER,
    ADD COLUMN IF NOT EXISTS vehicle_license_plate TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_title_status TEXT CHECK (vehicle_title_status IN (
        'clean', 'salvage', 'rebuilt', 'lien', 'pending', 'missing', NULL
    )),
    ADD COLUMN IF NOT EXISTS vehicle_keys_location TEXT CHECK (vehicle_keys_location IN (
        'ignition', 'console', 'office', 'driver', 'missing', 'unknown', NULL
    ));

-- Auction-Specific Fields
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS lot_number TEXT,
    ADD COLUMN IF NOT EXISTS auction_house TEXT,
    ADD COLUMN IF NOT EXISTS sale_date TIMESTAMPTZ;

-- Source Tracking
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web_form' CHECK (source IN (
        'web_form', 
        'mobile_app', 
        'bulk_upload', 
        'api', 
        'auction_integration', 
        'email', 
        'phone',
        'natural_language',
        NULL
    )),
    ADD COLUMN IF NOT EXISTS source_reference TEXT; -- External reference ID

COMMENT ON COLUMN public.shipments.source IS 'How shipment was created';
COMMENT ON COLUMN public.shipments.source_reference IS 'External ID from source system (lot #, order #, etc.)';

-- Payment Terms (commercial billing)
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS payment_terms TEXT CHECK (payment_terms IN (
        'immediate', 'net_7', 'net_15', 'net_30', 'net_60', 'net_90', NULL
    )),
    ADD COLUMN IF NOT EXISTS invoice_number TEXT,
    ADD COLUMN IF NOT EXISTS po_number TEXT; -- Purchase Order number

-- Integration Source
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.auction_integrations(id);

COMMENT ON COLUMN public.shipments.integration_id IS 'If created via integration, references auction_integrations table';

-- AI Processing
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS ai_created BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_prompt_id UUID REFERENCES public.ai_shipment_prompts(id),
    ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

COMMENT ON COLUMN public.shipments.ai_created IS 'TRUE if created via natural language AI';
COMMENT ON COLUMN public.shipments.ai_confidence IS 'AI confidence score if AI-created (0.00-1.00)';

-- Additional Metadata for Commercial
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS special_handling_requirements TEXT,
    ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS high_value BOOLEAN DEFAULT FALSE; -- Flag for >$100k vehicles

-- ============================================================================
-- Create Indexes for New Columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_shipments_is_commercial ON public.shipments(is_commercial);
CREATE INDEX IF NOT EXISTS idx_shipments_commercial_account_id ON public.shipments(commercial_account_id);
CREATE INDEX IF NOT EXISTS idx_shipments_bulk_upload_id ON public.shipments(bulk_upload_id);
CREATE INDEX IF NOT EXISTS idx_shipments_parent_shipment_id ON public.shipments(parent_shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_source ON public.shipments(source);
CREATE INDEX IF NOT EXISTS idx_shipments_integration_id ON public.shipments(integration_id);
CREATE INDEX IF NOT EXISTS idx_shipments_lot_number ON public.shipments(lot_number);
CREATE INDEX IF NOT EXISTS idx_shipments_high_value ON public.shipments(high_value) WHERE high_value = TRUE;

-- ============================================================================
-- EXTEND PROFILES TABLE
-- Add commercial user type
-- ============================================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'client' CHECK (user_type IN (
        'client', 'driver', 'broker', 'admin', 'commercial_client'
    ));

-- Backfill existing data
UPDATE public.profiles
SET user_type = 'client'
WHERE user_type IS NULL AND role = 'client';

UPDATE public.profiles
SET user_type = 'driver'
WHERE user_type IS NULL AND role = 'driver';

UPDATE public.profiles
SET user_type = 'broker'
WHERE user_type IS NULL AND role = 'broker';

UPDATE public.profiles
SET user_type = 'admin'
WHERE user_type IS NULL AND role = 'admin';

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- ============================================================================
-- EXTEND BROKER_SHIPMENTS TABLE
-- Add reference to bulk uploads
-- ============================================================================
ALTER TABLE public.broker_shipments
    ADD COLUMN IF NOT EXISTS bulk_upload_id UUID REFERENCES public.bulk_uploads(id),
    ADD COLUMN IF NOT EXISTS bol_id UUID REFERENCES public.bills_of_lading(id);

CREATE INDEX IF NOT EXISTS idx_broker_shipments_bulk_upload_id ON public.broker_shipments(bulk_upload_id);

-- ============================================================================
-- DATA INTEGRITY
-- Set defaults for existing records
-- ============================================================================

-- Ensure all existing shipments are marked as residential (is_commercial = FALSE)
UPDATE public.shipments
SET is_commercial = FALSE
WHERE is_commercial IS NULL;

-- Set source for existing shipments if NULL
UPDATE public.shipments
SET source = CASE
    WHEN metadata::text LIKE '%mobile%' THEN 'mobile_app'
    ELSE 'web_form'
END
WHERE source IS NULL;

-- ============================================================================
-- VALIDATION CONSTRAINTS
-- ============================================================================

-- Commercial shipments must have commercial_account_id
-- (We'll enforce this in application logic, not database constraint)

-- High-value shipments need insurance
CREATE OR REPLACE FUNCTION check_high_value_insurance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.high_value = TRUE AND (NEW.insurance_required = FALSE OR NEW.insurance_amount IS NULL) THEN
        RAISE EXCEPTION 'High-value shipments (>$100k) must have insurance';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_high_value_insurance ON public.shipments;
CREATE TRIGGER trigger_check_high_value_insurance
    BEFORE INSERT OR UPDATE ON public.shipments
    FOR EACH ROW
    WHEN (NEW.high_value = TRUE)
    EXECUTE FUNCTION check_high_value_insurance();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get shipment batch
CREATE OR REPLACE FUNCTION get_shipment_batch(parent_id UUID)
RETURNS TABLE (
    id UUID,
    sequence_number INTEGER,
    vehicle_vin TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.sequence_number,
        s.vehicle_vin,
        s.status,
        s.created_at
    FROM public.shipments s
    WHERE s.parent_shipment_id = parent_id
    ORDER BY s.sequence_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check if shipment is part of bulk upload
CREATE OR REPLACE FUNCTION is_bulk_upload_shipment(shipment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shipments
        WHERE id = shipment_id AND bulk_upload_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.shipments IS 'Core shipments table - handles both residential (is_commercial=FALSE) and commercial (is_commercial=TRUE) shipments';
COMMENT ON COLUMN public.shipments.is_commercial IS 'Key field: FALSE = residential (current system), TRUE = commercial/B2B';
COMMENT ON COLUMN public.shipments.source IS 'How shipment was created: web_form, mobile_app, bulk_upload, api, auction_integration, natural_language';
COMMENT ON COLUMN public.shipments.high_value IS 'Flag for vehicles >$100k requiring special handling';
