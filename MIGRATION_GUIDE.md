# Quick Migration Guide - Switch to New Payment Flow

## ✅ Current Status

**Files Updated:**
- ✅ `backend/src/controllers/payments.controller.ts` - Backend supports optional shipmentId
- ✅ `mobile/src/services/paymentService.ts` - Service supports metadata and optional shipmentId
- ✅ `mobile/src/components/completion/InvoicePaymentStepRefactored.tsx` - New component created

**Files Using Old Component:**
- ⏳ `mobile/src/screens/ShipmentCompletionScreen.tsx` - Still importing old component

---

## 🚀 Option 1: Quick Switch (Recommended for Testing)

**Step 1:** Update the import in `ShipmentCompletionScreen.tsx`

```typescript
// BEFORE (Line 18)
import InvoicePaymentStep from '../components/completion/InvoicePaymentStep';

// AFTER
import InvoicePaymentStep from '../components/completion/InvoicePaymentStepRefactored';
```

**That's it!** The new component has the same props interface, so no other changes needed.

---

## 🧪 Option 2: A/B Testing (Run Both Versions)

**Step 1:** Import both components

```typescript
// In ShipmentCompletionScreen.tsx (around line 18)
import InvoicePaymentStepOld from '../components/completion/InvoicePaymentStep';
import InvoicePaymentStepNew from '../components/completion/InvoicePaymentStepRefactored';
```

**Step 2:** Add a feature flag or toggle

```typescript
// Add state for testing
const [useNewPaymentFlow, setUseNewPaymentFlow] = useState(true); // Set to false to use old flow

// Or use environment variable
const useNewPaymentFlow = __DEV__; // New flow in dev, old in production
```

**Step 3:** Conditionally render component

```typescript
// Around line 208 where InvoicePaymentStep is rendered
{currentStep === 4 && (
  <>
    {useNewPaymentFlow ? (
      <InvoicePaymentStepNew
        totalPrice={parseFloat(shipmentData.estimatedPrice)}
        vehicleYear={shipmentData.vehicleYear}
        vehicleMake={shipmentData.vehicleMake}
        vehicleModel={shipmentData.vehicleModel}
        vehicleVIN={shipmentData.vehicleVIN}
        pickupLocation={shipmentData.pickupLocation}
        deliveryLocation={shipmentData.deliveryLocation}
        clientName={shipmentData.clientName || 'Client'}
        clientEmail={shipmentData.clientEmail || ''}
        clientPhone={shipmentData.clientPhone || ''}
        pickupLatitude={shipmentData.pickupLatitude}
        pickupLongitude={shipmentData.pickupLongitude}
        deliveryLatitude={shipmentData.deliveryLatitude}
        deliveryLongitude={shipmentData.deliveryLongitude}
        distance={shipmentData.distance}
        clientPhotos={completionData.vehiclePhotos.map(uri => ({ uri, type: 'image/jpeg' }))}
        onComplete={handlePaymentComplete}
        stripePublishableKey={stripeConfig?.publishableKey || ''}
      />
    ) : (
      <InvoicePaymentStepOld
        // Same props as above
        totalPrice={parseFloat(shipmentData.estimatedPrice)}
        vehicleYear={shipmentData.vehicleYear}
        // ... rest of props
      />
    )}
  </>
)}
```

**Step 4:** Add toggle button for testing (optional)

```typescript
// Add this button in your UI for easy testing
<TouchableOpacity
  style={styles.debugButton}
  onPress={() => setUseNewPaymentFlow(!useNewPaymentFlow)}
>
  <Text>
    Using: {useNewPaymentFlow ? 'NEW' : 'OLD'} Flow (Tap to switch)
  </Text>
</TouchableOpacity>
```

---

## 📋 Pre-Deployment Testing Checklist

Before switching to production, test these scenarios:

### Test 1: Successful Payment
- [ ] Open shipment completion screen
- [ ] Fill in vehicle photos
- [ ] Fill in ownership docs
- [ ] Accept terms
- [ ] Enter valid test card: `4242 4242 4242 4242`
- [ ] Click "Pay $XXX Now"
- [ ] ✅ Payment succeeds
- [ ] ✅ Shipment created with status='paid'
- [ ] ✅ Photos uploaded
- [ ] ✅ No orphaned records in database

### Test 2: Failed Payment
- [ ] Repeat above steps
- [ ] Enter declined card: `4000 0000 0000 0002`
- [ ] Click "Pay $XXX Now"
- [ ] ✅ Error message shown: "Your card was declined..."
- [ ] ✅ No shipment created
- [ ] ✅ No photos uploaded
- [ ] ✅ Can retry with different card

### Test 3: Network Failure
- [ ] Fill in all details
- [ ] Turn off WiFi/Data
- [ ] Click "Pay $XXX Now"
- [ ] ✅ Network error shown
- [ ] Turn on network
- [ ] ✅ Can retry successfully

### Test 4: App Closure
- [ ] Fill in all details
- [ ] Click "Pay $XXX Now"
- [ ] Close app immediately
- [ ] Reopen app
- [ ] ✅ No orphaned shipment
- [ ] ✅ Can start new shipment

---

## 🗄️ Database Verification Queries

**After Test 1 (Successful Payment):**
```sql
-- Should see 1 shipment with status='paid'
SELECT * FROM shipments 
WHERE status = 'paid' 
ORDER BY created_at DESC 
LIMIT 1;

-- Should see payment record linked to shipment
SELECT * FROM payments 
WHERE shipment_id = (SELECT id FROM shipments ORDER BY created_at DESC LIMIT 1);

-- Should see photos linked to shipment
SELECT COUNT(*) FROM shipment_photos 
WHERE shipment_id = (SELECT id FROM shipments ORDER BY created_at DESC LIMIT 1);
```

**After Test 2 (Failed Payment):**
```sql
-- Should be ZERO orphaned pending shipments
SELECT COUNT(*) FROM shipments 
WHERE status = 'pending' 
  AND created_at > NOW() - INTERVAL '5 minutes';
  
-- Should be 0 with new flow!
```

---

## 🔄 Rollback Plan (If Issues Found)

**Quick Rollback:**
```typescript
// Just change the import back
import InvoicePaymentStep from '../components/completion/InvoicePaymentStep';
```

**Or set feature flag to false:**
```typescript
const useNewPaymentFlow = false;
```

**No backend changes needed** - backend supports both flows!

---

## 📊 Monitoring After Deployment

**Check these metrics for first 24 hours:**

1. **Orphaned Shipments** (should be 0):
```sql
SELECT COUNT(*) FROM shipments 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '1 hour';
```

2. **Payment Success Rate** (should stay same or improve):
```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'paid') * 100.0 / COUNT(*) as success_rate
FROM shipments 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

3. **Sentry Errors** (check for new payment-related errors):
- Search: `event.tags.flow:payment_*`
- Alert if error rate > 5%

4. **User Feedback** (monitor support tickets):
- Search for keywords: "payment", "card", "failed", "stuck"

---

## ✅ Final Steps

**Before Going Live:**
- [ ] Test all scenarios in development
- [ ] Verify database queries show no orphans
- [ ] Check Sentry captures errors correctly
- [ ] Test with real Stripe test cards
- [ ] Verify email notifications sent

**Deploy to Production:**
- [ ] Merge backend changes (already backward compatible)
- [ ] Deploy mobile app with new component
- [ ] Monitor metrics for 24 hours
- [ ] If all good, remove old component after 2 weeks

**After 2 Weeks (If All Good):**
- [ ] Delete `InvoicePaymentStep.tsx` (old component)
- [ ] Delete `InvoicePaymentStep.tsx.backup`
- [ ] Update documentation
- [ ] Celebrate! 🎉

---

## 🆘 Troubleshooting

**Issue:** "Payment intent created but confirmation fails"
```typescript
// Solution: Safe to retry with same client secret
await confirmPayment(existingClientSecret);
```

**Issue:** "Shipment not created after payment"
```typescript
// Check Sentry for error details
// Manually create shipment and link to payment intent
```

**Issue:** "Photos not uploading"
```typescript
// Non-critical - can be re-uploaded
// Check storage permissions
```

**Issue:** "User stuck on loading screen"
```typescript
// Add timeout to payment confirmation
const timeout = setTimeout(() => {
  setError('Payment is taking longer than expected. Please try again.');
  setProcessing(false);
}, 30000); // 30 seconds
```

---

## 📞 Need Help?

1. Check `PAYMENT_IMPLEMENTATION_COMPLETE.md` for detailed implementation guide
2. Check `PAYMENT_INTEGRATION_ANALYSIS.md` for original analysis
3. Check Sentry dashboard for real-time errors
4. Check backend logs on Railway/Vercel
5. Check Stripe dashboard for payment details

---

**Remember**: The new component is **100% compatible** with the old interface. Just change the import and test!
