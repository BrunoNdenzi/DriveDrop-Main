-- Create storage bucket for verification photos
-- This bucket will store pickup verification photos taken by drivers

-- Create the bucket (public access for viewing photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-photos', 'verification-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for verification-photos bucket

-- Policy: Drivers can upload photos
CREATE POLICY "Drivers can upload verification photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-photos'
  AND (auth.jwt() ->> 'role') = 'driver'
);

-- Policy: Drivers and clients can view photos
CREATE POLICY "Authenticated users can view verification photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-photos'
);

-- Policy: Admins can delete photos
CREATE POLICY "Admins can delete verification photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-photos'
  AND (auth.jwt() ->> 'role') = 'admin'
);

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads. verification-photos bucket stores driver pickup verification photos.';
