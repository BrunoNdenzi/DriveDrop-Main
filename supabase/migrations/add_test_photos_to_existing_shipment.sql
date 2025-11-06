-- Add test photos to existing shipment for verification testing
-- Replace 'YOUR_SHIPMENT_ID' with an actual shipment ID from your database

UPDATE shipments 
SET client_vehicle_photos = '{
  "front": ["https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80"],
  "rear": ["https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80"],
  "left": ["https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80"],
  "right": ["https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80"],
  "interior": ["https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&q=80"],
  "damage": []
}'::jsonb
WHERE id = '06844a8a-9d6b-445b-be6a-4ff7332c3e52'; -- First driver_arrived shipment from your CSV

-- You can also update other shipments:
-- WHERE status = 'driver_arrived' OR status = 'pickup_verification_pending';
