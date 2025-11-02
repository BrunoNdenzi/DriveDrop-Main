-- Fix race condition in parallel photo uploads
-- Create atomic function to append photos to driver_photos array

CREATE OR REPLACE FUNCTION append_verification_photo(
  verification_id UUID,
  photo_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use array append operator which is atomic
  -- This prevents race conditions when multiple photos are uploaded in parallel
  UPDATE pickup_verifications
  SET driver_photos = COALESCE(driver_photos, '[]'::jsonb) || photo_data::jsonb
  WHERE id = verification_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification not found: %', verification_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION append_verification_photo IS 'Atomically append a photo to verification driver_photos array. Prevents race conditions during parallel uploads.';
