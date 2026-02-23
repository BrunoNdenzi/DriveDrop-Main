-- ============================================================
-- DriveDrop: Create a Full Broker Account
-- ============================================================
-- This script creates a complete broker account with:
--   1. Auth user (in auth.users)
--   2. Profile record (in profiles)
--   3. Broker profile (in broker_profiles)
--   4. Notification preferences
--   5. User onboarding record
--
-- INSTRUCTIONS:
--   1. Replace all placeholder values marked with <<...>>
--   2. Run this in your Supabase SQL Editor
--   3. The broker can then sign in with the email/password you set
-- ============================================================

-- =============================================
-- CONFIGURATION - Update these values
-- =============================================
DO $$
DECLARE
  -- Auth / Profile Info
  v_email         TEXT := 'broker@test.com';      -- Broker's login email
  v_password      TEXT := 'Drivedrop@88';       -- Initial password (they can reset later)
  v_first_name    TEXT := 'Drivedrop';                     -- Broker's first name
  v_last_name     TEXT := 'Broker';                    -- Broker's last name
  v_phone         TEXT := '+1-555-123-4567';          -- Broker's phone number

  -- Company Info
  v_company_name  TEXT := 'SunBelt Transport Brokerage'; -- Company name
  v_dba_name      TEXT := NULL;                            -- DBA name (optional)
  v_company_email TEXT := 'operations@sunbelttransport.com'; -- Company email
  v_company_phone TEXT := '+1-555-987-6543';          -- Company phone
  v_dot_number    TEXT := '234567';                   -- DOT number
  v_mc_number     TEXT := 'MC-654321';                 -- MC number
  v_tax_id        TEXT := NULL;                            -- Tax ID / EIN (optional)
  v_broker_license TEXT := NULL;                           -- Broker license number (optional)

  -- Insurance
  v_insurance_provider TEXT := 'National Insurance Co';
  v_insurance_policy   TEXT := 'POL-2025-001234';
  v_insurance_amount   NUMERIC := 1000000.00;             -- Coverage amount
  v_insurance_expiry   DATE := '2026-12-31';              -- Insurance expiry date

  -- Bond
  v_bond_number    TEXT := 'BMC-75000';
  v_bond_amount    NUMERIC := 75000.00;

  -- Business Address
  v_business_address TEXT := '123 Broker Ave, Suite 200';
  v_business_city    TEXT := 'Charlotte';
  v_business_state   TEXT := 'NC';
  v_business_zip     TEXT := '28202';

  -- Business Details
  v_business_structure TEXT := 'llc';                      -- sole_proprietorship, llc, corporation, s_corp, partnership
  v_years_in_business  INTEGER := 5;
  v_website_url        TEXT := 'https://sunbelttransport.com';
  v_commission_rate    NUMERIC := 15.00;                   -- Default broker commission %

  -- Internal IDs (auto-generated)
  v_user_id       UUID;
  v_broker_id     UUID;

BEGIN
  -- =============================================
  -- STEP 1: Create auth.users record
  -- =============================================
  -- NOTE: In Supabase, you typically create users via the Auth API or Dashboard.
  -- This SQL approach works if you have direct DB access.
  -- If you're using Supabase hosted, use the Dashboard > Authentication > Add User instead,
  -- then skip to Step 2 and use the generated user ID.

  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'User with email % already exists (ID: %). Skipping auth.users insert.', v_email, v_user_id;
  ELSE
    -- Generate a new UUID for the user
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone,
      phone_change,
      phone_change_token,
      reauthentication_token,
      is_sso_user
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),  -- Pre-confirm the email
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
      ),
      jsonb_build_object(
        'first_name', v_first_name,
        'last_name', v_last_name,
        'role', 'broker'
      ),
      'authenticated',
      'authenticated',
      NOW(),
      NOW(),
      '',       -- confirmation_token
      '',       -- recovery_token
      '',       -- email_change (GoTrue expects '' not NULL)
      '',       -- email_change_token_new
      '',       -- email_change_token_current
      '',       -- phone
      '',       -- phone_change
      '',       -- phone_change_token
      '',       -- reauthentication_token
      FALSE     -- is_sso_user
    );

    -- Create identity record for email auth
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_email,
      'email',
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created auth user: % (ID: %)', v_email, v_user_id;
  END IF;

  -- =============================================
  -- STEP 2: Create profiles record
  -- =============================================
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
  ) VALUES (
    v_user_id,
    v_email,
    v_first_name,
    v_last_name,
    v_phone,
    'broker',
    TRUE,        -- Pre-verify the broker
    5.0,         -- Start with perfect rating
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'broker',
    is_verified = TRUE,
    updated_at = NOW();

  RAISE NOTICE 'Created/updated profile for user: %', v_user_id;

  -- =============================================
  -- STEP 3: Create broker_profiles record
  -- =============================================
  v_broker_id := gen_random_uuid();

  INSERT INTO public.broker_profiles (
    id,
    profile_id,
    company_name,
    dba_name,
    company_email,
    company_phone,
    dot_number,
    mc_number,
    tax_id,
    broker_license_number,
    insurance_provider,
    insurance_policy_number,
    insurance_amount,
    insurance_expiry_date,
    bond_number,
    bond_amount,
    verification_status,
    fmcsa_verified,
    dot_verified,
    insurance_verified,
    verified_at,
    business_structure,
    years_in_business,
    website_url,
    business_address,
    business_city,
    business_state,
    business_zip,
    business_country,
    default_commission_rate,
    platform_fee_rate,
    account_status,
    created_at,
    updated_at
  ) VALUES (
    v_broker_id,
    v_user_id,
    v_company_name,
    v_dba_name,
    v_company_email,
    v_company_phone,
    v_dot_number,
    v_mc_number,
    v_tax_id,
    v_broker_license,
    v_insurance_provider,
    v_insurance_policy,
    v_insurance_amount,
    v_insurance_expiry,
    v_bond_number,
    v_bond_amount,
    'verified',           -- Pre-verify the broker
    TRUE,                  -- FMCSA verified
    TRUE,                  -- DOT verified
    TRUE,                  -- Insurance verified
    NOW(),                 -- Verified timestamp
    v_business_structure,
    v_years_in_business,
    v_website_url,
    v_business_address,
    v_business_city,
    v_business_state,
    v_business_zip,
    'USA',
    v_commission_rate,
    10.00,                 -- Platform fee rate (default 10%)
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    verification_status = 'verified',
    account_status = 'active',
    updated_at = NOW();

  RAISE NOTICE 'Created broker profile: % (Broker ID: %)', v_company_name, v_broker_id;

  -- =============================================
  -- STEP 4: Create notification preferences
  -- =============================================
  INSERT INTO public.notification_preferences (
    user_id,
    push_notifications,
    email_notifications,
    sms_notifications,
    shipment_updates,
    driver_assigned,
    payment_updates,
    promotions,
    messages,
    delivery_completed
  ) VALUES (
    v_user_id,
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    TRUE
  )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Created notification preferences';

  -- =============================================
  -- STEP 5: Create user onboarding record
  -- =============================================
  INSERT INTO public.user_onboarding (
    user_id,
    broker_tour_completed,
    show_tours,
    checklist_progress
  ) VALUES (
    v_user_id,
    FALSE,
    TRUE,
    jsonb_build_object(
      'profile_completed', true,
      'documents_uploaded', false,
      'payment_method_added', false,
      'first_shipment_created', false,
      'first_shipment_tracked', false
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Created onboarding record';

  -- =============================================
  -- STEP 6: Fix NULL string columns in auth.users
  -- GoTrue expects empty strings, not NULL, for these columns.
  -- This also fixes any existing user that was created with NULLs.
  -- =============================================
  UPDATE auth.users SET
    email_change              = COALESCE(email_change, ''),
    email_change_token_new    = COALESCE(email_change_token_new, ''),
    email_change_token_current= COALESCE(email_change_token_current, ''),
    phone                     = COALESCE(phone, ''),
    phone_change              = COALESCE(phone_change, ''),
    phone_change_token        = COALESCE(phone_change_token, ''),
    reauthentication_token    = COALESCE(reauthentication_token, ''),
    confirmation_token        = COALESCE(confirmation_token, ''),
    recovery_token            = COALESCE(recovery_token, '')
  WHERE id = v_user_id;

  RAISE NOTICE 'Ensured all auth string columns are non-NULL for user %', v_user_id;

  -- =============================================
  -- SUMMARY
  -- =============================================
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  BROKER ACCOUNT CREATED SUCCESSFULLY';
  RAISE NOTICE '============================================';
  RAISE NOTICE '  User ID:      %', v_user_id;
  RAISE NOTICE '  Broker ID:    %', v_broker_id;
  RAISE NOTICE '  Email:        %', v_email;
  RAISE NOTICE '  Company:      %', v_company_name;
  RAISE NOTICE '  DOT:          %', v_dot_number;
  RAISE NOTICE '  MC:           %', v_mc_number;
  RAISE NOTICE '  Commission:   %% %', v_commission_rate;
  RAISE NOTICE '  Status:       Active & Verified';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'The broker can now sign in at your app with:';
  RAISE NOTICE '  Email: %', v_email;
  RAISE NOTICE '  Password: (the one you set above)';

END $$;
