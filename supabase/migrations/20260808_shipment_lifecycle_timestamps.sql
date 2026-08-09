-- V1 Fix: Add missing shipment lifecycle timestamp columns
-- Applies to: shipments table
-- Context: supabase.service.ts:337 and :339 write these columns when status transitions occur.
-- They were coded but never added to the database schema, causing a 500 on any status update.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
