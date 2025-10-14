# Shipment Cancellation - Quick Start Guide

## ⚠️ CRITICAL: Run SQL Migration FIRST!

**If you see this error:**
```
ERROR: Could not find the function public.check_cancellation_eligibility
```

**You MUST run the SQL migration first!** See detailed instructions in `RUN_THIS_FIRST.md`

---

## 🎯 What Was Implemented

Complete shipment cancellation system with automatic refund handling.

## 📋 Files Created/Modified

### New Files
1. **`sql/fix_shipment_cancellation.sql`** - Complete database migration
   - Updates RLS policy for cancellation
   - Creates `shipment_cancellations` tracking table
   - Adds automatic refund handling trigger
   - Adds eligibility check function

2. **`SHIPMENT_CANCELLATION_SYSTEM.md`** - Full technical documentation

### Modified Files
1. **`mobile/src/screens/shipments/ShipmentDetailsScreen.tsx`**
   - Enhanced `handleCancelShipment()` function
   - Added eligibility checking before cancellation
   - Shows refund information to users
   - Improved error handling and user feedback

## 🚀 Deployment Steps

### Step 1: Run SQL Migration in Supabase

```sql
-- Go to Supabase Dashboard > SQL Editor
-- Paste and run the contents of: sql/fix_shipment_cancellation.sql
```

**What this does:**
- ✅ Updates RLS policy to allow cancellation **ONLY** from pending (no driver)
- ✅ Creates shipment_cancellations table for tracking
- ✅ Adds automatic refund calculation trigger (100% for pending only)
- ✅ Adds function to check cancellation eligibility
- ✅ Blocks cancellation once driver is assigned

### Step 2: Reload Expo Go App

```bash
# The mobile app changes are already in place
# Just reload your Expo Go app
```

### Step 3: Test the Flow

1. **Create a shipment** and complete payment
2. **Tap "Cancel Shipment"** button on shipment details
3. **Verify** you see refund information in the dialog
4. **Confirm cancellation** and verify success message
5. **Check** shipment list shows "Cancelled" status

## 💡 How It Works

### User Flow
```
1. User opens shipment details (pending, no driver)
   ↓
2. Taps "Cancel Shipment" button
   ↓
3. System checks if cancellation is allowed
   ↓
4. Shows dialog with refund information:
   "💰 Refund: $15.00 (100%)"
   ↓
5. User confirms
   ↓
6. Shipment cancelled, refund triggered
   ↓
7. Success message: "Refund will be processed in 5-10 days"
```

**If driver is assigned:**
```
1. User opens shipment details (driver assigned)
   ↓
2. System checks eligibility
   ↓
3. Shows message:
   "Cannot cancel after driver assignment. 
    Please contact support for assistance."
   ↓
4. No cancellation allowed
```

### Refund Policy
| Status | Driver Assigned? | Can Cancel? | Refund |
|--------|------------------|-------------|--------|
| Pending | ❌ No | ✅ Yes | 100% |
| Pending | ✅ Yes | ❌ No | Contact Support |
| Accepted | ✅ Yes | ❌ No | Contact Support |
| Assigned | ✅ Yes | ❌ No | Contact Support |
| In Transit | ✅ Yes | ❌ No | Contact Support |
| Picked Up | ✅ Yes | ❌ No | Contact Support |
| Delivered | ✅ Yes | ❌ No | Contact Support |

**Simple Rule:** Only pending shipments **before** driver assignment can be cancelled with automatic refund.

## 🔒 Security Features

- **RLS Protection:** Only the client who created the shipment can cancel it
- **Status Validation:** Cannot cancel shipments that are in-transit or delivered
- **Audit Trail:** All cancellations logged with user ID and timestamp
- **Refund Tracking:** Complete record of refund status and amounts

## 🧪 Testing Checklist

### Database Tests (After Migration)
```sql
-- 1. Verify policy exists
SELECT * FROM pg_policies 
WHERE policyname = 'Clients can update their own shipments';

-- 2. Verify table created
SELECT * FROM shipment_cancellations LIMIT 1;

-- 3. Test eligibility function
SELECT check_cancellation_eligibility('<your-shipment-id>');

-- 4. Test cancellation (replace with actual shipment ID)
UPDATE shipments 
SET status = 'cancelled' 
WHERE id = '<pending-shipment-id>' 
  AND client_id = auth.uid();

-- 5. Verify cancellation record
SELECT * FROM shipment_cancellations 
WHERE shipment_id = '<cancelled-shipment-id>';
```

### Mobile App Tests
- [ ] Create and pay for shipment (pending, no driver)
- [ ] Cancel immediately (should show 100% refund)
- [ ] Verify success message
- [ ] Check shipment shows as cancelled
- [ ] Have driver accept shipment
- [ ] Try to cancel (should show "contact support" message)
- [ ] Verify error messages are clear
- [ ] Verify "Cancel Shipment" button hidden once driver assigned

## 📊 Monitoring

### Check Cancellation Activity
```sql
-- Recent cancellations
SELECT 
  sc.*,
  s.title as shipment_title,
  s.estimated_price,
  p.email as cancelled_by_email
FROM shipment_cancellations sc
JOIN shipments s ON sc.shipment_id = s.id
JOIN profiles p ON sc.cancelled_by = p.id
ORDER BY sc.cancelled_at DESC
LIMIT 20;

-- Refund summary
SELECT 
  refund_status,
  COUNT(*) as count,
  SUM(refund_amount) / 100 as total_refund_dollars
FROM shipment_cancellations
GROUP BY refund_status;
```

## ⚠️ Important Notes

1. **Run SQL migration FIRST** - Mobile app depends on these database changes
2. **Refund Deadline** - Currently set to 1 hour after payment (configurable)
3. **Actual Refunds** - Trigger marks as 'refunded' in DB, actual Stripe processing can be added later
4. **TypeScript Warnings** - Suppressed with `@ts-expect-error` due to outdated type definitions

## 🆘 Troubleshooting

### "Failed to check cancellation eligibility"
**Fix:** Make sure SQL migration ran successfully. Check Supabase logs.

### "Failed to cancel shipment" 
**Fix:** Check shipment status and driver assignment. Can only cancel pending shipments with no driver assigned.

### Button not showing
**Fix:** Button only shows for pending shipments with no driver assigned.

### "Cannot cancel after driver assignment"
**Fix:** This is by design. Once a driver is assigned, cancellations must go through support to protect driver commitments.

## 📞 Support

- **Full Documentation:** See `SHIPMENT_CANCELLATION_SYSTEM.md`
- **SQL Migration:** See `sql/fix_shipment_cancellation.sql`
- **Mobile Code:** See `mobile/src/screens/shipments/ShipmentDetailsScreen.tsx`

---

## ✅ Ready to Deploy!

Once you run the SQL migration in Supabase, the complete cancellation system will be live! 🎉
