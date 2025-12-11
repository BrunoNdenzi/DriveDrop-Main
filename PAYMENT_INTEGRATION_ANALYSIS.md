# Payment Integration Analysis: Website vs Mobile

## Summary
The website and mobile app both use Stripe for payments, but there are some key differences in implementation that need to be aligned.

---

## Current Website Implementation

### Payment Flow
1. **Two-Phase Payment (20%/80% Split)**
   - 20% charged immediately on booking
   - 80% held and captured on delivery
   - Uses `capture_method: 'manual'` in Stripe

2. **Payment Intent Creation** (`/api/stripe/create-payment-intent`)
   ```typescript
   // Creates payment intent for FULL amount with manual capture
   const paymentIntent = await stripe.paymentIntents.create({
     amount: totalAmount, // 100% authorized (held)
     capture_method: 'manual', // Manual capture for phased payments
     metadata: {
       upfrontAmount: amount.toString(), // 20%
       remainingAmount: remainingAmount.toString(), // 80%
       shipmentId: // Added later
     }
   });
   ```

3. **Payment Confirmation** (Frontend - `PaymentStep.tsx`)
   ```typescript
   // Stripe Elements UI with PaymentElement
   const { error, paymentIntent } = await stripe.confirmPayment({
     elements,
     confirmParams: {
       return_url: `${window.location.origin}/dashboard/client`,
     },
     redirect: 'if_required',
   });
   ```

4. **Shipment Creation**
   - Shipment created AFTER payment confirmation
   - Initial status: `'pending'`
   - Payment status: `'processing'`

5. **Database Records**
   - Payment record created with:
     - `amount`: Total amount (100%)
     - `initial_amount`: Upfront amount (20%)
     - `remaining_amount`: Delivery amount (80%)
     - `status`: 'pending' → 'completed' (via webhook)
     - `payment_intent_id`: Stripe PI ID

6. **Webhook Handling**
   - `payment_intent.succeeded` event updates:
     - Payment status → 'completed'
     - Shipment payment_status → 'paid'
     - Sends welcome/booking email

---

## Current Mobile Implementation

### Payment Flow
1. **Same Two-Phase Payment (20%/80%)**
   - 20% charged immediately
   - 80% held for delivery
   - Uses backend API endpoint

2. **Payment Intent Creation** (Backend API)
   ```typescript
   // Mobile calls: POST /api/v1/payments/intent
   const response = await paymentService.createPaymentIntent(
     shipmentId,
     quotePriceDollars, // Full price in dollars
     description
   );
   ```

3. **Payment Confirmation** (Mobile - `InvoicePaymentStep.tsx`)
   ```typescript
   // Stripe React Native with CardField
   const { error, paymentIntent } = await confirmPayment(
     clientSecret,
     {
       paymentMethodType: 'Card',
     }
   );
   ```

4. **Shipment Creation**
   - Shipment created BEFORE payment
   - Initial status: `'pending'`
   - Updated to `'paid'` by webhook after payment

5. **Key Difference**
   - Mobile creates shipment FIRST (to get shipmentId for payment intent)
   - Website creates payment intent FIRST, shipment AFTER

---

## Issues & Gaps

### 1. **Payment Flow Order**
- **Website**: PaymentIntent → Shipment → Update Payment
- **Mobile**: Shipment → PaymentIntent → Confirm Payment
- **Impact**: Mobile shipments exist in 'pending' state before payment, could have orphaned records if payment fails

### 2. **Stripe Elements vs CardField**
- **Website**: Uses `@stripe/react-stripe-js` with `PaymentElement` (supports multiple payment methods)
- **Mobile**: Uses `@stripe/stripe-react-native` with `CardField` (cards only)
- **Gap**: Mobile doesn't support Apple Pay, Google Pay, or other payment methods

### 3. **Payment Metadata**
- **Website**: Rich metadata including vehicle, route, customer info
- **Mobile**: Basic metadata
- **Gap**: Less data for analytics and customer support

### 4. **Email Notifications**
- **Website**: Triggers email via `/payments/notify-payment-success` endpoint
- **Mobile**: Relies only on webhook
- **Gap**: Mobile might miss emails if webhook fails

### 5. **Photo Upload**
- **Website**: Photos uploaded with shipment creation
- **Mobile**: Photos uploaded BEFORE payment, then shipment created
- **Issue**: If payment fails, photos are already in storage (wasted resources)

### 6. **Error Handling**
- **Website**: Comprehensive error messages with user-friendly translations
- **Mobile**: Basic error handling
- **Gap**: Less helpful error messages for users

---

## Recommendations

### High Priority Fixes

#### 1. **Align Payment Flow Order**
**Current Mobile**:
```
Shipment (pending) → Payment Intent → Confirm → Webhook updates shipment
```

**Recommended (Match Website)**:
```
Payment Intent → Confirm → Shipment (paid) → Webhook completes
```

**Benefits**:
- No orphaned pending shipments
- Cleaner database
- Consistent with website

#### 2. **Upgrade to Stripe Payment Sheet (Mobile)**
Replace `CardField` with Payment Sheet for:
- Apple Pay support
- Google Pay support
- Card autofill
- Better UX
- Multiple payment methods

**Implementation**:
```typescript
import { usePaymentSheet } from '@stripe/stripe-react-native';

const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

// Initialize
await initPaymentSheet({
  paymentIntentClientSecret: clientSecret,
  merchantDisplayName: 'DriveDrop',
  applePay: { merchantCountryCode: 'US' },
  googlePay: { merchantCountryCode: 'US', testEnv: true }
});

// Present
const { error } = await presentPaymentSheet();
```

#### 3. **Add Email Trigger After Payment**
Match website by calling email notification endpoint:
```typescript
await fetch(`${apiUrl}/payments/notify-payment-success`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ 
    paymentIntentId,
    shipmentId 
  })
});
```

#### 4. **Improve Error Messages**
Map Stripe error codes to user-friendly messages:
```typescript
const errorMessages = {
  card_declined: 'Your card was declined. Please try a different card.',
  insufficient_funds: 'Insufficient funds. Please use a different card.',
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: 'Incorrect security code. Please check your CVC.',
  // ... more mappings
};
```

### Medium Priority Enhancements

#### 5. **Add Payment Summary UI**
Match website's payment breakdown UI:
- Authorization hold explanation
- Step-by-step payment process
- Security badges
- Clear 20%/80% breakdown

#### 6. **Add Metadata to Payment Intent**
Include vehicle, route, customer info:
```typescript
metadata: {
  vehicle: `${year} ${make} ${model}`,
  pickupLocation: `${pickupCity}, ${pickupState}`,
  deliveryLocation: `${deliveryCity}, ${deliveryState}`,
  distance: `${distance} miles`,
  clientName,
  clientEmail,
  clientPhone
}
```

### Low Priority

#### 7. **Optimize Photo Upload**
Upload photos AFTER successful payment to avoid waste

#### 8. **Add Loading States**
Match website's loading/processing states:
- Initializing payment...
- Processing payment...
- Creating shipment...
- Success animation

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
✅ Task 1: Reorder payment flow (Payment Intent → Confirm → Shipment)
✅ Task 2: Add email notification trigger
✅ Task 3: Improve error handling/messages

### Phase 2: UX Improvements (Week 2)
⏳ Task 4: Upgrade to Payment Sheet (Apple/Google Pay)
⏳ Task 5: Add payment summary UI matching website
⏳ Task 6: Add metadata to payment intents

### Phase 3: Optimization (Week 3)
⏳ Task 7: Optimize photo upload timing
⏳ Task 8: Add loading animations/states
⏳ Task 9: Add analytics tracking

---

## Code Examples

### Updated Mobile Payment Flow

```typescript
const handlePayment = async () => {
  setIsProcessing(true);
  
  try {
    // STEP 1: Create Payment Intent (NO shipment yet)
    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      quotePriceDollars,
      metadata
    );
    
    // STEP 2: Confirm Payment with Stripe
    const { error } = await presentPaymentSheet();
    
    if (error) {
      throw new Error(translateStripeError(error.code));
    }
    
    // STEP 3: Create Shipment (after successful payment)
    const shipmentId = await createShipment({
      ...shipmentData,
      paymentIntentId,
      paymentStatus: 'paid'
    });
    
    // STEP 4: Upload Photos
    await uploadPhotos(shipmentId);
    
    // STEP 5: Send Email Notification
    await triggerEmail(paymentIntentId, shipmentId);
    
    // STEP 6: Success!
    onPaymentComplete(paymentIntentId, shipmentId);
    
  } catch (error) {
    handlePaymentError(error);
  } finally {
    setIsProcessing(false);
  }
};
```

---

## Testing Checklist

### Payment Flow
- [ ] Payment intent creation
- [ ] Card validation
- [ ] Payment confirmation
- [ ] Shipment creation
- [ ] Photo upload
- [ ] Email notification
- [ ] Webhook handling
- [ ] Database updates

### Payment Methods
- [ ] Credit card
- [ ] Debit card
- [ ] Apple Pay (after upgrade)
- [ ] Google Pay (after upgrade)

### Error Cases
- [ ] Declined card
- [ ] Insufficient funds
- [ ] Expired card
- [ ] Invalid CVC
- [ ] Network error
- [ ] Webhook failure

### Edge Cases
- [ ] User cancels payment
- [ ] App closes during payment
- [ ] Network drops during payment
- [ ] Duplicate payment attempts

---

## Related Files

### Website
- `website/src/components/completion/PaymentStep.tsx`
- `website/src/app/api/stripe/create-payment-intent/route.ts`
- `website/src/app/api/stripe/capture-upfront/route.ts`
- `website/src/app/api/stripe/capture-remaining/route.ts`

### Mobile
- `mobile/src/components/completion/InvoicePaymentStep.tsx`
- `mobile/src/services/paymentService.ts`

### Backend
- `backend/src/controllers/payments.controller.ts`
- `backend/src/services/stripe.service.ts`
- `backend/src/routes/payments.routes.ts`

### Database
- `supabase/migrations/*_payments.sql`
- `supabase/migrations/*_shipments.sql`
