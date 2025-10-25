# Driver Applications Feature - Testing Guide

## Prerequisites

1. **Admin Account Required**
   - You need a user with `role = 'admin'` in the `profiles` table
   - If you don't have one, create it:
   ```sql
   UPDATE profiles 
   SET role = 'admin' 
   WHERE email = 'your-admin-email@example.com';
   ```

2. **Test Data**
   - The seed data already includes 2 approved driver applications
   - You may want to create pending applications for testing

## Creating Test Driver Applications

### Option 1: Via SQL (Quick)
```sql
-- Create a pending application
INSERT INTO driver_applications (
    user_id, 
    status, 
    vehicle_type, 
    vehicle_make, 
    vehicle_model, 
    vehicle_year,
    license_number, 
    license_expiry, 
    insurance_provider, 
    insurance_policy_number, 
    insurance_expiry
)
SELECT 
    id,
    'pending',
    'car',
    'Tesla',
    'Model 3',
    2023,
    'DL999888777',
    '2026-12-31',
    'Geico',
    'GEICO-999888',
    '2025-12-31'
FROM profiles 
WHERE role = 'client' 
LIMIT 1;
```

### Option 2: Via App (Realistic)
1. Sign up as a new user (they start as 'client')
2. Navigate to driver application form (if available in app)
3. Fill out vehicle and document information
4. Submit application

## Test Scenarios

### Test 1: View Applications Screen
**Steps:**
1. Login as admin
2. Navigate to Admin Dashboard
3. Check that "Applications" stat shows correct count (should match pending count)
4. Click "Driver Applications" button
5. Verify screen loads with list of applications

**Expected Result:**
- ✅ Screen loads without errors
- ✅ Shows applications in card format
- ✅ Default filter is "Pending"
- ✅ Each card shows applicant info, vehicle details, license, insurance

**Console Logs to Check:**
```
Loaded X driver applications with filter: pending
```

---

### Test 2: Filter Functionality
**Steps:**
1. On Driver Applications screen
2. Click "All" tab
3. Click "Pending" tab
4. Click "Approved" tab
5. Click "Rejected" tab

**Expected Result:**
- ✅ Each tab shows only applications with that status
- ✅ Active tab is highlighted in blue
- ✅ Count text updates: "X pending applications"
- ✅ Empty state shown when no applications in category

---

### Test 3: Approve Application
**Steps:**
1. Filter to "Pending" applications
2. Find an application card
3. Click "Approve" button (green)
4. Confirm in dialog
5. Wait for success alert
6. Refresh the screen (pull down)
7. Check database:
   ```sql
   SELECT status FROM driver_applications WHERE id = '[application-id]';
   SELECT role FROM profiles WHERE id = '[user-id]';
   ```

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ After confirming, shows "Application approved successfully"
- ✅ Application disappears from "Pending" filter
- ✅ Application appears in "Approved" filter with green badge
- ✅ User's role in `profiles` table = 'driver'
- ✅ Application status in `driver_applications` table = 'approved'

**Console Logs to Check:**
```
Application approved successfully
Loaded X driver applications with filter: approved
```

---

### Test 4: Reject Application
**Steps:**
1. Filter to "Pending" applications
2. Find an application card
3. Click "Reject" button (red)
4. Confirm in dialog
5. Wait for success alert
6. Refresh the screen
7. Check database:
   ```sql
   SELECT status FROM driver_applications WHERE id = '[application-id]';
   SELECT role FROM profiles WHERE id = '[user-id]';
   ```

**Expected Result:**
- ✅ Confirmation dialog appears
- ✅ After confirming, shows "Application rejected successfully"
- ✅ Application disappears from "Pending" filter
- ✅ Application appears in "Rejected" filter with red badge
- ✅ User's role in `profiles` table = unchanged (not 'driver')
- ✅ Application status in `driver_applications` table = 'rejected'

---

### Test 5: Pull to Refresh
**Steps:**
1. On Driver Applications screen
2. Pull down from top of list
3. Wait for loading indicator
4. Release

**Expected Result:**
- ✅ Loading spinner appears
- ✅ Applications reload from database
- ✅ Any changes from database reflected
- ✅ Loading spinner disappears

---

### Test 6: Status Badge Colors
**Steps:**
1. Filter to "All"
2. Look at application cards

**Expected Result:**
- ✅ Pending applications: Orange badge with "PENDING"
- ✅ Approved applications: Green badge with "APPROVED"
- ✅ Rejected applications: Red badge with "REJECTED"
- ✅ Icon matches status (pending=⏳, approved=✓, rejected=✗)

---

### Test 7: Application Details Display
**Steps:**
1. View any application card
2. Verify all information is visible and correct

**Expected Result:**
- ✅ Applicant name, email, phone clearly visible
- ✅ Vehicle info: Year Make Model (e.g., "2023 Tesla Model 3")
- ✅ Vehicle type icon and label
- ✅ License number shown
- ✅ License expiry date formatted correctly
- ✅ Insurance provider name
- ✅ Insurance policy number
- ✅ Insurance expiry date formatted correctly
- ✅ Background check status (if present)
- ✅ Admin notes (if present)
- ✅ Application date: "Applied: MM/DD/YYYY at HH:MM AM/PM"

---

### Test 8: Action Buttons Visibility
**Steps:**
1. Check various application cards

**Expected Result:**
- ✅ Pending applications: Both Approve and Reject buttons visible
- ✅ Approved applications: No action buttons
- ✅ Rejected applications: No action buttons

---

### Test 9: Empty States
**Steps:**
1. Filter to a status with no applications
2. Observe empty state

**Expected Result:**
- ✅ Large icon displayed
- ✅ Message: "No [status] applications found"
- ✅ Helpful subtext explaining what will appear there

---

### Test 10: Back Navigation
**Steps:**
1. From Driver Applications screen
2. Click back button in header
3. Should return to Admin Dashboard

**Expected Result:**
- ✅ Returns to previous screen
- ✅ Dashboard stats update if applications were processed
- ✅ No crashes or errors

---

### Test 11: Error Handling
**Steps:**
1. Turn off internet connection
2. Try to load applications
3. Try to approve/reject an application

**Expected Result:**
- ✅ Network errors show user-friendly alert
- ✅ Pull-to-refresh allows retry
- ✅ App doesn't crash

---

### Test 12: Non-Admin Access
**Steps:**
1. Logout
2. Login as a client or driver (not admin)
3. Try to navigate to `/AdminDriverApplications` screen

**Expected Result:**
- ✅ Access denied alert appears
- ✅ User redirected back to previous screen
- ✅ RLS prevents data access even if screen accessed

---

### Test 13: Dashboard Integration
**Steps:**
1. Login as admin
2. View Admin Dashboard
3. Check "Applications" card in User Statistics

**Expected Result:**
- ✅ Shows correct count of pending applications
- ✅ Matches count when you filter by "Pending" in applications screen
- ✅ Clicking "Driver Applications" button navigates to screen (not alert)

---

### Test 14: Role Change Verification
**Steps:**
1. Approve a pending application
2. Logout as admin
3. Login as the approved user
4. Check what tabs/screens they see

**Expected Result:**
- ✅ User now sees Driver tabs/navigation
- ✅ User can access driver-only features
- ✅ User can view available shipments to apply for

**Database Check:**
```sql
SELECT 
    p.email,
    p.role,
    da.status as application_status
FROM profiles p
JOIN driver_applications da ON p.id = da.user_id
WHERE da.id = '[application-id]';

-- Should show:
-- role = 'driver'
-- application_status = 'approved'
```

---

## Performance Testing

### Load Test: Many Applications
**Setup:**
```sql
-- Create 50 test applications
INSERT INTO driver_applications (
    user_id, status, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
    license_number, license_expiry, insurance_provider, insurance_policy_number, insurance_expiry
)
SELECT 
    user_id,
    (ARRAY['pending', 'approved', 'rejected'])[floor(random() * 3 + 1)],
    (ARRAY['car', 'van', 'truck'])[floor(random() * 3 + 1)],
    'TestMake',
    'TestModel',
    2020 + floor(random() * 4)::int,
    'DL' || floor(random() * 100000000)::text,
    CURRENT_DATE + (floor(random() * 365) || ' days')::interval,
    'TestInsurance',
    'POL' || floor(random() * 1000000)::text,
    CURRENT_DATE + (floor(random() * 365) || ' days')::interval
FROM (
    SELECT id as user_id FROM profiles WHERE role = 'client' LIMIT 50
) users;
```

**Expected Result:**
- ✅ Screen loads within 2 seconds
- ✅ Scrolling is smooth
- ✅ No memory issues
- ✅ Filtering is fast

---

## Database Verification Queries

### 1. Check Application Counts
```sql
SELECT status, COUNT(*) 
FROM driver_applications 
GROUP BY status;
```

### 2. Verify Approved User Roles
```sql
SELECT 
    p.email,
    p.role,
    da.status
FROM profiles p
JOIN driver_applications da ON p.id = da.user_id
WHERE da.status = 'approved';

-- All should show role = 'driver'
```

### 3. Check Recent Activity
```sql
SELECT 
    p.first_name || ' ' || p.last_name as applicant,
    da.status,
    da.updated_at
FROM driver_applications da
JOIN profiles p ON da.user_id = p.id
ORDER BY da.updated_at DESC
LIMIT 10;
```

---

## Common Issues & Solutions

### Issue: "No applications found"
**Causes:**
- No applications in database
- RLS policy blocking access
- Wrong filter selected

**Solution:**
- Check database: `SELECT COUNT(*) FROM driver_applications;`
- Verify user role: `SELECT role FROM profiles WHERE id = auth.uid();`
- Try "All" filter to see if any exist

---

### Issue: "Access Denied" alert
**Causes:**
- User is not admin
- RLS policies not set up correctly

**Solution:**
- Check role: `SELECT role FROM profiles WHERE email = 'your-email';`
- Update role: `UPDATE profiles SET role = 'admin' WHERE email = 'your-email';`
- Verify RLS policies exist

---

### Issue: Approved but role didn't change
**Causes:**
- Error during profile update
- RLS blocking profile update

**Solution:**
- Check logs for error message
- Manually update: `UPDATE profiles SET role = 'driver' WHERE id = '[user-id]';`
- Verify RLS policies allow admin updates

---

### Issue: Applications not loading
**Causes:**
- Network error
- Database connection issue
- RLS blocking query

**Solution:**
- Check console for error messages
- Verify Supabase connection
- Test query in Supabase SQL editor

---

## Sign-Off Checklist

Before marking this feature as complete, verify:

- [ ] Admin can view driver applications
- [ ] Filtering by status works
- [ ] Can approve pending applications
- [ ] Can reject pending applications
- [ ] Approved users get 'driver' role
- [ ] Status badges show correct colors
- [ ] All application details display correctly
- [ ] Pull-to-refresh works
- [ ] Empty states display properly
- [ ] Back navigation works
- [ ] Non-admins cannot access
- [ ] No TypeScript errors
- [ ] No console errors during normal operation
- [ ] Performance is acceptable with many applications

---

## Success! 🎉

Once all tests pass, the Driver Applications Admin feature is **fully functional** and ready for production use!
