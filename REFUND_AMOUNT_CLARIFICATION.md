# 💰 Refund Amount Clarification - 20% Deposit Only

## Payment Structure

### How Payments Work in DriveDrop

**Upfront (When Creating Shipment):**
- Client pays **20% deposit** of quoted price
- Example: Quote is $100 → Client pays $20 upfront
- This is stored in `payments` table as `amount`

**On Delivery:**
- Client pays remaining **80%**
- Example: Quote is $100 → Client pays $80 on delivery
- Total: $100 (20% + 80%)

---

## Refund Policy

### When Shipment is Cancelled (Pending, No Driver)

**What Gets Refunded:**
- ✅ **100% of the 20% deposit**
- ❌ NOT the full quote price
- ❌ NOT 80% (that wasn't charged yet)

**Example:**
```
Quote Price: $100
Upfront Payment (20%): $20  ← This is what's in payments.amount
On Delivery (80%): $80  ← This is NOT charged yet

If cancelled:
Refund Amount: $20 (100% of deposit)
Message: "Full deposit refund will be processed"
```

---

## How It Works in the Code

### Database (Already Correct! ✅)

The `payments` table stores only the 20% deposit:

```sql
-- When payment is created
INSERT INTO payments (
  shipment_id,
  amount,  -- This is 20% of quote, e.g., $20 for $100 quote
  ...
)

-- When cancelling, refund the deposit
v_refund_amount := v_payment_record.amount;  -- ✅ This is $20, not $100
```

### Eligibility Check Function (Already Correct! ✅)

```sql
-- Returns the deposit amount for refund
'refund_amount', COALESCE(v_payment.amount, 0)  -- ✅ This is $20, not $100
'message', 'Free cancellation - Full deposit refund will be processed'
```

### Mobile App Display (Already Correct! ✅)

```typescript
// Shows the actual deposit amount
const refundInfo = eligibility.refund_eligible
  ? `💰 Refund: $${((eligibility.refund_amount || 0) / 100).toFixed(2)} (100%)`
  : '⚠️ No refund available';

// Example display: "💰 Refund: $20.00 (100%)"
```

---

## Why "100%" is Correct

When we say "100% refund", we mean:
- ✅ 100% of what the client **actually paid** (the 20% deposit)
- ❌ NOT 100% of the quote price

**User sees:**
```
Cancel Shipment

Are you sure you want to cancel this shipment?

💰 Refund: $20.00 (100%)
Free cancellation - Full deposit refund will be processed

[No, Keep Shipment] [Yes, Cancel]
```

**This is correct because:**
- They paid $20 (20% of $100 quote)
- They're getting back $20 (100% of what they paid)
- They never paid the other $80 (that's on delivery)

---

## Example Scenarios

### Scenario 1: $50 Quote
```
Quote: $50
Upfront (20%): $10  ← Charged at shipment creation
On Delivery (80%): $40  ← NOT charged yet

Cancel before driver:
✅ Refund: $10 (100% of deposit)
❌ NOT $50 (that would be refunding money never paid!)
```

### Scenario 2: $200 Quote
```
Quote: $200
Upfront (20%): $40  ← Charged at shipment creation
On Delivery (80%): $160  ← NOT charged yet

Cancel before driver:
✅ Refund: $40 (100% of deposit)
❌ NOT $200
```

### Scenario 3: $15 Quote (Your Example)
```
Quote: $15
Upfront (20%): $3.00  ← Charged at shipment creation
On Delivery (80%): $12.00  ← NOT charged yet

Cancel before driver:
✅ Refund: $3.00 (100% of deposit)
Display: "💰 Refund: $3.00 (100%)"
```

---

## Verification Checklist

Let me verify each part is correct:

### ✅ SQL Functions (Both files updated)
- [x] Comments clarify that `payment.amount` is 20% deposit
- [x] Refund amount uses `payment.amount` (the deposit)
- [x] Message says "Full deposit refund" (not "full refund")

### ✅ Mobile App
- [x] Displays `eligibility.refund_amount` (the deposit)
- [x] Shows "100%" (meaning 100% of deposit paid)
- [x] Success message clear about deposit refund

### ✅ Database Schema
- [x] `payments.amount` stores the 20% deposit
- [x] No changes needed - already correct

---

## Summary

### ✅ Already Working Correctly!

The system **already** works correctly because:

1. **Payments table** only stores the 20% deposit (not full quote)
2. **Refund logic** uses `payment.amount` (the deposit)
3. **Mobile app** displays the actual deposit amount

### What Was Updated

Just added **clarifying comments** in the SQL to make it explicit:
- "payment.amount is the 20% deposit charged upfront"
- "Full deposit refund" instead of "Full refund"

### No Code Changes Needed!

The actual logic was already correct. The `payment.amount` field already contains just the 20% deposit, so when we refund `payment.amount`, we're refunding the correct amount (the deposit), not the full quote price.

---

## Testing

When you test cancellation:

**Expected behavior:**
```
1. Create shipment with $100 quote
2. Pay $20 upfront (20% deposit)
3. Cancel shipment
4. See: "💰 Refund: $20.00 (100%)"
5. Refund of $20 processed
```

**NOT:**
```
❌ See: "💰 Refund: $100.00 (100%)"  ← WRONG!
```

If you're seeing the full quote amount in the refund message, that would indicate a problem with how the payment is being created (it should only charge 20%, not 100%).

---

## 🎯 Bottom Line

**The refund system is already correct!** ✅

When a user cancels:
- They get back what they paid (the 20% deposit)
- The message correctly says "100%" (of what they paid)
- The amount shown is the deposit, not the full quote

**Updated files with clarifying comments:**
- ✅ `sql/quick_fix_cancellation.sql`
- ✅ `sql/fix_shipment_cancellation.sql`

**No changes needed to:**
- ✅ Mobile app (already correct)
- ✅ Database schema (already correct)
- ✅ Payment creation (already charges 20%)

🎉 **You're all set!**
