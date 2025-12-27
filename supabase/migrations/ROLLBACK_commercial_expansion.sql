-- ============================================================================
-- ROLLBACK SCRIPT FOR COMMERCIAL EXPANSION
-- Use this to safely undo all commercial feature migrations
-- ============================================================================
-- WARNING: This will DROP all commercial tables and data!
-- Only use if you need to completely roll back the commercial features.
-- ============================================================================

-- Step 1: Drop triggers first
DROP TRIGGER IF EXISTS update_commercial_accounts_updated_at ON public.commercial_accounts;
DROP TRIGGER IF EXISTS update_bills_of_lading_updated_at ON public.bills_of_lading;
DROP TRIGGER IF EXISTS update_shipment_documents_updated_at ON public.shipment_documents;
DROP TRIGGER IF EXISTS update_gate_passes_updated_at ON public.gate_passes;
DROP TRIGGER IF EXISTS update_auction_integrations_updated_at ON public.auction_integrations;
DROP TRIGGER IF EXISTS trigger_check_high_value_insurance ON public.shipments;

-- Step 2: Drop helper functions
DROP FUNCTION IF EXISTS get_shipment_batch(UUID);
DROP FUNCTION IF EXISTS is_bulk_upload_shipment(UUID);
DROP FUNCTION IF EXISTS check_high_value_insurance();

-- Step 3: Drop columns from existing tables (shipments)
ALTER TABLE public.shipments
    DROP COLUMN IF EXISTS is_commercial,
    DROP COLUMN IF EXISTS commercial_account_id,
    DROP COLUMN IF EXISTS bulk_upload_id,
    DROP COLUMN IF EXISTS bol_id,
    DROP COLUMN IF EXISTS parent_shipment_id,
    DROP COLUMN IF EXISTS sequence_number,
    DROP COLUMN IF EXISTS is_batch_parent,
    DROP COLUMN IF EXISTS vehicle_color,
    DROP COLUMN IF EXISTS vehicle_mileage,
    DROP COLUMN IF EXISTS vehicle_license_plate,
    DROP COLUMN IF EXISTS vehicle_title_status,
    DROP COLUMN IF EXISTS vehicle_keys_location,
    DROP COLUMN IF EXISTS lot_number,
    DROP COLUMN IF EXISTS auction_house,
    DROP COLUMN IF EXISTS sale_date,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS source_reference,
    DROP COLUMN IF EXISTS payment_terms,
    DROP COLUMN IF EXISTS invoice_number,
    DROP COLUMN IF EXISTS po_number,
    DROP COLUMN IF EXISTS integration_id,
    DROP COLUMN IF EXISTS ai_created,
    DROP COLUMN IF EXISTS ai_prompt_id,
    DROP COLUMN IF EXISTS ai_confidence,
    DROP COLUMN IF EXISTS special_handling_requirements,
    DROP COLUMN IF EXISTS insurance_required,
    DROP COLUMN IF EXISTS insurance_amount,
    DROP COLUMN IF EXISTS high_value;

-- Step 4: Drop columns from profiles
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS user_type;

-- Step 5: Drop columns from broker_shipments
ALTER TABLE public.broker_shipments
    DROP COLUMN IF EXISTS bulk_upload_id,
    DROP COLUMN IF EXISTS bol_id;

-- Step 6: Drop new tables (CASCADE removes foreign key dependencies)
DROP TABLE IF EXISTS public.ai_shipment_prompts CASCADE;
DROP TABLE IF EXISTS public.ai_dispatch_optimizations CASCADE;
DROP TABLE IF EXISTS public.document_extraction_queue CASCADE;
DROP TABLE IF EXISTS public.integration_logs CASCADE;
DROP TABLE IF EXISTS public.auction_integrations CASCADE;
DROP TABLE IF EXISTS public.bulk_uploads CASCADE;
DROP TABLE IF EXISTS public.gate_passes CASCADE;
DROP TABLE IF EXISTS public.shipment_documents CASCADE;
DROP TABLE IF EXISTS public.bills_of_lading CASCADE;
DROP TABLE IF EXISTS public.commercial_accounts CASCADE;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify rollback worked)
-- ============================================================================

-- Should return FALSE if tables were dropped successfully
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'commercial_accounts',
        'bills_of_lading',
        'shipment_documents',
        'gate_passes',
        'bulk_uploads',
        'auction_integrations',
        'integration_logs',
        'document_extraction_queue',
        'ai_dispatch_optimizations',
        'ai_shipment_prompts'
    )
) AS commercial_tables_exist;

-- Should return FALSE if columns were dropped successfully
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name IN ('is_commercial', 'commercial_account_id', 'bulk_upload_id')
) AS commercial_columns_exist;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Commercial expansion rollback completed successfully!';
    RAISE NOTICE 'All commercial tables and columns have been removed.';
    RAISE NOTICE 'Your database is back to the pre-commercial state.';
END $$;
