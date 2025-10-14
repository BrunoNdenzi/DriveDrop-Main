# ⚠️ IMPORTANT: Run SQL Migration First!

## 🎯 Quick Links

- **Having errors?** See `ALL_ERRORS_FIXED.md` for complete troubleshooting
- **Need details?** See `SQL_FIXES_APPLIED.md` for technical explanation

---

## Errors You Might See

### Error 1: "Could not find function check_cancellation_eligibility"
### Error 2: "missing FROM-clause entry for table 'new'"
### Error 3: "new row violates row-level security policy for table tracking_events"

**ALL THREE ARE FIXED!** Just run the SQL migration below.

---

## Error You're Seeing

```
ERROR Error checking cancellation eligibility: 
{"code": "PGRST202", "message": "Could not find the function public.check_cancellation_eligibility(p_shipment_id) in the schema cache"}
```

## Why This Happens

The mobile app is trying to call a database function that **doesn't exist yet** because you haven't run the SQL migration.

## ✅ Solution: Run the SQL Migration

### 🚀 FASTEST Way (Recommended for Quick Testing)

1. **Open Your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your DriveDrop project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the Quick Fix SQL**
   - Open the file: **`sql/quick_fix_cancellation.sql`** ⬅️ USE THIS ONE FOR QUICK FIX!
   - Copy **ALL** the contents (Ctrl+A, Ctrl+C)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)
   - Wait for "Success" message

5. **Reload your app** - It should work now!

---

### 📦 COMPLETE Way (Recommended for Production)

For the full system with cancellation tracking and audit trail:

1. **Follow steps 1-2 above**

2. **Copy the Complete Migration SQL**
   - Open the file: **`sql/fix_shipment_cancellation.sql`** ⬅️ FULL IMPLEMENTATION
   - Copy **ALL** the contents

3. **Paste and Run**

4. **Verify**
   ```sql
   -- Run this to verify everything was created:
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%cancellation%';
   
   -- Should return:
   -- check_cancellation_eligibility
   -- handle_shipment_cancellation
   ```

### Which One Should I Use?

| File | What It Does | When to Use |
|------|--------------|-------------|
| **`quick_fix_cancellation.sql`** | Just the essentials to make app work | ✅ **Right now** - You just want to test |
| **`fix_shipment_cancellation.sql`** | Complete system with tracking & triggers | 📦 **For production** - Full audit trail |

**Both work perfectly!** The quick fix gets you up and running in 30 seconds.

### What This Creates

The SQL migration will create:

✅ **Updated RLS Policy**
- Allows cancellation only for pending shipments with no driver

✅ **`shipment_cancellations` Table**
- Tracks all cancellations with refund info

✅ **`handle_shipment_cancellation()` Function**
- Automatically processes cancellations and refunds

✅ **`check_cancellation_eligibility()` Function** ⬅️ This is what's missing!
- Checks if a shipment can be cancelled
- Returns refund information

### After Running Migration

1. **Reload your Expo Go app**
   - Shake device → Reload
   - Or close and reopen the app

2. **Test cancellation**
   - Create a new shipment
   - Complete payment
   - Try to cancel (should work now!)

---

## 🚨 Quick Fix (If You Need It Working NOW)

If you can't access Supabase dashboard right now, here's a temporary workaround in the mobile app:

### Option 1: Disable Eligibility Check (Temporary)

Open `mobile/src/screens/shipments/ShipmentDetailsScreen.tsx` and replace the `handleCancelShipment` function:

```typescript
async function handleCancelShipment() {
  // TEMPORARY: Skip eligibility check until SQL migration is run
  
  // Check locally if eligible
  if (shipment.status !== 'pending' || shipment.driver_id) {
    Alert.alert(
      'Cannot Cancel',
      'Can only cancel pending shipments before driver assignment. Please contact support for assistance.'
    );
    return;
  }
  
  // Show confirmation with refund info
  Alert.alert(
    'Cancel Shipment',
    `Are you sure you want to cancel this shipment?\n\n💰 Refund: $${(shipment.estimated_price || 0).toFixed(2)} (100%)\nFree cancellation - Full refund will be processed`,
    [
      {
        text: 'No, Keep Shipment',
        style: 'cancel',
      },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            // @ts-expect-error - Supabase types may be outdated
            const { error: updateError } = await supabase
              .from('shipments')
              .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
              })
              .eq('id', shipmentId);
            
            if (updateError) {
              console.error('Error cancelling shipment:', updateError);
              Alert.alert('Error', 'Failed to cancel shipment. Please try again.');
              return;
            }

            Alert.alert('Cancelled Successfully', 
              `Your shipment has been cancelled and a refund of $${(shipment.estimated_price || 0).toFixed(2)} will be processed within 5-10 business days.`,
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]
            );
          } catch (err) {
            console.error('Error cancelling shipment:', err);
            Alert.alert('Error', 'Failed to cancel shipment. Please try again.');
          }
        },
      },
    ]
  );
}
```

**But seriously, just run the SQL migration - it's the proper fix!** 😊

---

## 📋 Complete Deployment Checklist

- [ ] **1. Run SQL Migration in Supabase** ⬅️ **START HERE!**
  - Open Supabase Dashboard
  - SQL Editor → New Query
  - Paste contents of `sql/fix_shipment_cancellation.sql`
  - Click Run

- [ ] **2. Verify Functions Created**
  ```sql
  -- Check if functions exist
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name LIKE '%cancellation%';
  
  -- Should return:
  -- check_cancellation_eligibility
  -- handle_shipment_cancellation
  ```

- [ ] **3. Reload Mobile App**
  - Shake device → Reload
  - Or restart Expo Go

- [ ] **4. Test Cancellation**
  - Create shipment
  - Pay for shipment
  - Cancel (should work now!)

---

## 🆘 Still Having Issues?

### Issue: "Function not found" even after running SQL

**Solution:** The function might exist but Supabase cache needs refresh
```sql
-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';

-- Or restart Supabase (Postgres)
-- Settings → Database → Restart Database
```

### Issue: "Permission denied"

**Solution:** Check RLS policies
```sql
-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_cancellation_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_shipment_cancellation() TO authenticated;
```

### Issue: SQL migration fails

**Solution:** Check error message and verify:
1. Tables exist (shipments, payments, profiles)
2. Enums are correct (shipment_status)
3. No syntax errors in SQL file

---

## 📞 Need Help?

1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check SQL syntax: Copy SQL to https://sqlformat.org/ to validate
3. Contact support with the specific error message

---

## ✅ Bottom Line

**You MUST run the SQL migration before the mobile app will work!**

The migration creates the database functions that the mobile app depends on.

**File to run:** `sql/fix_shipment_cancellation.sql`  
**Where to run:** Supabase Dashboard → SQL Editor  
**When to run:** Right now! Before testing the app  

🎯 **Once you run it, everything will work perfectly!**
