# 🧪 Quick Payment Testing Guide

## What Was Changed

✅ **Removed manual override button** - No more debug bypass
✅ **Production-ready Stripe integration** - Real card processing only
✅ **All errors fixed** - Code compiles without errors

## How to Test Now

### 1. Start the Mobile App

```powershell
cd mobile
npx expo start
```

### 2. Test Payment Flow

1. **Create a new shipment** in the app
2. **Navigate to payment screen**
3. **Enter card details:**
   - Card: `4242 4242 4242 4242` (Stripe test card)
   - Expiry: `12/30` (any future date)
   - CVC: `123` (any 3 digits)
   - ZIP: `75202` (any 5 digits)

4. **Verify button behavior:**
   - ✅ Button should be **disabled** until all card fields are valid
   - ✅ Button should **enable automatically** when card is complete
   - ❌ **No manual override button** should appear

5. **Click "Pay $XX.XX Now"**
   - ✅ Processing indicator appears
   - ✅ Payment processes with Stripe
   - ✅ Success alert appears
   - ✅ Shipment is created

### 3. Verify Payment in Database

```sql
-- Check latest shipment
SELECT id, status, payment_status, created_at
FROM shipments
ORDER BY created_at DESC
LIMIT 1;

-- Should show:
-- status: 'pending'
-- payment_status: 'paid' (after webhook processes)
```

## Test Cards

### ✅ Successful Payment
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
Result: Payment succeeds
```

### ❌ Declined Payment
```
Card: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3 digits
Result: Payment declined with error message
```

### ❌ Insufficient Funds
```
Card: 4000 0000 0000 9995
Result: "Insufficient funds" error
```

## What Should Happen

### ✅ Successful Payment Flow

1. **Card validation:**
   - CardField validates as you type
   - Pay button enables when card is complete
   
2. **Payment processing:**
   - "Processing..." indicator appears
   - Shipment created in database (status: pending)
   - Payment intent created via backend
   - Stripe processes payment client-side
   - Webhook updates shipment status to 'paid'
   
3. **Success confirmation:**
   - Alert: "Payment Successful!"
   - Shows amount charged: $XX.XX (20% of quote)
   - Shows remaining: $XX.XX (80% due on delivery)

### ❌ Failed Payment Flow

1. **Invalid card:**
   - Pay button stays disabled
   - Must enter valid card number
   
2. **Declined card:**
   - Error message appears
   - User can try different card
   - Shipment stays in pending state

## Console Logs to Watch

```
✅ Good logs:
InvoicePaymentStep mounted
Quote price from shipmentData: XXXX cents
Creating pending shipment...
Pending shipment created: <UUID>
Creating payment intent for quote price: XXX
Payment intent created: <INTENT_ID>
Confirming payment with Stripe...
Payment confirmed successfully! <INTENT_ID>
Shipment payment status will be updated automatically by webhook

❌ Error logs to investigate:
Payment confirmation error: <ERROR>
Payment failed: <REASON>
```

## Common Issues & Fixes

### Issue: Button stays disabled even with valid card

**Check:**
1. All card fields filled (number, expiry, CVC)
2. Card number is valid (use `4242 4242 4242 4242`)
3. Expiry is in future
4. CVC is 3 digits

**Fix:**
- Try clearing fields and re-entering
- Check console for CardField validation logs

### Issue: Payment fails immediately

**Check:**
1. Backend server is running
2. STRIPE_SECRET_KEY is set in backend .env
3. EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is set in mobile

**Fix:**
```powershell
# Check backend
cd backend
npm run dev

# Check mobile env
cd mobile
# Verify app.config.js has stripePublishableKey
```

### Issue: Payment succeeds but shipment stays "pending"

**Check:**
1. Webhook configured in Stripe Dashboard
2. Webhook secret matches backend .env
3. Backend logs show webhook received

**Fix:**
- Check Stripe Dashboard → Webhooks → View events
- Verify webhook URL is correct
- Check backend logs for webhook processing

## Production Testing

⚠️ **Before going live:**

1. **Switch to production Stripe keys:**
   ```bash
   # Backend .env
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   
   # Mobile app.config.js
   stripePublishableKey: 'pk_live_xxxxx'
   ```

2. **Test with real card (small amount):**
   - Use your own card
   - Process a $1-5 payment
   - Verify it appears in Stripe Dashboard
   - Confirm webhook updates shipment

3. **Monitor for 24 hours:**
   - Check payment success rate
   - Verify webhook delivery
   - Look for any errors in logs

## Need Help?

1. **Check comprehensive guide:** `PRODUCTION_PAYMENT_IMPLEMENTATION.md`
2. **View backend logs:** Look for payment-related errors
3. **Check Stripe Dashboard:** View payment attempts and webhook deliveries
4. **Console logs:** Mobile app shows detailed payment flow logs

---

**Status:** ✅ Ready to test
**Last Updated:** $(date)
