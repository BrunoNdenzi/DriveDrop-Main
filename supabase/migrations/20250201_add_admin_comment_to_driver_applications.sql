-- Add admin_comment column to driver_applications table
-- This allows admins to add notes when approving or rejecting applications

ALTER TABLE driver_applications 
ADD COLUMN IF NOT EXISTS admin_comment TEXT;

COMMENT ON COLUMN driver_applications.admin_comment IS 'Admin notes or comments when approving/rejecting applications';
