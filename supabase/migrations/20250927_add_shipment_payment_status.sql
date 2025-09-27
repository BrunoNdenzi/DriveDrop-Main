-- Migration: add payment_status column to shipments for payment tracking
-- Description: ensure shipments table reflects payment lifecycle with enum type

ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.shipments.payment_status IS 'Tracks payment lifecycle for the shipment (pending, processing, completed, failed, refunded).';
