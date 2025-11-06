-- Add delivery confirmation photos system
-- This allows drivers to take proof of delivery photos

-- 1. Create storage bucket for delivery confirmation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-confirmation-photos', 'delivery-confirmation-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Add column to shipments table for delivery confirmation photos
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS delivery_confirmation_photos JSONB DEFAULT '[]'::jsonb;

-- 3. Add comment explaining the structure
COMMENT ON COLUMN shipments.delivery_confirmation_photos IS 
'Array of delivery confirmation photo URLs taken by driver at delivery. Format: ["url1", "url2", ...]';

-- 4. Storage RLS Policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can upload delivery confirmation photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view delivery confirmation photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can delete their delivery photos" ON storage.objects;

-- Allow authenticated drivers to upload delivery confirmation photos
CREATE POLICY "Drivers can upload delivery confirmation photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-confirmation-photos' AND
  (storage.foldername(name))[1] = 'delivery-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'driver'
  )
);

-- Allow public read access (for clients and admins to view)
CREATE POLICY "Anyone can view delivery confirmation photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'delivery-confirmation-photos');

-- Allow drivers to delete their own delivery photos (in case of mistake)
CREATE POLICY "Drivers can delete their delivery photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-confirmation-photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'driver'
  )
);

-- 5. Add index for faster queries on delivery photos
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_confirmation_photos 
ON shipments USING gin (delivery_confirmation_photos);
