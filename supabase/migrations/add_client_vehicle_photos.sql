-- Add client vehicle photos to shipments table
-- These photos are taken by client during booking for verification purposes

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS client_vehicle_photos JSONB DEFAULT '{
  "front": [],
  "rear": [],
  "left": [],
  "right": [],
  "interior": [],
  "damage": []
}'::jsonb;

COMMENT ON COLUMN shipments.client_vehicle_photos IS 'Client vehicle photos uploaded during booking. Structure: {front: [url], rear: [url], left: [url], right: [url], interior: [url], damage: [url]}';
