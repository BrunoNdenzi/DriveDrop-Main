# Fix Accept Shipment Function - Quick Guide

## Problem
The `accept_shipment()` database function only accepts shipments with `status = 'pending'`, but admin-assigned shipments have `status = 'assigned'`.

**Error:** `Shipment not found or already accepted`

---

## Solution: Run SQL Migration

### Option 1: Supabase Dashboard (RECOMMENDED - 2 minutes)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg/sql/new
   - Or: Dashboard → SQL Editor → New Query

2. **Copy this SQL:**

```sql
-- Fix accept_shipment function to handle 'assigned' status
DROP FUNCTION IF EXISTS accept_shipment(UUID);

CREATE OR REPLACE FUNCTION accept_shipment(shipment_id UUID)
RETURNS SETOF shipments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_shipment record;
BEGIN
    -- Get the driver ID from the current user
    SELECT id INTO v_driver_id FROM profiles 
    WHERE id = auth.uid() AND role = 'driver';
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION 'Only drivers can accept shipments';
    END IF;
    
    -- Update the shipment
    -- Accept both 'pending' (driver self-assigns) and 'assigned' (admin assigned) statuses
    UPDATE shipments
    SET 
        driver_id = v_driver_id,
        status = 'accepted',
        updated_at = NOW()
    WHERE 
        id = shipment_id
        AND status IN ('pending', 'assigned')  -- Accept both statuses
        AND (
            driver_id IS NULL               -- Pending shipment (no driver yet)
            OR driver_id = v_driver_id      -- Assigned shipment (must be assigned to this driver)
        )
    RETURNING * INTO v_shipment;
    
    IF v_shipment IS NULL THEN
        RAISE EXCEPTION 'Shipment not found, already accepted, or not assigned to you';
    END IF;
    
    -- Create tracking event
    INSERT INTO tracking_events (
        shipment_id,
        event_type,
        created_by,
        notes
    ) VALUES (
        shipment_id,
        'accepted',
        v_driver_id,
        'Shipment accepted by driver'
    );
    
    RETURN QUERY SELECT * FROM shipments WHERE id = shipment_id;
END;
$$;
```

3. **Click "Run" or press Ctrl+Enter**

4. **Verify Success:**
   - You should see: `Success. No rows returned`
   - Function is now updated!

---

### Option 2: Command Line with psql (Alternative)

If you have `psql` installed:

```powershell
# Navigate to migrations folder
cd F:\DD\DriveDrop-Main\supabase\migrations

# Run the migration (replace with your connection string)
psql "postgresql://postgres:[YOUR-PASSWORD]@db.tgdewxxmfmbvvcelngeg.supabase.co:5432/postgres" -f fix_accept_shipment_function.sql
```

---

## What Changed?

### Before:
```sql
WHERE 
    id = shipment_id
    AND status = 'pending'        ← Only pending!
    AND driver_id IS NULL         ← Driver must be null
```

### After:
```sql
WHERE 
    id = shipment_id
    AND status IN ('pending', 'assigned')  ← Both statuses!
    AND (
        driver_id IS NULL               ← Pending: no driver yet
        OR driver_id = v_driver_id      ← Assigned: must be this driver
    )
```

---

## Test After Running

1. **Create a new shipment** (client side)
2. **Assign it to a driver** (admin side) → Status: `assigned`
3. **Driver taps "Accept Job"** → Should work now! ✅
4. **Verify:** Status changes to `accepted`, "Start Trip" button appears

---

## Verification Query

After running the migration, verify the function exists:

```sql
-- Check if function exists and view its definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'accept_shipment'
AND n.nspname = 'public';
```

You should see the updated function with `status IN ('pending', 'assigned')`.

---

## Files Created

1. ✅ `supabase/migrations/fix_accept_shipment_function.sql` - The migration SQL
2. ✅ `scripts/run_accept_shipment_fix.ts` - Automated script (optional)
3. ✅ This guide!

---

## Status

- **Migration File:** ✅ Created
- **Database Update:** ⏳ **← YOU NEED TO DO THIS**
- **Testing:** ⏳ After database update

---

## Summary

The function now handles **two scenarios**:

1. **Self-Assignment (pending):**
   - Driver finds a pending shipment
   - Taps "Accept Job"
   - Function sets driver_id and status to 'accepted'

2. **Admin Assignment (assigned):**
   - Admin assigns shipment to driver
   - Shipment has status='assigned' and driver_id set
   - Driver taps "Accept Job"
   - Function verifies driver matches and changes status to 'accepted'

Both flows now work! 🎉
