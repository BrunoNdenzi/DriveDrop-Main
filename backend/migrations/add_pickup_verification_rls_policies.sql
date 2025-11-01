-- Enable RLS on pickup_verifications table
ALTER TABLE pickup_verifications ENABLE ROW LEVEL SECURITY;

-- Allow drivers to insert their own verification records
CREATE POLICY "Drivers can create verification records"
ON pickup_verifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = driver_id
);

-- Allow drivers to view their own verification records
CREATE POLICY "Drivers can view their own verification records"
ON pickup_verifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = driver_id
);

-- Allow drivers to update their own verification records
CREATE POLICY "Drivers can update their own verification records"
ON pickup_verifications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
)
WITH CHECK (
  auth.uid() = driver_id
);

-- Allow clients to view verification records for their shipments
CREATE POLICY "Clients can view verification for their shipments"
ON pickup_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = pickup_verifications.shipment_id
    AND shipments.client_id = auth.uid()
  )
);

-- Allow admins to view all verification records
CREATE POLICY "Admins can view all verification records"
ON pickup_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
