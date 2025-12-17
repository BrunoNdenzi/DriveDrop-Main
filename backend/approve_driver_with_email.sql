-- ========================================
-- Approve Driver Application with Email Notification
-- ========================================
-- This script approves a driver application and sends credentials
-- Run this instead of manual UPDATE statements

-- Step 1: Find the driver application by email
-- Replace 'driver@test.drivedrop.com' with actual email
DO $$
DECLARE
  v_driver_id UUID;
  v_email TEXT := 'driver@test.drivedrop.com'; -- CHANGE THIS
  v_temp_password TEXT := 'TempPass123!'; -- CHANGE THIS
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Get driver ID from auth.users
  SELECT id INTO v_driver_id 
  FROM auth.users 
  WHERE email = v_email;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver with email % not found', v_email;
  END IF;

  -- Get driver name
  SELECT first_name, last_name 
  INTO v_first_name, v_last_name
  FROM profiles 
  WHERE id = v_driver_id;

  -- Update profile role to driver
  UPDATE profiles 
  SET role = 'driver',
      updated_at = NOW()
  WHERE id = v_driver_id;

  -- Approve driver application (if exists)
  UPDATE job_applications 
  SET status = 'approved',
      updated_at = NOW()
  WHERE driver_id = v_driver_id 
    OR email = v_email;

  -- Force password change on first login
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{force_password_change}',
        'true'::jsonb
      ),
      updated_at = NOW()
  WHERE id = v_driver_id;

  RAISE NOTICE '✅ Driver approved: % % (ID: %)', v_first_name, v_last_name, v_driver_id;
  RAISE NOTICE '📧 Send email to % with temporary password: %', v_email, v_temp_password;
  RAISE NOTICE '🔒 Password change will be forced on first login';
  
END $$;

-- ========================================
-- MANUAL EMAIL TEMPLATE
-- ========================================
-- Since we can't trigger backend emails from SQL,
-- copy and send this email manually to the driver:
--
-- Subject: 🎉 Your DriveDrop Driver Application is Approved!
--
-- Dear [First Name],
--
-- Congratulations! Your application to become a DriveDrop driver has been approved.
--
-- You can now log in to your account and start accepting shipment requests:
-- 
-- Login URL: https://drivedrop.us.com/login
-- Email: [driver@test.drivedrop.com]
-- Temporary Password: TempPass123!
--
-- ⚠️ IMPORTANT: You will be required to change your password upon first login.
--
-- Next Steps:
-- 1. Log in with your temporary password
-- 2. Create a new secure password
-- 3. Complete your driver profile
-- 4. Start browsing available shipments
--
-- Welcome to the DriveDrop family! 🚚
--
-- Best regards,
-- DriveDrop Team
-- ========================================
