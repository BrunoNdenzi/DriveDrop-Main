-- ====================================================================
-- Create Test Accounts (Bypass Email Verification)
-- ====================================================================
-- This script creates test accounts for Client, Driver, and Admin
-- with email verification already confirmed.
-- 
-- IMPORTANT: Run this in Supabase SQL Editor
-- ====================================================================

-- Test Account Credentials:
-- 
-- CLIENT:
--   Email: client@test.com
--   Password: Test123!
-- 
-- DRIVER:
--   Email: driver@test.com
--   Password: Test123!
-- 
-- ADMIN:
--   Email: admin@test.com
--   Password: Test123!
-- 
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. CLIENT ACCOUNT
-- ====================================================================

-- Insert into auth.users (bypass email verification)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  aud,
  role
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'client@test.com',
  crypt('Test123!', gen_salt('bf')), -- Password: Test123!
  NOW(), -- Email confirmed
  '{"provider":"email","providers":["email"],"role":"client"}',
  '{"first_name":"Test","last_name":"Client"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Create profile
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  is_verified,
  created_at,
  updated_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'client@test.com',
  'Test',
  'Client',
  '+1-555-0001',
  'client',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified;

-- Create notification preferences
INSERT INTO public.notification_preferences (
  user_id,
  push_notifications,
  email_notifications,
  sms_notifications,
  shipment_updates,
  driver_assigned,
  payment_updates,
  messages,
  delivery_completed,
  created_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- Create client settings
INSERT INTO public.client_settings (
  client_id,
  email_notifications,
  push_notifications,
  sms_notifications,
  marketing_emails,
  auto_quotes,
  preferred_communication,
  quote_notifications,
  shipment_updates,
  promotional_offers,
  created_at
)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  true,
  true,
  false,
  false,
  true,
  'email',
  true,
  true,
  false,
  NOW()
)
ON CONFLICT (client_id) DO NOTHING;

-- ====================================================================
-- 2. DRIVER ACCOUNT
-- ====================================================================

-- Insert into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  aud,
  role
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'driver@test.com',
  crypt('Test123!', gen_salt('bf')), -- Password: Test123!
  NOW(), -- Email confirmed
  '{"provider":"email","providers":["email"],"role":"driver"}',
  '{"first_name":"Test","last_name":"Driver"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Create profile
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  is_verified,
  rating,
  created_at,
  updated_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'driver@test.com',
  'Test',
  'Driver',
  '+1-555-0002',
  'driver',
  true,
  4.8,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  rating = EXCLUDED.rating;

-- Create notification preferences
INSERT INTO public.notification_preferences (
  user_id,
  push_notifications,
  email_notifications,
  sms_notifications,
  shipment_updates,
  driver_assigned,
  payment_updates,
  messages,
  delivery_completed,
  created_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- Create driver settings
INSERT INTO public.driver_settings (
  driver_id,
  available_for_jobs,
  notifications_enabled,
  preferred_radius,
  allow_location_tracking,
  preferred_job_types,
  created_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  true,
  true,
  50,
  true,
  ARRAY['standard', 'express'],
  NOW()
)
ON CONFLICT (driver_id) DO NOTHING;

-- Create driver vehicle
INSERT INTO public.driver_vehicles (
  driver_id,
  make,
  model,
  year,
  color,
  license_plate,
  vehicle_type,
  is_active,
  created_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'Ford',
  'F-350',
  2022,
  'White',
  'DRV-TEST',
  'standard',
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. ADMIN ACCOUNT
-- ====================================================================

-- Insert into auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  aud,
  role
)
VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@test.com',
  crypt('Test123!', gen_salt('bf')), -- Password: Test123!
  NOW(), -- Email confirmed
  '{"provider":"email","providers":["email"],"role":"admin"}',
  '{"first_name":"Test","last_name":"Admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Create profile
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  is_verified,
  created_at,
  updated_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  'admin@test.com',
  'Test',
  'Admin',
  '+1-555-0003',
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified;

-- Create notification preferences
INSERT INTO public.notification_preferences (
  user_id,
  push_notifications,
  email_notifications,
  sms_notifications,
  shipment_updates,
  driver_assigned,
  payment_updates,
  messages,
  delivery_completed,
  created_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================
-- Run these to verify accounts were created:

-- Check auth.users
SELECT 
  id,
  email,
  email_confirmed_at IS NOT NULL as email_verified,
  raw_app_meta_data->>'role' as role,
  created_at
FROM auth.users 
WHERE email IN ('client@test.com', 'driver@test.com', 'admin@test.com')
ORDER BY email;

-- Check profiles
SELECT 
  id,
  email,
  first_name,
  last_name,
  role,
  is_verified,
  created_at
FROM public.profiles 
WHERE email IN ('client@test.com', 'driver@test.com', 'admin@test.com')
ORDER BY email;

-- ====================================================================
-- CLEANUP (if needed)
-- ====================================================================
-- Uncomment and run this to delete test accounts:
/*
BEGIN;

DELETE FROM public.notification_preferences WHERE user_id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid
);

DELETE FROM public.client_settings WHERE client_id = '11111111-1111-1111-1111-111111111111'::uuid;
DELETE FROM public.driver_settings WHERE driver_id = '22222222-2222-2222-2222-222222222222'::uuid;
DELETE FROM public.driver_vehicles WHERE driver_id = '22222222-2222-2222-2222-222222222222'::uuid;

DELETE FROM public.profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid
);

DELETE FROM auth.users WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid
);

COMMIT;
*/
