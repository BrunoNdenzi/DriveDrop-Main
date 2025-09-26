-- Add indexes and comments for draft status
-- This migration adds indexes and documentation for the draft status
-- Must be run AFTER add_draft_status.sql

-- Add comment to document the new status
COMMENT ON TYPE shipment_status IS 'Shipment status: draft (incomplete), pending (awaiting driver), accepted (driver assigned), in_transit (in progress), delivered (completed), cancelled (terminated)';

-- Add index for better performance when querying drafts by client
CREATE INDEX IF NOT EXISTS idx_shipments_status_client_draft 
ON shipments(status, client_id) 
WHERE status = 'draft';

-- Add index for updated_at on drafts for efficient sorting
CREATE INDEX IF NOT EXISTS idx_shipments_draft_updated_at 
ON shipments(updated_at) 
WHERE status = 'draft';

-- Add general index for status filtering (useful for all statuses)
CREATE INDEX IF NOT EXISTS idx_shipments_status 
ON shipments(status);

-- Add composite index for client drafts ordered by update time
CREATE INDEX IF NOT EXISTS idx_shipments_client_draft_updated 
ON shipments(client_id, updated_at DESC) 
WHERE status = 'draft';