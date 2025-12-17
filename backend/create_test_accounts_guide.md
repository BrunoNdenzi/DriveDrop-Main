# 🧪 Create Test Accounts for Each Role

After running the cleanup script, create fresh test accounts for testing the onboarding system.

---

## 📋 Test Account Creation Steps

### 1️⃣ **Client Account**

**Email:** `client@test.drivedrop.com`  
**Password:** `Test123!@#`

**Steps:**
1. Go to: `https://drivedrop.us.com/signup`
2. Fill in:
   - First Name: `Test`
   - Last Name: `Client`
   - Email: `client@test.drivedrop.com`
   - Phone: `+1 (555) 100-0001`
   - Password: `Test123!@#`
3. Click "Sign Up"
4. Check email for verification link (or verify in Supabase)
5. Log in → Should see **Client Dashboard**
6. **Onboarding tour should auto-start!** ✨

**What to Test:**
- ✅ Dashboard tour (6 steps)
- ✅ Onboarding checklist (4 items)
- ✅ Help button (bottom-right)
- ✅ Restart tour
- ✅ Create shipment tour (when clicking "Create Shipment")

---

### 2️⃣ **Driver Account**

**Email:** `driver@test.drivedrop.com`  
**Password:** `Test123!@#`

**Steps:**
1. Go to: `https://drivedrop.us.com/drivers/register`
2. Fill in driver application:
   - First Name: `Test`
   - Last Name: `Driver`
   - Email: `driver@test.drivedrop.com`
   - Phone: `+1 (555) 200-0002`
   - Password: `Test123!@#`
   - License Number: `DL12345678`
   - License State: `NC`
   - Vehicle Info: (fill with test data)
3. Submit application
4. **Manually approve in database:**
   ```sql
   -- In Supabase SQL Editor
   
   -- 1. Get the user ID
   SELECT id, email FROM auth.users WHERE email = 'driver@test.drivedrop.com';
   
   -- 2. Update profile role to driver
   UPDATE profiles 
   SET role = 'driver' 
   WHERE id = 'USER_ID_FROM_STEP_1';
   
   -- 3. Approve driver application
   UPDATE job_applications 
   SET status = 'approved' 
   WHERE driver_id = 'USER_ID_FROM_STEP_1';
   
   -- Or create driver verification record
   INSERT INTO driver_verifications (driver_id, status, verified_at)
   VALUES ('USER_ID_FROM_STEP_1', 'approved', NOW());
   ```
5. Log out and log back in
6. Should redirect to **Driver Dashboard**
7. **Driver tour should auto-start!** 🚚

**What to Test:**
- ✅ Driver dashboard tour (6 steps)
- ✅ Available jobs section
- ✅ Active deliveries section
- ✅ Earnings overview
- ✅ Help button
- ✅ Restart tour

---

### 3️⃣ **Admin Account**

**Email:** `admin@test.drivedrop.com`  
**Password:** `Test123!@#`

**Steps:**
1. **Create via SQL (Direct database insert):**
   ```sql
   -- In Supabase SQL Editor
   
   -- 1. Create auth user
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
     'admin@test.drivedrop.com',
     crypt('Test123!@#', gen_salt('bf')),
     NOW(),
     '{"provider":"email","providers":["email"]}',
     '{"first_name":"Admin","last_name":"User"}',
     NOW(),
     NOW(),
     '',
     '',
     '',
     ''
   )
   RETURNING id;
   
   -- 2. Note the returned ID, then create profile
   INSERT INTO profiles (
     id,
     first_name,
     last_name,
     email,
     phone,
     role
   ) VALUES (
     'USER_ID_FROM_STEP_1',
     'Admin',
     'User',
     'admin@test.drivedrop.com',
     '+1 (555) 300-0003',
     'admin'
   );
   ```

2. **Alternative - Simpler Method:**
   ```sql
   -- Create regular user first, then upgrade to admin
   -- After creating account via signup page:
   
   UPDATE profiles 
   SET role = 'admin' 
   WHERE email = 'admin@test.drivedrop.com';
   ```

3. Log in at: `https://drivedrop.us.com/login`
4. Should redirect to **Admin Dashboard**
5. **Admin tour should auto-start!** 🛡️

**What to Test:**
- ✅ Admin dashboard tour (5 steps)
- ✅ Analytics section
- ✅ Driver management
- ✅ Pricing configuration
- ✅ Shipments overview
- ✅ User management
- ✅ Help button

---

### 4️⃣ **Broker Account**

**Email:** `broker@test.drivedrop.com`  
**Password:** `Test123!@#`

**Steps:**
1. Go to: `https://drivedrop.us.com/auth/broker-signup`
2. Fill in broker registration:
   - **Business Info:**
     - Company Name: `Test Logistics Inc`
     - DBA Name: `Test Logistics`
     - MC Number: `MC123456`
     - DOT Number: `DOT789012`
     - Federal Tax ID: `12-3456789`
   - **Personal Info:**
     - First Name: `Test`
     - Last Name: `Broker`
     - Email: `broker@test.drivedrop.com`
     - Phone: `+1 (555) 400-0004`
     - Password: `Test123!@#`
   - **Address:**
     - Street: `123 Broker St`
     - City: `Charlotte`
     - State: `NC`
     - Zip: `28202`
3. Submit application
4. **Verify in database (auto-created):**
   ```sql
   -- Check broker profile created
   SELECT * FROM broker_profiles 
   WHERE company_email = 'broker@test.drivedrop.com';
   
   -- Optional: Auto-approve broker
   UPDATE broker_profiles 
   SET verification_status = 'approved',
       verified_at = NOW()
   WHERE company_email = 'broker@test.drivedrop.com';
   ```
5. Log in → Should see **Broker Dashboard**
6. **Broker tour should auto-start!** 📊

**What to Test:**
- ✅ Broker dashboard tour (6 steps)
- ✅ Client management
- ✅ Carrier network
- ✅ Active assignments
- ✅ Commission earnings
- ✅ Reports section
- ✅ Help button

---

## 🧪 Complete Testing Checklist

### For Each Role:

**Dashboard Tour:**
- [ ] Tour auto-starts on first login (500ms delay)
- [ ] All steps highlight correct elements
- [ ] Progress shows "Step X of Y"
- [ ] Next/Previous buttons work
- [ ] Can close tour early
- [ ] Final "Done" button marks complete
- [ ] Database record updated (`dashboard_tour_completed = true`)

**Help Button:**
- [ ] Blue circle button appears (bottom-right)
- [ ] Clicking opens help menu
- [ ] "Restart Tour" option works
- [ ] Tour restarts from step 1
- [ ] Menu closes when clicking outside

**Onboarding Checklist (Client/Driver):**
- [ ] Checklist appears on dashboard
- [ ] Shows correct progress (0/4 or 0/3)
- [ ] Can click items to toggle
- [ ] Database updates on toggle
- [ ] Progress bar updates
- [ ] Hides when 100% complete

**Shipment Creation Tour (Client only):**
- [ ] Click "Create Shipment" button
- [ ] Tour auto-starts on form page
- [ ] 7 steps highlight form fields
- [ ] Pickup/delivery addresses highlighted
- [ ] Special instructions explained
- [ ] Vehicle selection shown
- [ ] Pricing preview highlighted
- [ ] Submit button is final step

**Database Verification:**
```sql
-- Check all tour records
SELECT 
  u.email,
  p.role,
  uo.dashboard_tour_completed,
  uo.shipment_creation_tour_completed,
  uo.checklist_progress,
  uo.show_tours,
  uo.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN user_onboarding uo ON uo.user_id = u.id
WHERE u.email LIKE '%@test.drivedrop.com'
ORDER BY p.role;
```

**Expected Result:**
```
email                          | role   | dashboard_tour | checklist_progress
-------------------------------|--------|----------------|-------------------
client@test.drivedrop.com      | client | true           | {...4 items...}
driver@test.drivedrop.com      | driver | true           | {...3 items...}
admin@test.drivedrop.com       | admin  | true           | {...1 item...}
broker@test.drivedrop.com      | broker | true           | {...2 items...}
```

---

## 🎯 Quick Test Scenarios

### Scenario 1: First-Time Client
1. Sign up as new client
2. Verify email
3. Log in
4. **Expect:** Tour auto-starts immediately
5. Complete tour
6. **Expect:** Checklist appears with 0/4
7. Click "Create Shipment"
8. **Expect:** Shipment tour starts
9. Complete shipment tour
10. **Expect:** Checklist shows 1/4 (first_shipment_created)

### Scenario 2: Returning User
1. Log in as existing client
2. **Expect:** No tour (already completed)
3. Checklist still shows
4. Click Help button → Restart Tour
5. **Expect:** Tour restarts from beginning

### Scenario 3: Driver Onboarding
1. Submit driver application
2. Admin approves in database
3. Log in as driver
4. **Expect:** Driver tour auto-starts
5. Shows available jobs, earnings, documents
6. Complete tour
7. **Expect:** Database updated

### Scenario 4: Admin First Login
1. Create admin account via SQL
2. Log in
3. **Expect:** Admin tour auto-starts
4. Highlights analytics, pricing, users
5. Help button works
6. Can restart tour

---

## 🔍 Debugging Test Accounts

### If Tour Doesn't Start:

```sql
-- Check user_onboarding record exists
SELECT * FROM user_onboarding WHERE user_id = 'USER_ID';

-- If doesn't exist, create it:
INSERT INTO user_onboarding (user_id, show_tours)
VALUES ('USER_ID', true);

-- Reset tour to test again:
UPDATE user_onboarding 
SET dashboard_tour_completed = false,
    shipment_creation_tour_completed = false
WHERE user_id = 'USER_ID';
```

### If Role Wrong:

```sql
-- Fix profile role
UPDATE profiles 
SET role = 'admin'  -- or 'client', 'driver', 'broker'
WHERE email = 'test@example.com';
```

### If Email Not Verified:

```sql
-- Manually verify email
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'test@example.com';
```

---

## 📊 Monitor Test Results

### Check Tour Completion:

```sql
SELECT 
  'Dashboard Tours Completed' as metric,
  COUNT(*) FILTER (WHERE dashboard_tour_completed = true) as value
FROM user_onboarding

UNION ALL

SELECT 
  'Shipment Tours Completed',
  COUNT(*) FILTER (WHERE shipment_creation_tour_completed = true)
FROM user_onboarding

UNION ALL

SELECT 
  'Users with Tours Enabled',
  COUNT(*) FILTER (WHERE show_tours = true)
FROM user_onboarding;
```

### Check Checklist Progress:

```sql
SELECT 
  u.email,
  p.role,
  (uo.checklist_progress->>'profile_completed')::boolean as profile,
  (uo.checklist_progress->>'payment_method_added')::boolean as payment,
  (uo.checklist_progress->>'first_shipment_created')::boolean as shipment,
  (uo.checklist_progress->>'first_shipment_tracked')::boolean as tracked,
  (uo.checklist_progress->>'documents_uploaded')::boolean as documents
FROM user_onboarding uo
JOIN auth.users u ON u.id = uo.user_id
JOIN profiles p ON p.id = uo.user_id
WHERE u.email LIKE '%@test.drivedrop.com';
```

---

## ✅ Success Criteria

**All 4 test accounts should:**
- ✅ Sign up/log in successfully
- ✅ See correct dashboard for role
- ✅ Tour auto-starts on first visit
- ✅ All tour steps work correctly
- ✅ Help button appears and functions
- ✅ Database records created/updated
- ✅ Can restart tours via Help button
- ✅ Checklist works (where applicable)
- ✅ No console errors
- ✅ Mobile responsive

**When all pass:** Onboarding system is production ready! 🚀
