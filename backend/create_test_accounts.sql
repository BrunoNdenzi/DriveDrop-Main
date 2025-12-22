-- Create test accounts with verified emails
-- Run this in Supabase SQL Editor

-- Delete existing accounts if they exist (with cascading deletes)
DO $$
BEGIN
  -- Delete client if exists
  DELETE FROM auth.users WHERE email = 'benssonse@gmail.com';
  DELETE FROM public.profiles WHERE email = 'benssonse@gmail.com';
  RAISE NOTICE 'Deleted existing client account: benssonse@gmail.com';
  
  -- Delete admin if exists
  DELETE FROM auth.users WHERE email = 'infos@calkons.com';
  DELETE FROM public.profiles WHERE email = 'infos@calkons.com';
  RAISE NOTICE 'Deleted existing admin account: infos@calkons.com';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during deletion (might not exist): %', SQLERRM;
END $$;

-- 1. Create CLIENT account: benssonse@gmail.com
DO $$
DECLARE
  client_user_id uuid;
BEGIN
  -- Create auth user for client
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
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
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'benssonse@gmail.com',
    crypt('Drivedrop@88', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"client"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO client_user_id;

  -- Create profile for client
  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    created_at,
    updated_at
  ) VALUES (
    client_user_id,
    'benssonse@gmail.com',
    'client',
    'Bensson',
    'Client',
    '+15042662317',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  RAISE NOTICE 'Client account created: benssonse@gmail.com';
END $$;

-- 2. Create ADMIN account: infos@calkons.com
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Create auth user for admin
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
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
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'infos@calkons.com',
    crypt('Drivedrop@88', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO admin_user_id;

  -- Create profile for admin
  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    phone,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    'infos@calkons.com',
    'admin',
    'Admin',
    'User',
    '+15042662317',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  RAISE NOTICE 'Admin account created: infos@calkons.com';
END $$;

-- Verify accounts created
SELECT 
  email, 
  role,
  email_confirmed_at IS NOT NULL as verified
FROM auth.users 
WHERE email IN ('benssonse@gmail.com', 'infos@calkons.com');

SELECT 
  email,
  role,
  first_name,
  last_name
FROM public.profiles
WHERE email IN ('benssonse@gmail.com', 'infos@calkons.com');
