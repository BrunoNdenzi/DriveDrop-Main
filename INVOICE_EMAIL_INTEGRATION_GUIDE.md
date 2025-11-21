# Invoice/Receipt Email Integration Guide

## ✅ Email Functions Created

Three new email functions have been added to `backend/src/services/email.service.ts`:

### 1. `sendBookingConfirmationEmail()` - Booking Receipt
**Trigger:** After 20% upfront payment is captured  
**Sent to:** Client  
**Contains:**
- Shipment details (pickup/delivery, vehicle info)
- **Complete pricing breakdown** (all 7 factors)
- Payment split (20% charged, 80% reserved)
- Tracking link
- What's next steps

### 2. `sendDeliveryReceiptEmail()` - Final Receipt
**Trigger:** After 80% remaining payment is captured  
**Sent to:** Client  
**Contains:**
- Delivery confirmation (date, time, driver)
- Complete payment summary (both transactions)
- Route visualization
- Delivery photos link
- Feedback request

### 3. `sendDriverPayoutNotification()` - Driver Earnings
**Trigger:** After 80% payment capture  
**Sent to:** Driver  
**Contains:**
- Earnings breakdown (80% payout, 20% platform fee)
- Payout method and timeline
- Shipment completion confirmation

---

## 🔌 Integration Points

### Where to Call These Functions

#### 1. **Booking Confirmation** - After Shipment Creation
**File:** `backend/src/controllers/shipment.controller.ts` or payment creation route  
**Event:** After successful 20% payment authorization & capture

```typescript
// After creating shipment and capturing 20% payment
const bookingData: BookingConfirmationData = {
  firstName: user.first_name,
  email: user.email,
  shipmentId: shipment.id,
  trackingUrl: `${process.env.FRONTEND_URL}/dashboard/shipments/${shipment.id}`,
  
  // Shipment details
  pickupAddress: shipment.pickup_address,
  deliveryAddress: shipment.delivery_address,
  vehicleYear: shipment.vehicle_year,
  vehicleMake: shipment.vehicle_make,
  vehicleModel: shipment.vehicle_model,
  vehicleType: shipment.vehicle_type,
  estimatedDeliveryDate: shipment.delivery_date 
    ? new Date(shipment.delivery_date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) 
    : undefined,
  
  // Pricing breakdown (get from pricing service)
  distanceMiles: pricingQuote.breakdown.distanceMiles,
  distanceBand: pricingQuote.breakdown.distanceBand,
  baseRate: pricingQuote.breakdown.baseRate,
  rawPrice: pricingQuote.breakdown.rawPrice,
  deliverySpeedMultiplier: pricingQuote.breakdown.deliverySpeedMultiplier,
  deliverySpeedType: pricingQuote.breakdown.deliverySpeedType,
  fuelAdjustmentPercent: pricingQuote.breakdown.fuelAdjustmentPercent,
  fuelPricePerGallon: pricingQuote.breakdown.fuelPricePerGallon,
  bulkDiscountPercent: pricingQuote.breakdown.bulkDiscountPercent,
  subtotal: pricingQuote.breakdown.subtotal,
  totalPrice: pricingQuote.total,
  
  // Payment details
  upfrontAmount: pricingQuote.total * 0.20,
  remainingAmount: pricingQuote.total * 0.80,
  paymentMethod: paymentIntent.payment_method.card.last4,
  chargedDate: new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  
  // Receipt number
  receiptNumber: `DD-${shipment.id}-01`, // Format: DD-shipmentId-sequenceNumber
};

// Send email
await emailService.sendBookingConfirmationEmail(bookingData);
```

#### 2. **Delivery Receipt** - After Delivery Completion
**File:** `backend/src/controllers/shipment.controller.ts` or webhook handler  
**Event:** After driver confirms delivery and 80% payment is captured

```typescript
// After delivery confirmation and 80% payment capture
const deliveryData: DeliveryReceiptData = {
  // Client info
  firstName: user.first_name,
  email: user.email,
  
  // Shipment info
  shipmentId: shipment.id,
  trackingUrl: `${process.env.FRONTEND_URL}/dashboard/shipments/${shipment.id}`,
  pickupAddress: shipment.pickup_address,
  deliveryAddress: shipment.delivery_address,
  vehicleYear: shipment.vehicle_year,
  vehicleMake: shipment.vehicle_make,
  vehicleModel: shipment.vehicle_model,
  
  // Pricing
  totalPrice: shipment.price,
  upfrontAmount: shipment.price * 0.20,
  upfrontDate: new Date(upfrontPayment.created_at).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }),
  finalAmount: shipment.price * 0.80,
  finalDate: new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }),
  paymentMethod: paymentIntent.payment_method.card.last4,
  
  // Delivery details
  deliveredDate: new Date(delivery.completed_at).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  deliveredTime: new Date(delivery.completed_at).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }),
  driverName: driver.first_name + ' ' + driver.last_name.charAt(0) + '.', // John D.
  deliveryPhotoUrls: delivery.photos || [],
  
  // Receipt
  receiptNumber: `DD-${shipment.id}-02`, // Sequence 02 for final receipt
};

// Send to client
await emailService.sendDeliveryReceiptEmail(deliveryData);

// Send driver payout notification
const driverPayoutData: DriverPayoutData = {
  firstName: driver.first_name,
  email: driver.email,
  shipmentId: shipment.id,
  totalPrice: shipment.price,
  platformFee: shipment.price * 0.20,
  driverEarnings: shipment.price * 0.80,
  payoutMethod: 'Stripe Connect',
  expectedPayoutDays: '2-5 business days',
  deliveredDate: new Date(delivery.completed_at).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
};

// Send to driver
await emailService.sendDriverPayoutNotification(driverPayoutData);
```

---

## 📦 Stripe Webhook Integration

### Webhook Events to Handle

Add these to `backend/src/services/stripe.service.ts`:

```typescript
// In handleStripeWebhook function

case 'payment_intent.succeeded':
  // Check if this is the initial 20% capture
  const shipment = await getShipmentByPaymentIntent(paymentIntent.id);
  
  if (!shipment.upfront_payment_sent) {
    // This is the 20% upfront payment - send booking confirmation
    const user = await getUserById(shipment.client_id);
    const pricing = await getPricingBreakdown(shipment.id);
    
    await emailService.sendBookingConfirmationEmail({
      // ... populate data as shown above
    });
    
    // Mark as sent
    await updateShipment(shipment.id, { upfront_payment_sent: true });
  } else {
    // This is the 80% final payment - send delivery receipt
    const user = await getUserById(shipment.client_id);
    const driver = await getUserById(shipment.driver_id);
    
    // Send client receipt
    await emailService.sendDeliveryReceiptEmail({
      // ... populate data as shown above
    });
    
    // Send driver payout notification
    await emailService.sendDriverPayoutNotification({
      // ... populate data as shown above
    });
  }
  break;

case 'charge.succeeded':
  // Similar logic can be used here
  logger.info('Charge succeeded webhook received');
  break;
```

---

## 🗄️ Database Schema Updates

Add these columns to track email status:

```sql
-- Add to shipments table
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS upfront_payment_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS final_receipt_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_payout_notified BOOLEAN DEFAULT FALSE;

-- Add payments tracking table
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  receipt_type VARCHAR(20) NOT NULL, -- 'upfront' or 'final'
  amount DECIMAL(10, 2) NOT NULL,
  sent_to_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_payment_receipts_shipment ON payment_receipts(shipment_id);
CREATE INDEX idx_payment_receipts_type ON payment_receipts(receipt_type);
```

---

## 🧪 Testing the Email System

### 1. Test Booking Confirmation Email

```typescript
// Test route: POST /api/test/booking-email
import { emailService } from './services/email.service';

router.post('/test/booking-email', async (req, res) => {
  try {
    const testData: BookingConfirmationData = {
      firstName: 'John',
      email: 'test@example.com', // Change to your email
      shipmentId: 'TEST-12345',
      trackingUrl: 'https://drivedrop.us.com/dashboard/shipments/test',
      
      pickupAddress: '123 Main St, Dallas, TX 75201',
      deliveryAddress: '456 Ocean Ave, San Diego, CA 92101',
      vehicleYear: '2020',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleType: 'sedan',
      estimatedDeliveryDate: 'Friday, March 15, 2025',
      
      distanceMiles: 1346,
      distanceBand: 'mid',
      baseRate: 0.95,
      rawPrice: 1278.70,
      deliverySpeedMultiplier: 1.0,
      deliverySpeedType: 'standard',
      fuelAdjustmentPercent: 0,
      fuelPricePerGallon: 3.70,
      bulkDiscountPercent: 0,
      subtotal: 1278.70,
      totalPrice: 1278.70,
      
      upfrontAmount: 255.74,
      remainingAmount: 1022.96,
      paymentMethod: '4242',
      chargedDate: 'January 30, 2025',
      
      receiptNumber: 'DD-TEST-01',
    };

    const result = await emailService.sendBookingConfirmationEmail(testData);
    res.json({ success: result, message: 'Test booking email sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Test Delivery Receipt Email

```typescript
// Test route: POST /api/test/delivery-email
router.post('/test/delivery-email', async (req, res) => {
  try {
    const testData: DeliveryReceiptData = {
      firstName: 'John',
      email: 'test@example.com',
      
      shipmentId: 'TEST-12345',
      trackingUrl: 'https://drivedrop.us.com/dashboard/shipments/test',
      pickupAddress: '123 Main St, Dallas, TX 75201',
      deliveryAddress: '456 Ocean Ave, San Diego, CA 92101',
      vehicleYear: '2020',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      
      totalPrice: 1278.70,
      upfrontAmount: 255.74,
      upfrontDate: 'Jan 28, 2025',
      finalAmount: 1022.96,
      finalDate: 'Jan 30, 2025',
      paymentMethod: '4242',
      
      deliveredDate: 'Thursday, January 30, 2025',
      deliveredTime: '3:45 PM',
      driverName: 'Mike S.',
      deliveryPhotoUrls: [],
      
      receiptNumber: 'DD-TEST-02',
    };

    const result = await emailService.sendDeliveryReceiptEmail(testData);
    res.json({ success: result, message: 'Test delivery email sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Test Driver Payout Email

```typescript
// Test route: POST /api/test/driver-payout-email
router.post('/test/driver-payout-email', async (req, res) => {
  try {
    const testData: DriverPayoutData = {
      firstName: 'Mike',
      email: 'driver@example.com',
      shipmentId: 'TEST-12345',
      totalPrice: 1278.70,
      platformFee: 255.74,
      driverEarnings: 1022.96,
      payoutMethod: 'Stripe Connect',
      expectedPayoutDays: '2-5 business days',
      deliveredDate: 'Thursday, January 30, 2025',
    };

    const result = await emailService.sendDriverPayoutNotification(testData);
    res.json({ success: result, message: 'Test driver payout email sent!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📋 Implementation Checklist

### Backend:
- [x] Create email templates (DONE - added to email.service.ts)
- [ ] Update Stripe webhook handlers to call email functions
- [ ] Add database columns for tracking email status
- [ ] Create receipt number generation logic
- [ ] Store pricing breakdown in database for email reference
- [ ] Add test routes for email verification

### Database:
- [ ] Run schema migration to add email tracking columns
- [ ] Create `payment_receipts` table
- [ ] Add indexes for performance

### Testing:
- [ ] Test booking confirmation email (20% payment)
- [ ] Test delivery receipt email (80% payment)
- [ ] Test driver payout notification
- [ ] Verify email delivery via Brevo dashboard
- [ ] Test with real Stripe test cards
- [ ] Verify Gmail fallback works

### Frontend (Optional):
- [ ] Add "Download Receipt" button to shipment details
- [ ] Create PDF generation endpoint (future enhancement)
- [ ] Display receipt numbers in payment history

---

## 🚀 Deployment Steps

1. **Deploy Email Service Changes:**
   ```bash
   git add backend/src/services/email.service.ts
   git commit -m "Add booking confirmation and delivery receipt emails"
   git push
   ```

2. **Run Database Migration:**
   ```bash
   # Connect to production database
   psql -h [HOST] -U [USER] -d [DATABASE]
   
   # Run the schema updates shown above
   \i migrations/add_email_tracking.sql
   ```

3. **Test Webhooks:**
   ```bash
   # Use Stripe CLI to test webhooks locally
   stripe listen --forward-to localhost:3001/api/webhooks/stripe
   
   # Trigger test events
   stripe trigger payment_intent.succeeded
   ```

4. **Verify Email Delivery:**
   - Check Brevo dashboard for sent emails
   - Verify no bounces or failures
   - Test Gmail addresses specifically

---

## 🎯 Next Steps

1. **Immediate:** Add webhook integration to send emails on payment events
2. **Short-term:** Add database tracking for email status
3. **Medium-term:** Create PDF receipt generation
4. **Long-term:** Add multi-language support for emails

---

## 📞 Support

If you need help implementing these email functions:
- Email service logs: Check `logger` output in backend console
- Brevo dashboard: https://app.brevo.com/
- Stripe webhooks: https://dashboard.stripe.com/webhooks

---

**Email templates are ready! Now integrate them with your payment flow.**
