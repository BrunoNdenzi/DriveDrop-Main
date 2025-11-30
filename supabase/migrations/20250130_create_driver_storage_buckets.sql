-- Create storage buckets for driver applications
-- Run this migration to set up document storage
-- Note: RLS policies are managed by Supabase Storage automatically

-- Create driver-licenses bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-licenses',
  'driver-licenses',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create proof-of-address bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proof-of-address',
  'proof-of-address',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create insurance-documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-documents',
  'insurance-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Success! Buckets created.
-- To add custom RLS policies:
-- 1. Go to Supabase Dashboard > Storage > Your Bucket
-- 2. Click "Policies" tab
-- 3. Add policies through the UI for more control

