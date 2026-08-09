-- Fix: Prevent duplicate initial payment records for the same shipment
-- A shipment may have at most one active (non-failed/refunded) initial payment record.
-- This partial unique index enforces idempotency at the DB level for concurrent requests.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_shipment_initial_active
  ON payments (shipment_id, client_id)
  WHERE initial_amount > 0
    AND status NOT IN ('failed', 'refunded');
