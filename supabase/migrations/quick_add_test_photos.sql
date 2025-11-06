-- Quick fix: Add test photos to the shipment you're currently testing
-- Run this in Supabase SQL Editor

UPDATE shipments 
SET client_vehicle_photos = '{
  "front": ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80"],
  "rear": ["https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80"],
  "left": ["https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80"],
  "right": ["https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80"],
  "interior": ["https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&q=80"],
  "damage": []
}'::jsonb
WHERE status IN ('driver_arrived', 'pickup_verification_pending')
RETURNING id, title, status, 
  jsonb_array_length(client_vehicle_photos->'front') as front_count,
  jsonb_array_length(client_vehicle_photos->'rear') as rear_count;
