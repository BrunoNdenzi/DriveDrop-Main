# Broker Integration Testing Guide

## Overview
This guide provides step-by-step instructions for testing the complete broker integration system, including registration, dashboard, load board, and carrier network management.

## Prerequisites
- Supabase project with broker integration schema deployed
- Local development server running (`npm run dev`)
- Access to Supabase Dashboard (for creating test users)

---

## Phase 1: Create Test Broker Account

### Step 1.1: Create Auth User
1. Open Supabase Dashboard → Authentication → Users
2. Click "Add User" or "Invite User"
3. Enter credentials:
   - **Email**: `broker.test@drivedrop.com`
   - **Password**: `TestBroker123!`
   - **Auto-confirm**: Enable
4. Click "Create User"
5. **Copy the User ID** (you'll need this for the SQL script)

### Step 1.2: Run Test Data SQL Script
1. Open Supabase Dashboard → SQL Editor
2. Open `test_broker_account.sql` from the project root
3. **Replace all instances** of `YOUR_AUTH_USER_ID` with the actual User ID from Step 1.1
   - Find and replace: `YOUR_AUTH_USER_ID` → `<actual-uuid>`
4. Click "Run" to execute the script
5. Verify success by running the verification queries at the bottom of the script

### Step 1.3: Verify Test Data Created
Run these queries in SQL Editor to confirm:

```sql
-- Should return 1 broker profile
SELECT * FROM broker_profiles WHERE profile_id = '<your-user-id>';

-- Should return 3 carrier relationships
SELECT * FROM broker_carriers WHERE broker_id = (
  SELECT id FROM broker_profiles WHERE profile_id = '<your-user-id>'
);

-- Should return 3 load board entries
SELECT * FROM load_board WHERE broker_id = (
  SELECT id FROM broker_profiles WHERE profile_id = '<your-user-id>'
);
```

---

## Phase 2: Test Broker Registration Flow

### Step 2.1: Access Registration Page
1. Navigate to: `http://localhost:3000/auth/broker-signup`
2. Verify the page loads with 4-step wizard interface

### Step 2.2: Complete Registration Steps

**Step 1: Account Information**
- Full Name: `Jane Doe`
- Email: `jane.broker@example.com`
- Password: `TestPassword123!`
- Phone: `+1-555-9999`
- Click "Next"

**Step 2: Company Information**
- Company Name: `JD Logistics Inc`
- DOT Number: `9876543`
- MC Number: `123456`
- Tax ID: `98-7654321`
- Business Structure: `LLC`
- Commission Rate: `25` (default)
- Click "Next"

**Step 3: Address Information**
- Street: `456 Freight Ave`
- Apartment/Suite: `Floor 2`
- City: `Dallas`
- State: `TX`
- ZIP Code: `75201`
- Click "Next"

**Step 4: Review & Submit**
- Review all information
- Click "Complete Registration"
- Wait for success message
- Should redirect to dashboard with `?welcome=true` parameter

### Step 2.3: Verify New Broker Created
```sql
SELECT * FROM profiles WHERE email = 'jane.broker@example.com';
SELECT * FROM broker_profiles WHERE profile_id = (
  SELECT id FROM profiles WHERE email = 'jane.broker@example.com'
);
```

---

## Phase 3: Test Broker Dashboard

### Step 3.1: Login as Test Broker
1. Navigate to: `http://localhost:3000/auth/signin`
2. Login with:
   - **Email**: `broker.test@drivedrop.com`
   - **Password**: `TestBroker123!`
3. Should redirect to `/dashboard/broker`

### Step 3.2: Verify Dashboard Components

**Welcome Banner**
- [ ] Appears on first login with `?welcome=true`
- [ ] Contains welcome message and company name
- [ ] Can be dismissed

**KPI Cards**
- [ ] **Total Shipments**: Shows 0 (0 active)
- [ ] **Revenue**: Shows $0.00 ($0.00 pending)
- [ ] **Carriers**: Shows 3 (2 active) - from test data
- [ ] **Rating**: Shows 0.0 (0% on-time)

**Verification Progress**
- [ ] Shows 100% (test account is pre-verified)
- [ ] Green checkmark with "Verified" badge

**Quick Actions**
- [ ] "Load Board" button navigates to `/dashboard/broker/load-board`
- [ ] "Carriers" button navigates to `/dashboard/broker/carriers`
- [ ] "Assignments" button navigates to `/dashboard/broker/assignments`
- [ ] "Payouts" button navigates to `/dashboard/broker/payouts`

**Company Information**
- [ ] Displays company name: "TestBroker Logistics LLC"
- [ ] Shows DOT number: 1234567
- [ ] Shows MC number: 654321
- [ ] Shows address: "123 Logistics Ave, Suite 100, Chicago, IL 60601"
- [ ] Shows commission rate: 25%
- [ ] Shows platform fee: 10%

---

## Phase 4: Test Load Board

### Step 4.1: Access Load Board
1. Click "Load Board" from dashboard OR
2. Navigate to: `http://localhost:3000/dashboard/broker/load-board`

### Step 4.2: Verify Load Display
Should see 3 test loads:
- [ ] **Load 1**: Chicago, IL → New York, NY (Toyota Camry 2023)
- [ ] **Load 2**: Los Angeles, CA → San Francisco, CA (Honda CR-V 2022)
- [ ] **Load 3**: Miami, FL → Orlando, FL (Ford F-150 2021)

**For each load card, verify:**
- [ ] Green dot (pickup) → Arrow → Red dot (delivery)
- [ ] City, state, ZIP displayed for both pickup/delivery
- [ ] Vehicle icon, make, model, year
- [ ] Distance in miles
- [ ] Pickup date, delivery date, posted date
- [ ] Suggested carrier payout amount (large green text)
- [ ] Max commission note
- [ ] "Place Bid" button (enabled since verified)
- [ ] "View Details" button

### Step 4.3: Test Filters

**Search Filter**
1. Enter "Toyota" in search box
   - [ ] Should show only Load 1 (Toyota Camry)
2. Enter "Chicago" in search box
   - [ ] Should show only Load 1 (Chicago pickup)
3. Clear search
   - [ ] Should show all 3 loads

**Sort Filter**
1. Select "Price (High to Low)"
   - [ ] Should show: Load 1 ($650) → Load 2 ($420) → Load 3 ($350)
2. Select "Distance (Longest First)"
   - [ ] Should show: Load 1 (790mi) → Load 2 (382mi) → Load 3 (234mi)
3. Select "Posted Date (Newest First)"
   - [ ] All same date, order may vary

**State Filters**
1. Enter "CA" in Pickup State
   - [ ] Should show only Load 2 (Los Angeles)
2. Clear, enter "FL" in Delivery State
   - [ ] Should show only Load 3 (Orlando delivery)
3. Clear filters

**Vehicle Type Filter**
1. Select "Sedan"
   - [ ] Should show only Load 1 (Toyota Camry)
2. Select "SUV"
   - [ ] Should show only Load 2 (Honda CR-V)
3. Select "Truck"
   - [ ] Should show only Load 3 (Ford F-150)

**Price Range Filter**
1. Set Min Price: `400`, Max Price: `700`
   - [ ] Should show Loads 1 and 2 only
2. Set Min Price: `600`
   - [ ] Should show only Load 1

**Clear All Filters**
1. Click "Clear All" button
   - [ ] All filters reset
   - [ ] All 3 loads displayed

### Step 4.4: Test Actions

**Place Bid**
1. Click "Place Bid" on Load 1
   - [ ] Should open bid placement modal (if implemented)
   - [ ] OR navigate to bid page

**View Details**
1. Click "View Details" on Load 1
   - [ ] Should navigate to `/dashboard/broker/load-board/[load-id]`
   - [ ] OR show detail modal (if implemented)

---

## Phase 5: Test Carrier Network Management

### Step 5.1: Access Carrier Network
1. Click "Carriers" from dashboard OR
2. Navigate to: `http://localhost:3000/dashboard/broker/carriers`

### Step 5.2: Verify Stats Cards
- [ ] **Total Carriers**: Shows 3
- [ ] **Active**: Shows 2 (Driver 1 and Driver 3)
- [ ] **Pending**: Shows 1 (Driver 2)
- [ ] **Total Shipments**: Shows 0 (no completed shipments yet)

### Step 5.3: Verify Carrier List
Should see 3 carriers from test data:

**Carrier 1: Mike Johnson**
- [ ] Name: "Mike Johnson"
- [ ] Email: driver1.test@drivedrop.com
- [ ] Phone: +1-555-0124
- [ ] Status badge: "active" (green)
- [ ] Commission: 25%
- [ ] 0 shipments
- [ ] No rating yet
- [ ] "Terminate" button visible
- [ ] "View Details" button visible

**Carrier 2: Sarah Williams**
- [ ] Name: "Sarah Williams"
- [ ] Email: driver2.test@drivedrop.com
- [ ] Phone: +1-555-0125
- [ ] Status badge: "pending" (yellow)
- [ ] Commission: 23%
- [ ] "Invitation sent" text visible
- [ ] "View Details" button visible

**Carrier 3: David Brown**
- [ ] Name: "David Brown"
- [ ] Email: driver3.test@drivedrop.com
- [ ] Phone: +1-555-0126
- [ ] Status badge: "active" (green)
- [ ] Commission: 26%
- [ ] 0 shipments
- [ ] No rating yet
- [ ] "Terminate" button visible
- [ ] "View Details" button visible

### Step 5.4: Test Search Filter
1. Enter "Mike" in search box
   - [ ] Should show only Mike Johnson
2. Enter "driver2" in search box
   - [ ] Should show only Sarah Williams
3. Enter "555-0126" in search box
   - [ ] Should show only David Brown
4. Clear search

### Step 5.5: Test Status Filter
1. Select "Active" from status dropdown
   - [ ] Should show Mike Johnson and David Brown only
2. Select "Pending"
   - [ ] Should show Sarah Williams only
3. Select "All Statuses"
   - [ ] Should show all 3 carriers

### Step 5.6: Test Invite Carrier

**Open Invite Modal**
1. Click "+ Invite Carrier" button
   - [ ] Modal opens with invite form

**Fill Invite Form**
1. Enter email: `driver4.test@drivedrop.com`
2. Enter commission rate: `24`
3. Enter payment terms: `Net 14 days`
4. Enter notes: `Specializes in luxury vehicles`
5. Click "Send Invitation"

**Verify Invitation**
- [ ] Success message appears
- [ ] Modal closes
- [ ] Carrier list refreshes
- [ ] New carrier appears with "pending" status

**Error Handling**
1. Try inviting with invalid email
   - [ ] Error message: "No driver found with this email address"
2. Try inviting same carrier twice
   - [ ] Error message: "Carrier relationship already exists"

### Step 5.7: Test Terminate Carrier
1. Click "Terminate" on Mike Johnson
   - [ ] Confirmation dialog appears
2. Click "Cancel"
   - [ ] No changes made
3. Click "Terminate" again, confirm
   - [ ] Success message appears
   - [ ] Status changes to "terminated"
   - [ ] Terminate button hidden

---

## Phase 6: Test Verification Flow (New Broker)

### Step 6.1: Login as Unverified Broker
1. Logout from test broker account
2. Login as `jane.broker@example.com` (created in Phase 2)
3. Dashboard should show:
   - [ ] Verification progress < 100%
   - [ ] Yellow warning about verification

### Step 6.2: Verify Load Board Restrictions
1. Navigate to Load Board
2. Try to click "Place Bid" on any load
   - [ ] Button should be disabled
   - [ ] Tooltip or message: "Complete verification to place bids"

---

## Phase 7: Edge Cases & Error Handling

### Test 7.1: Empty States

**No Carriers**
1. Create new broker without running carrier test data
2. Navigate to Carriers page
   - [ ] Empty state displays
   - [ ] Message: "No carriers found"
   - [ ] "Get started by inviting a carrier" text
   - [ ] "Invite Carrier" button visible

**No Loads**
1. Create new broker without running load board test data
2. Navigate to Load Board
   - [ ] Empty state displays
   - [ ] Message: "No available loads"
   - [ ] Helpful suggestion text

**Filtered Results Empty**
1. Apply filters that match no loads/carriers
   - [ ] Empty state with "Try adjusting your filters" message

### Test 7.2: Authentication

**Unauthenticated Access**
1. Logout completely
2. Try to access `/dashboard/broker`
   - [ ] Redirects to `/auth/signin`
3. Try to access `/dashboard/broker/load-board`
   - [ ] Redirects to `/auth/signin`

**Wrong Role Access**
1. Login as client or driver
2. Try to access broker dashboard
   - [ ] Should show "Unauthorized" or redirect

### Test 7.3: Network Errors
1. Disconnect internet
2. Try to load dashboard
   - [ ] Error message displays
3. Try to invite carrier
   - [ ] Error message: "Failed to send invitation"

---

## Phase 8: Cross-Browser Testing

Test in multiple browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**For each browser, verify:**
- [ ] Dashboard loads correctly
- [ ] Filters work properly
- [ ] Modals display correctly
- [ ] Buttons are clickable
- [ ] Responsive layout at different screen sizes

---

## Phase 9: Mobile Responsiveness

Test on mobile devices or browser dev tools:

**Breakpoints to test:**
- [ ] Mobile (375px - 640px)
- [ ] Tablet (640px - 1024px)
- [ ] Desktop (1024px+)

**For each breakpoint:**
- [ ] Dashboard cards stack vertically
- [ ] Navigation is accessible
- [ ] Filters collapse/expand properly
- [ ] Load cards display correctly
- [ ] Carrier list is readable
- [ ] Modals are usable

---

## Phase 10: Performance Testing

### Test 10.1: Large Data Sets
1. Add 100+ loads to load_board table
2. Add 50+ carriers to broker_carriers table
3. Verify:
   - [ ] Dashboard loads within 2 seconds
   - [ ] Filters respond instantly
   - [ ] Scrolling is smooth
   - [ ] No console errors

### Test 10.2: Concurrent Actions
1. Open multiple browser tabs
2. Perform actions in different tabs
3. Verify data consistency across tabs

---

## Common Issues & Solutions

### Issue: "Cannot find module '@/lib/supabase-client'"
**Solution**: Verify file exists at `website/src/lib/supabase-client.ts`

### Issue: Load board shows no loads
**Solution**: 
1. Check broker verification status (must be verified)
2. Verify loads exist in database
3. Check RLS policies allow broker to read loads

### Issue: Cannot invite carrier
**Solution**:
1. Verify carrier exists with role='driver'
2. Check carrier is not already in network
3. Verify broker is verified

### Issue: Dashboard shows 0 for all KPIs
**Solution**: This is correct for new accounts - KPIs update as shipments are completed

---

## Success Criteria

All tests pass when:
- ✅ Broker registration creates complete account
- ✅ Dashboard displays correct KPIs and company info
- ✅ Load board filters work correctly
- ✅ Carrier network management functions properly
- ✅ Verification gates prevent unauthorized actions
- ✅ Error messages are clear and helpful
- ✅ UI is responsive on all screen sizes
- ✅ No console errors or warnings

---

## Next Steps After Testing

1. **Document Bugs**: Create issues for any failures
2. **Performance Optimization**: If load times > 2s
3. **Add E2E Tests**: Playwright or Cypress tests
4. **User Acceptance Testing**: Get real broker feedback
5. **Production Deployment**: Follow deployment checklist

---

## Test Data Cleanup

To reset test environment:

```sql
-- Delete test loads
DELETE FROM load_board WHERE broker_id IN (
  SELECT id FROM broker_profiles WHERE profile_id IN (
    SELECT id FROM profiles WHERE email LIKE '%test@drivedrop.com'
  )
);

-- Delete test carrier relationships
DELETE FROM broker_carriers WHERE broker_id IN (
  SELECT id FROM broker_profiles WHERE profile_id IN (
    SELECT id FROM profiles WHERE email LIKE '%test@drivedrop.com'
  )
);

-- Delete test broker profiles
DELETE FROM broker_profiles WHERE profile_id IN (
  SELECT id FROM profiles WHERE email LIKE '%test@drivedrop.com'
);

-- Delete test profiles (be careful with this!)
DELETE FROM profiles WHERE email LIKE '%test@drivedrop.com';
```

**CAUTION**: Only run cleanup in development/testing environments!
