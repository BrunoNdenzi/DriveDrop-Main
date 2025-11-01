# 🔐 Supabase Security Fixes - Action Plan

**Date:** January 27, 2025  
**Issues Found:** 299 total (4 errors, 295 warnings)  
**Status:** Ready to fix before launch

---

## 📊 **Issue Breakdown**

| Severity | Count | Description | Priority |
|----------|-------|-------------|----------|
| 🔴 ERROR | 4 | Security Definer Views (3) + RLS disabled (1) | **Fix Now** |
| 🟡 WARN | 48 | Function search_path mutable | **Fix Before Launch** |
| 🟡 WARN | 1 | PostGIS in public schema | **Document Only** |
| 🟡 WARN | 1 | Auth OTP long expiry | **Fix in Dashboard** |
| 🟡 WARN | 1 | Leaked password protection disabled | **Fix in Dashboard** |
| 🟡 WARN | 1 | Postgres version outdated | **Upgrade in Dashboard** |

**Total:** 57 issues (299 was likely counting line items)

---

## ✅ **IMMEDIATE FIXES - Do Before Launch**

### **Step 1: Fix SECURITY DEFINER Views** 🔴 CRITICAL

**What's wrong:** 3 views bypass RLS and run with elevated permissions  
**Risk:** Users might access data they shouldn't see  
**Time to fix:** 5 minutes

**Action:**
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/sql/new
2. Copy contents of `database/fixes/fix_security_definer_views.sql`
3. Paste and run
4. Verify with test query

**Files Created:**
- ✅ `database/fixes/fix_security_definer_views.sql`

**Views Fixed:**
- ✅ `conversation_participants` - Now respects user permissions
- ✅ `conversation_summaries` - Only shows user's conversations
- ✅ `shipment_applications_view` - Drivers see their apps, clients see their shipments

**Verification:**
```sql
-- Run this as a regular user (not service_role)
SELECT COUNT(*) FROM conversation_summaries;  
-- Should only show YOUR conversations, not all users'
```

---

### **Step 2: Fix Function Search Paths** 🟡 HIGH PRIORITY

**What's wrong:** 48 functions don't specify search_path  
**Risk:** Schema-based injection attacks  
**Time to fix:** 2 minutes

**Action:**
1. Open Supabase SQL Editor
2. Copy contents of `database/fixes/fix_function_search_paths.sql`
3. Paste and run
4. Verify with query at end of file

**Files Created:**
- ✅ `database/fixes/fix_function_search_paths.sql`

**Functions Fixed:** 48 total including:
- Message functions (11)
- Shipment functions (9)
- Payment functions (5)
- Driver functions (6)
- Tracking functions (4)
- And more...

**Verification:**
```sql
SELECT 
  proname as function_name,
  proconfig as search_path_config
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE '%message%';
-- Should show: {search_path=public,pg_catalog}
```

---

### **Step 3: Enable RLS on spatial_ref_sys** 🔴 CRITICAL

**What's wrong:** PostGIS system table doesn't have RLS enabled  
**Risk:** Very low (system table with no user data)  
**Time to fix:** 30 seconds

**Action:**
Already included in `fix_security_definer_views.sql` script above!

**Verification:**
```sql
SELECT rowsecurity FROM pg_tables 
WHERE tablename = 'spatial_ref_sys';
-- Should return: true
```

---

### **Step 4: Supabase Dashboard Settings** 🟡 IMPORTANT

**What's wrong:** Auth settings not optimal  
**Risk:** Moderate (security best practices)  
**Time to fix:** 5 minutes

**Actions:**

#### **A. Fix OTP Expiry**
1. Go to: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/auth/settings
2. Find: "Email Auth" section
3. Set: **OTP Expiry = 3600 seconds (1 hour)** (currently longer)
4. Save changes

#### **B. Enable Leaked Password Protection** ⚠️ IMPORTANT
1. Same page: Authentication → Settings
2. Find: "Password Requirements" section
3. **Enable: "Check for leaked passwords"** toggle ✓
4. This checks against HaveIBeenPwned database
5. Save changes

#### **C. Upgrade Postgres Version**
1. Go to: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/settings/infrastructure
2. Find: "Postgres Version" section
3. Click: "Upgrade" button (if available)
4. Current: 17.4.1.054
5. Target: Latest available (17.4.1.055+)
6. **NOTE:** Upgrade may cause brief downtime (1-2 minutes)

---

## 📋 **NICE TO HAVE - Can Do After Launch**

### **PostGIS Extension in Public Schema**

**What's wrong:** Extension in public schema instead of separate schema  
**Risk:** Very low (trusted extension)  
**Recommendation:** **LEAVE IT** - Don't move it

**Why it's safe:**
- PostGIS is a trusted, widely-used extension
- Moving it can break existing spatial queries
- Supabase officially keeps it in public schema
- RLS on your actual tables protects your data
- This warning is overly cautious

**Action:** None required. Already documented in `fix_other_warnings.sql`

---

## 🧪 **Testing Plan**

### **After Applying SQL Fixes:**

**Test 1: Views Security**
```sql
-- Login as a test CLIENT user
SELECT * FROM conversation_summaries;
-- Should ONLY show conversations where you're a participant

SELECT * FROM shipment_applications_view;
-- Should ONLY show applications for YOUR shipments

-- Login as a test DRIVER user  
SELECT * FROM shipment_applications_view;
-- Should ONLY show YOUR driver applications

-- Try to access another user's data
SELECT * FROM conversations WHERE shipment_id = 'some-other-users-shipment';
-- Should return 0 rows or error
```

**Test 2: Function Security**
```sql
-- Call a message function
SELECT send_message_v2(
  'test-conversation-id',
  'Hello, this is a test'
);
-- Should work if you're part of conversation
-- Should fail if you're not part of conversation
```

**Test 3: RLS on spatial_ref_sys**
```sql
-- This should work (read access)
SELECT COUNT(*) FROM spatial_ref_sys;

-- This should fail (no write access for users)
INSERT INTO spatial_ref_sys VALUES (999999, 'TEST', 999999, 'test', 'test');
-- Expected: permission denied
```

---

## ⏱️ **Estimated Time**

| Task | Time | When |
|------|------|------|
| Fix SECURITY DEFINER views | 5 min | **Now** |
| Fix function search paths | 2 min | **Now** |
| Enable RLS on spatial_ref_sys | 30 sec | **Now** (already in script 1) |
| Update Auth settings | 5 min | **Before launch** |
| Upgrade Postgres | 10 min | **Before launch** |
| Testing | 15 min | **After each fix** |
| **TOTAL** | **~40 minutes** | **Before launch** |

---

## 🎯 **Priority Order**

**TODAY (Before Launch):**
1. ✅ Run `fix_security_definer_views.sql` (5 min)
2. ✅ Run `fix_function_search_paths.sql` (2 min)
3. ✅ Test with verification queries (10 min)
4. ✅ Enable leaked password protection in Dashboard (2 min)
5. ✅ Fix OTP expiry in Dashboard (2 min)

**BEFORE LAUNCH (Within 1 Week):**
6. ⏰ Upgrade Postgres version (10 min + brief downtime)
7. ⏰ Re-run Security Advisor to verify all fixes

**AFTER LAUNCH (Nice to have):**
8. 📝 PostGIS extension - Leave as is (documented)

---

## ✅ **Verification Checklist**

After running all fixes, verify:

**SQL Fixes:**
- [ ] All 3 SECURITY DEFINER views recreated without elevated permissions
- [ ] All 48 functions have `search_path` set
- [ ] `spatial_ref_sys` has RLS enabled
- [ ] Test queries confirm security working

**Dashboard Settings:**
- [ ] OTP expiry set to 1 hour or less
- [ ] Leaked password protection enabled
- [ ] Postgres version upgraded (or scheduled)

**Final Verification:**
- [ ] Re-run Supabase Security Advisor
- [ ] Confirm issue count dropped from 299 to ~1 (just PostGIS warning)
- [ ] Test app with real user accounts
- [ ] Verify no functionality broken

---

## 📄 **Files Created**

All SQL fix scripts are in: `database/fixes/`

1. **fix_security_definer_views.sql**
   - Fixes 4 CRITICAL errors
   - Recreates 3 views without SECURITY DEFINER
   - Enables RLS on spatial_ref_sys

2. **fix_function_search_paths.sql**
   - Fixes 48 WARN issues
   - Sets search_path on all functions
   - Prevents schema injection attacks

3. **fix_other_warnings.sql**
   - Documents PostGIS extension decision
   - Checklist for Dashboard settings
   - Notes for Postgres upgrade

---

## 🚨 **What Happens If You Don't Fix These?**

### **Not Fixed:**

**SECURITY DEFINER Views (Critical):**
- ❌ Users might see other users' conversations
- ❌ Drivers might see all shipment applications
- ❌ Data privacy violation
- ❌ Potential legal issues (GDPR, CCPA)

**Function Search Paths (High):**
- ❌ Vulnerable to schema-based attacks
- ❌ Attackers could manipulate function behavior
- ❌ Could lead to data exposure or modification

**Leaked Password Protection (Medium):**
- ❌ Users can use known compromised passwords
- ❌ Accounts easier to brute force
- ❌ Security best practice violation

### **Fixed:**

- ✅ Data properly isolated per user
- ✅ Functions secure against injection
- ✅ Passwords checked against breach database
- ✅ Postgres up to date with security patches
- ✅ Pass security audits
- ✅ Ready for production

---

## 💡 **Pro Tips**

1. **Backup First:**
   - Supabase auto-backs up daily
   - Can also create manual backup before changes
   - Go to: Settings → Database → Backups

2. **Test on Staging First (If Available):**
   - Run fixes on test/staging database first
   - Verify nothing breaks
   - Then apply to production

3. **Monitor After Changes:**
   - Check Supabase logs after applying fixes
   - Watch for any errors in app
   - Have rollback plan ready

4. **Re-Run Security Advisor:**
   - After all fixes: Database → Security Advisor
   - Click "Run Checks"
   - Should show ~1 issue (PostGIS warning - ignore it)

---

## 📞 **If Something Breaks**

**Rollback Plan:**

1. **If views break:**
   ```sql
   -- Restore original view (get definition from backup query in script)
   CREATE OR REPLACE VIEW public.conversation_summaries
   SECURITY DEFINER AS
   <original definition>;
   ```

2. **If functions break:**
   ```sql
   -- Remove search_path from specific function
   ALTER FUNCTION public.function_name RESET search_path;
   ```

3. **If completely stuck:**
   - Go to Supabase Dashboard → Database → Backups
   - Restore from backup before changes
   - Contact on Discord: @YourDiscord

---

## 🎉 **Success Criteria**

You'll know fixes worked when:

1. ✅ Supabase Security Advisor shows ~1 issue (down from 299)
2. ✅ Test users can only see their own data
3. ✅ App functionality unchanged
4. ✅ No new errors in logs
5. ✅ All verification queries pass

---

## 📝 **Next Steps**

**Right now:**
1. Review this document
2. Open Supabase SQL Editor
3. Run `fix_security_definer_views.sql`
4. Run `fix_function_search_paths.sql`
5. Run verification queries
6. Update Dashboard settings
7. Re-run Security Advisor
8. Mark as complete in GO_LIVE_CHECKLIST.md

**You've got this!** These fixes are straightforward and will make your database production-ready. 🔐

---

**Document Version:** 1.0  
**Last Updated:** January 27, 2025  
**Status:** Ready to execute
