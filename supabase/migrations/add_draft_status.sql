-- Add draft status to shipment_status enum
-- This migration adds support for draft shipments
-- Split into steps to handle PostgreSQL enum limitations

-- STEP 1: Add 'draft' to the shipment_status enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'draft' value already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'draft' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'shipment_status'
        )
    ) THEN
        -- Add the new enum value
        ALTER TYPE shipment_status ADD VALUE 'draft' BEFORE 'pending';
        
        -- Log that we added the enum value
        RAISE NOTICE 'Added draft status to shipment_status enum';
    ELSE
        RAISE NOTICE 'Draft status already exists in shipment_status enum';
    END IF;
END $$;