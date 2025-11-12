# Payment Status Display Fix

## Issue
All transactions in the client payment history page were showing "initial" instead of their actual completion status (pending, completed, failed, etc.).

## Root Cause
**Database Schema vs Frontend Mismatch:**

The database uses:
- Column: `status` (enum: 'pending', 'processing', 'completed', 'failed', 'refunded')
- Column: `payment_type` (values: 'initial', 'upfront', 'final', 'full')

The frontend was querying for:
- `payment_status` ❌ (doesn't exist)
- `stripe_payment_intent_id` ❌ (should be `payment_intent_id`)

This caused all queries to return `undefined` for status, making everything appear as "initial" (which is actually the `payment_type` value).

## Changes Made

### File: `website/src/app/dashboard/client/payments/page.tsx`

#### 1. Updated TypeScript Interface
```typescript
// BEFORE
interface Payment {
  payment_status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
  stripe_payment_intent_id: string | null
  payment_type: 'upfront' | 'final' | 'full'
}

// AFTER
interface Payment {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  payment_intent_id: string | null
  payment_type: 'upfront' | 'final' | 'full' | 'initial'
}
```

#### 2. Updated Status Filtering
```typescript
// BEFORE
const succeededPayments = paymentsData?.filter(p => p.payment_status === 'succeeded')
if (filterStatus !== 'all') {
  filtered = filtered.filter(p => p.payment_status === filterStatus)
}

// AFTER
const succeededPayments = paymentsData?.filter(p => p.status === 'completed')
if (filterStatus !== 'all') {
  filtered = filtered.filter(p => p.status === filterStatus)
}
```

#### 3. Updated Status Display Functions
```typescript
// Changed from 'succeeded' to 'completed' to match database enum
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': // was 'succeeded'
      return 'bg-green-100 text-green-800'
    // ... rest
  }
}
```

#### 4. Updated Type Label Function
```typescript
const getTypeLabel = (type: string) => {
  switch (type) {
    case 'upfront':
    case 'initial': // ADDED - handle both values
      return 'Initial Payment (20%)'
    case 'final':
      return 'Final Payment (80%)'
    case 'full':
      return 'Full Payment'
  }
}
```

#### 5. Updated UI References
```typescript
// BEFORE
{getStatusIcon(payment.payment_status)}
{payment.stripe_payment_intent_id}

// AFTER
{getStatusIcon(payment.status)}
{payment.payment_intent_id}
```

#### 6. Updated Filter Options
```typescript
// BEFORE
<option value="succeeded">Succeeded</option>

// AFTER
<option value="completed">Completed</option>
<option value="initial">Initial Payment (20%)</option>
```

## Database Schema Reference

```sql
-- payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  status payment_status NOT NULL DEFAULT 'pending',  -- ✅ This is the column
  payment_type VARCHAR(20) DEFAULT 'initial',        -- Payment type, not status
  payment_intent_id TEXT,                            -- ✅ Stripe payment intent ID
  amount NUMERIC NOT NULL,
  -- ... other columns
);

-- payment_status enum
CREATE TYPE payment_status AS ENUM (
  'pending',      -- Payment initiated
  'processing',   -- Payment being processed
  'completed',    -- Payment successful ✅
  'failed',       -- Payment failed
  'refunded'      -- Payment refunded
);
```

## Backend Verification

The backend correctly uses the `status` column:

```typescript
// stripe.service.ts - Payment succeeded webhook
await supabase
  .from('payments')
  .update({
    status: 'completed',  // ✅ Correct
    payment_intent_id: paymentIntent.id,
  })
  .eq('shipment_id', shipmentId)
```

## Result

✅ **Fixed!** The payment history page now correctly displays:
- Payment status (pending, completed, failed, refunded)
- Payment type (Initial 20%, Final 80%, Full)
- Proper status colors and icons
- Accurate filtering by status

## Testing

To verify the fix:
1. Go to `/dashboard/client/payments`
2. Check that completed payments show "completed" badge (green)
3. Check that pending payments show "pending" badge (orange)
4. Verify status filter dropdown works correctly
5. Verify payment intent IDs display correctly

## Notes

- No database changes needed (schema was correct)
- Backend was already correct (used `status` column)
- Only frontend needed fixing (used wrong column names)
- The word "initial" that was showing was from `payment_type`, not `status`
