-- ============================================================
-- Add missing rejection_reason column to driver_documents
-- The table already exists; this adds the missing column.
-- Run this in your Supabase SQL editor.
-- ============================================================

ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

