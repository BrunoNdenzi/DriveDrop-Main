-- Add updated_by field to shipments table
-- This field tracks who made the last update to the shipment

ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);

-- Update existing records to set updated_by to the driver_id for driver-updated records
-- or client_id for client-updated records (defaulting to client_id)
UPDATE public.shipments 
SET updated_by = COALESCE(driver_id, client_id) 
WHERE updated_by IS NULL;

-- Add a comment to document the field
COMMENT ON COLUMN public.shipments.updated_by IS 'User ID of the person who last updated this shipment';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_shipments_updated_by ON public.shipments(updated_by);
