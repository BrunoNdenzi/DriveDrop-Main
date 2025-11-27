-- ============================================================================
-- TEST BROKER ACCOUNT CREATION SCRIPT
-- ============================================================================
-- This script creates a complete test broker account with realistic data
-- for end-to-end testing of the broker integration system.
--
-- ⚠️  CRITICAL: YOU MUST CREATE THE AUTH USER FIRST! ⚠️
--
-- STEP 1: Create Auth User in Supabase Dashboard FIRST (Don't skip this!)
--    a) Go to: Supabase Dashboard > Authentication > Users
--    b) Click "Add User" button
--    c) Fill in:
--       - Email: broker.test@drivedrop.com
--       - Password: TestBroker123!
--       - ✅ CHECK "Auto Confirm User" (very important!)
--    d) Click "Create User"
--    e) COPY the User ID (UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
--
-- STEP 2: Update THIS file
--    a) Find ALL instances of '347c1cb8-23fe-4b77-b4a6-43870ac19435'
--    b) Replace with the User ID you copied in Step 1
--    c) Save this file
--
-- STEP 3: Run this script in Supabase SQL Editor
--
-- STEP 4: Login and test with: broker.test@drivedrop.com / TestBroker123!
--
-- ============================================================================

BEGIN;

-- Verify the auth user exists before proceeding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid
    ) THEN
        RAISE EXCEPTION '
╔════════════════════════════════════════════════════════════════════════╗
║  ⚠️  AUTH USER NOT FOUND!                                              ║
║                                                                        ║
║  The user ID ''347c1cb8-23fe-4b77-b4a6-43870ac19435'' does not exist    ║
║  in auth.users table.                                                  ║
║                                                                        ║
║  📋 REQUIRED STEPS:                                                    ║
║                                                                        ║
║  1. Go to Supabase Dashboard > Authentication > Users                 ║
║  2. Click "Add User"                                                  ║
║  3. Email: broker.test@drivedrop.com                                  ║
║  4. Password: TestBroker123!                                          ║
║  5. ✅ Check "Auto Confirm User"                                      ║
║  6. Copy the generated User ID                                        ║
║  7. Replace ALL ''347c1cb8-23fe-4b77-b4a6-43870ac19435'' in this      ║
║     script with your actual User ID                                   ║
║  8. Run this script again                                             ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
';
    END IF;
END $$;

-- ============================================================================
-- 1. CREATE TEST BROKER PROFILE
-- ============================================================================

-- IMPORTANT: Replace '347c1cb8-23fe-4b77-b4a6-43870ac19435' with the actual auth.users.id
-- from the Supabase Auth Dashboard after creating the user there first!

-- Create the profile entry (this must match an existing auth.users.id)
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  created_at,
  updated_at
) VALUES (
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid, -- REPLACE THIS with actual auth user ID!
  'broker.test@drivedrop.com',
  'John',
  'Smith',
  '+1-555-0123',
  'broker',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  id = EXCLUDED.id,
  role = 'broker',
  first_name = 'John',
  last_name = 'Smith',
  phone = '+1-555-0123',
  updated_at = NOW();

-- Create the broker profile
INSERT INTO broker_profiles (
  profile_id,
  company_name,
  company_email,
  company_phone,
  dot_number,
  mc_number,
  tax_id,
  business_structure,
  default_commission_rate,
  platform_fee_rate,
  verification_status,
  verified_at,
  business_address,
  business_city,
  business_state,
  business_zip,
  business_country,
  total_shipments_completed,
  total_revenue_generated,
  active_carriers,
  average_rating,
  on_time_delivery_rate,
  created_at,
  updated_at
) VALUES (
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid, -- REPLACE THIS with actual auth user ID!
  'TestBroker Logistics LLC',
  'broker.test@drivedrop.com',
  '+1-555-0123',
  '1234567',
  '654321',
  '12-3456789',
  'llc',
  25.00,
  10.00,
  'verified', -- Set to verified for testing
  NOW(),
  '123 Logistics Ave, Suite 100',
  'Chicago',
  'IL',
  '60601',
  'USA',
  0, -- Will increment with test shipments
  0.00, -- Will increment with test payments
  0, -- Will increment with test carriers
  0.00,
  0.00,
  NOW(),
  NOW()
) ON CONFLICT (profile_id) DO UPDATE SET
  verification_status = 'verified',
  verified_at = NOW(),
  updated_at = NOW();

-- ============================================================================
-- 2. CREATE TEST DRIVER ACCOUNTS (Carriers)
-- ============================================================================
-- Note: Drivers are referenced from existing profiles in the database.
-- The broker-carrier relationships below will use any existing driver profiles.
-- If you need specific test drivers, create them in Supabase Auth Dashboard first,
-- then they will automatically get profiles through your signup triggers.

-- For this test, we'll create broker-carrier relationships with any existing drivers
-- or you can manually create driver auth users if needed.

-- ============================================================================
-- 3. CREATE BROKER-CARRIER RELATIONSHIPS
-- ============================================================================
-- Note: This section will create relationships with any existing driver profiles.
-- If no drivers exist yet, these INSERTs will be skipped.
-- You can add drivers later through the broker dashboard.

-- Try to create relationships with first 3 drivers (if they exist)
DO $$
DECLARE
  v_broker_id UUID;
  v_driver_ids UUID[];
BEGIN
  -- Get broker ID
  SELECT id INTO v_broker_id 
  FROM broker_profiles 
  WHERE profile_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid;
  
  -- Get up to 3 existing driver IDs
  SELECT ARRAY_AGG(id) INTO v_driver_ids
  FROM (SELECT id FROM profiles WHERE role = 'driver' LIMIT 3) AS drivers;
  
  -- Only create relationships if we have drivers
  IF v_driver_ids IS NOT NULL AND array_length(v_driver_ids, 1) >= 1 THEN
    INSERT INTO broker_carriers (
      broker_id, carrier_id, invited_by, relationship_status,
      commission_rate, payment_terms, notes,
      total_shipments_completed, total_revenue_generated,
      average_rating, on_time_delivery_rate,
      created_at, updated_at
    ) VALUES (
      v_broker_id, v_driver_ids[1], 'broker', 'active',
      25.00, 'Net 7 days', 'Test carrier relationship 1',
      0, 0.00, 0.00, 0.00, NOW(), NOW()
    ) ON CONFLICT (broker_id, carrier_id) DO UPDATE SET
      relationship_status = 'active', updated_at = NOW();
  END IF;
  
  IF v_driver_ids IS NOT NULL AND array_length(v_driver_ids, 1) >= 2 THEN
    INSERT INTO broker_carriers (
      broker_id, carrier_id, invited_by, relationship_status,
      commission_rate, payment_terms, notes,
      total_shipments_completed, total_revenue_generated,
      average_rating, on_time_delivery_rate,
      created_at, updated_at
    ) VALUES (
      v_broker_id, v_driver_ids[2], 'broker', 'pending',
      23.00, 'Net 14 days', 'Pending invitation',
      0, 0.00, 0.00, 0.00, NOW(), NOW()
    ) ON CONFLICT (broker_id, carrier_id) DO UPDATE SET
      relationship_status = 'pending', updated_at = NOW();
  END IF;
  
  IF v_driver_ids IS NOT NULL AND array_length(v_driver_ids, 1) >= 3 THEN
    INSERT INTO broker_carriers (
      broker_id, carrier_id, invited_by, relationship_status,
      commission_rate, payment_terms, notes,
      total_shipments_completed, total_revenue_generated,
      average_rating, on_time_delivery_rate,
      created_at, updated_at
    ) VALUES (
      v_broker_id, v_driver_ids[3], 'broker', 'active',
      26.00, 'Upon delivery', 'Specialized in long-haul routes',
      0, 0.00, 0.00, 0.00, NOW(), NOW()
    ) ON CONFLICT (broker_id, carrier_id) DO UPDATE SET
      relationship_status = 'active', updated_at = NOW();
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE SAMPLE LOAD BOARD ENTRIES
-- ============================================================================
-- Note: load_board table references shipments, so we need to create shipments first

-- Sample Shipment 1: Chicago to New York
INSERT INTO shipments (
  id,
  client_id,
  status,
  title,
  description,
  pickup_address,
  pickup_city,
  pickup_state,
  pickup_zip,
  delivery_address,
  delivery_city,
  delivery_state,
  delivery_zip,
  vehicle_type,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  distance,
  estimated_price,
  pickup_date,
  delivery_date,
  payment_status,
  is_broker_shipment,
  broker_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid, -- Broker posting as client
  'pending',
  'Toyota Camry 2023 - Chicago to New York',
  'Sedan transport, must be delivered to front desk',
  '123 W Madison St, Chicago, IL 60602',
  'Chicago',
  'IL',
  '60602',
  '350 5th Ave, New York, NY 10118',
  'New York',
  'NY',
  '10118',
  'sedan',
  'Toyota',
  'Camry',
  2023,
  790.5,
  650.00,
  NOW() + INTERVAL '2 days',
  NOW() + INTERVAL '4 days',
  'pending',
  TRUE,
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Add to load board
INSERT INTO load_board (
  shipment_id,
  posted_by,
  visibility,
  load_status,
  suggested_carrier_payout,
  max_broker_commission,
  bidding_enabled,
  expires_at,
  created_at,
  updated_at
)
SELECT 
  s.id,
  s.client_id,
  'public',
  'available',
  650.00,
  162.50,
  TRUE,
  NOW() + INTERVAL '7 days',
  NOW(),
  NOW()
FROM shipments s
WHERE s.title = 'Toyota Camry 2023 - Chicago to New York'
  AND s.broker_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid
ON CONFLICT (shipment_id) DO NOTHING;

-- Sample Shipment 2: Los Angeles to San Francisco
INSERT INTO shipments (
  id,
  client_id,
  status,
  title,
  description,
  pickup_address,
  pickup_city,
  pickup_state,
  pickup_zip,
  delivery_address,
  delivery_city,
  delivery_state,
  delivery_zip,
  vehicle_type,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  distance,
  estimated_price,
  pickup_date,
  delivery_date,
  payment_status,
  is_broker_shipment,
  broker_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid,
  'pending',
  'Honda CR-V 2022 - LA to SF',
  'SUV with roof rack equipment',
  '1000 W Sunset Blvd, Los Angeles, CA 90012',
  'Los Angeles',
  'CA',
  '90012',
  '1 Market St, San Francisco, CA 94105',
  'San Francisco',
  'CA',
  '94105',
  'suv',
  'Honda',
  'CR-V',
  2022,
  382.8,
  420.00,
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '2 days',
  'pending',
  TRUE,
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Add to load board
INSERT INTO load_board (
  shipment_id,
  posted_by,
  visibility,
  load_status,
  suggested_carrier_payout,
  max_broker_commission,
  bidding_enabled,
  expires_at,
  created_at,
  updated_at
)
SELECT 
  s.id,
  s.client_id,
  'public',
  'available',
  420.00,
  105.00,
  TRUE,
  NOW() + INTERVAL '5 days',
  NOW(),
  NOW()
FROM shipments s
WHERE s.title = 'Honda CR-V 2022 - LA to SF'
  AND s.broker_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid
ON CONFLICT (shipment_id) DO NOTHING;

-- Sample Shipment 3: Miami to Orlando
INSERT INTO shipments (
  id,
  client_id,
  status,
  title,
  description,
  pickup_address,
  pickup_city,
  pickup_state,
  pickup_zip,
  delivery_address,
  delivery_city,
  delivery_state,
  delivery_zip,
  vehicle_type,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  distance,
  estimated_price,
  pickup_date,
  delivery_date,
  payment_status,
  is_broker_shipment,
  broker_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid,
  'pending',
  'Ford F-150 2021 - Miami to Orlando',
  'Pickup window: 8AM - 12PM',
  '100 Biscayne Blvd, Miami, FL 33132',
  'Miami',
  'FL',
  '33132',
  '400 W Church St, Orlando, FL 32801',
  'Orlando',
  'FL',
  '32801',
  'truck',
  'Ford',
  'F-150',
  2021,
  234.2,
  350.00,
  NOW() + INTERVAL '3 days',
  NOW() + INTERVAL '4 days',
  'pending',
  TRUE,
  '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Add to load board
INSERT INTO load_board (
  shipment_id,
  posted_by,
  visibility,
  load_status,
  suggested_carrier_payout,
  max_broker_commission,
  bidding_enabled,
  expires_at,
  created_at,
  updated_at
)
SELECT 
  s.id,
  s.client_id,
  'public',
  'available',
  350.00,
  87.50,
  TRUE,
  NOW() + INTERVAL '6 days',
  NOW(),
  NOW()
FROM shipments s
WHERE s.title = 'Ford F-150 2021 - Miami to Orlando'
  AND s.broker_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid
ON CONFLICT (shipment_id) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check broker profile
SELECT 
  p.email,
  p.first_name || ' ' || p.last_name AS full_name,
  p.role,
  bp.company_name,
  bp.verification_status,
  bp.total_shipments_completed,
  bp.active_carriers
FROM profiles p
JOIN broker_profiles bp ON p.id = bp.profile_id
WHERE p.email = 'broker.test@drivedrop.com';

-- Check carrier relationships
SELECT 
  p.email AS carrier_email,
  p.first_name || ' ' || p.last_name AS carrier_name,
  bc.relationship_status,
  bc.commission_rate,
  bc.payment_terms
FROM broker_carriers bc
JOIN broker_profiles bp ON bc.broker_id = bp.id
JOIN profiles p ON bc.carrier_id = p.id
WHERE bp.profile_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid;

-- Check load board entries
SELECT 
  lb.id,
  s.pickup_city || ', ' || s.pickup_state AS origin,
  s.delivery_city || ', ' || s.delivery_state AS destination,
  s.vehicle_type,
  s.vehicle_year || ' ' || s.vehicle_make || ' ' || s.vehicle_model AS vehicle,
  s.distance,
  lb.suggested_carrier_payout,
  lb.load_status,
  s.pickup_date
FROM load_board lb
JOIN shipments s ON lb.shipment_id = s.id
WHERE s.broker_id = '347c1cb8-23fe-4b77-b4a6-43870ac19435'::uuid;

-- ============================================================================
-- MANUAL STEPS FOR SETUP
-- ============================================================================
--
-- STEP 1: Create Auth User in Supabase Dashboard FIRST
--    - Go to Authentication > Users in Supabase Dashboard
--    - Click "Add User"
--    - Email: broker.test@drivedrop.com
--    - Password: TestBroker123!
--    - Auto Confirm User: YES (important - check this box!)
--    - Click "Create User"
--    - COPY the User ID that appears (it's a UUID like: a1b2c3d4-e5f6-...)
--
-- STEP 2: Update this SQL script
--    - Open this file in a text editor
--    - Find and replace ALL instances of '347c1cb8-23fe-4b77-b4a6-43870ac19435' 
--      with the actual User ID you copied from Step 1
--    - Save the file
--
-- STEP 3: Run this script in Supabase SQL Editor
--    - Open SQL Editor in Supabase Dashboard
--    - Copy and paste the updated script
--    - Click "Run" to execute
--
-- STEP 4: Login and Test
--    - Go to your app's login page
--    - Select "Broker" tab
--    - Login with: broker.test@drivedrop.com / TestBroker123!
--    - Verify:
--      ✓ Dashboard loads with correct data
--      ✓ Load board shows 3 sample shipments
--      ✓ Carrier network shows 3 drivers (2 active, 1 pending)
--      ✓ Can filter loads and search carriers
--
-- STEP 5: Optional - Add more test data
--    - Create additional loads via the dashboard
--    - Invite more carriers
--    - Place bids on loads
--    - Complete shipments and track payouts
--
-- ============================================================================

