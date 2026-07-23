-- Create shipment-photos storage bucket for vehicle photos, documents, and BOLs
-- Run this migration to set up shipment document storage

-- Create shipment-photos bucket (public for easy access to photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shipment-photos',
  'shipment-photos',
  true,  -- Public bucket for vehicle photos and documents
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- RLS Policies for shipment-photos bucket

-- Policy 1: Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shipment-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'shipment-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'shipment-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow public read access (since bucket is public)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shipment-photos');

-- Success! shipment-photos bucket created with RLS policies.
