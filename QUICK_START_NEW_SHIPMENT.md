# Quick Start Guide - New Shipment Creation

## 🚀 Test the Feature NOW

### Prerequisites
✅ Stripe packages installed
✅ Environment variables configured
✅ Google Maps API key active
✅ Supabase connection working

### Testing Steps

#### 1. Start Development Server
```bash
cd f:\DD\DriveDrop-Main\website
npm run dev
```

#### 2. Login & Navigate
- Open http://localhost:3000
- Login as a **Client** user
- Click **"Create New Shipment"** button on dashboard

#### 3. Fill Booking Form (5 Sections)

**Section 1: Customer Information** (Auto-filled)
- ✅ Name: Should already be filled from your profile
- ✅ Email: Should already be filled
- ✅ Phone: Should already be filled

**Section 2: Pickup & Delivery Locations**
- Pickup: Type "123 Main St, Los Angeles, CA" (autocomplete will suggest)
- Delivery: Type "456 Oak Ave, San Francisco, CA"
- Pickup Date: Select tomorrow or later
- Delivery Date: Select after pickup date

**Section 3: Vehicle Details**
- Type: Select "Sedan"
- Make: Enter "Toyota"
- Model: Enter "Camry"
- Year: Enter "2020"
- Operable: Select "Yes"

**Section 4: Shipment Details**
- Service Type: Select "Standard"
- Special Instructions: "Handle with care" (optional)

**Section 5: Pricing Summary**
- Review the calculated price
- See 20%/80% breakdown
- Click **"Continue to Completion"**

#### 4. Complete 4-Step Flow

**Step 1: Vehicle Photos** (Upload minimum 4)
- Front view (required)
- Rear view (required)
- Left side (required)
- Right side (required)
- Interior (optional)
- Damage areas (optional)
- Click **"Continue"**

**Step 2: Proof of Ownership** (Upload minimum 1)
- Vehicle Title (required) - Use any PDF or image
- Registration (optional)
- Insurance Card (optional)
- Photo ID (optional)
- Click **"Continue"**

**Step 3: Terms & Conditions**
- Read through the 5 sections (collapsible)
- Check **"I have read and accept"** checkbox
- Click **"Continue"**

**Step 4: Payment**
- Card Number: `4242 4242 4242 4242` (Stripe test card)
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 90210)
- Review payment summary showing 20% charge
- Click **"Pay $XXX.XX Now"**

#### 5. Verify Success
- ✅ See success confirmation screen
- ✅ Automatically redirected to dashboard after 2 seconds
- ✅ Check Supabase `shipments` table for new record
- ✅ Check Supabase `payments` table for payment record
- ✅ Check Stripe dashboard for payment intent

---

## 🧪 Test Cards (Stripe Test Mode)

| Scenario | Card Number | Result |
|----------|-------------|--------|
| **Success** | 4242 4242 4242 4242 | Payment succeeds |
| **Decline** | 4000 0000 0000 0002 | Card declined |
| **Insufficient Funds** | 4000 0000 0000 9995 | Insufficient funds error |
| **Expired Card** | 4000 0000 0000 0069 | Expired card error |

Use any future expiry date, any 3-digit CVC, any ZIP code.

---

## 🐛 Troubleshooting

### Issue: Google Maps autocomplete not working
**Solution:** 
1. Check browser console for API key errors
2. Verify Google Maps API key in `.env.local`
3. Ensure Places API is enabled in Google Cloud Console

### Issue: Payment intent creation fails
**Solution:**
1. Check Stripe secret key in `.env.local`
2. Verify Stripe package installed: `npm list stripe`
3. Check browser console and server terminal for errors

### Issue: TypeScript import error for AddressAutocomplete
**Solution:**
1. This is a false positive (caching issue)
2. Reload VS Code window: Ctrl+Shift+P → "Reload Window"
3. Or restart TypeScript server: Ctrl+Shift+P → "TypeScript: Restart TS Server"

### Issue: Shipment not created in database
**Solution:**
1. Check Supabase connection
2. Verify RLS policies allow INSERT for client role
3. Check browser console for Supabase errors

---

## 📊 Database Verification

### Check Shipments Table
```sql
SELECT 
  id, 
  title, 
  status, 
  estimated_price, 
  payment_status, 
  created_at
FROM shipments
WHERE client_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Payments Table
```sql
SELECT 
  id, 
  amount, 
  initial_amount, 
  remaining_amount, 
  status, 
  payment_intent_id,
  created_at
FROM payments
WHERE client_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🔍 Debug Mode

### Enable Detailed Logging

Add to `PaymentStep.tsx` (line 165, before handleSubmit):
```typescript
console.log('🚀 Shipment Data:', shipmentData)
console.log('📸 Photos Count:', completionData.vehiclePhotos.length)
console.log('📄 Documents Count:', completionData.ownershipDocuments.length)
console.log('✅ Terms Accepted:', completionData.termsAccepted)
console.log('💰 Upfront Amount:', upfrontAmount, 'cents')
console.log('💳 Total Amount:', totalAmount, 'cents')
```

### Monitor Stripe Events

1. Open Stripe Dashboard: https://dashboard.stripe.com/test/dashboard
2. Go to **Developers** → **Events**
3. Watch for `payment_intent.created` and `payment_intent.succeeded` events

---

## 📱 Mobile Testing

### Test on Mobile Device
1. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Access from mobile: `http://YOUR-IP:3000`
3. Ensure all features work on touch devices
4. Test photo upload from camera
5. Verify responsive design

---

## ✅ Feature Checklist

- [x] Booking form with 5 sections
- [x] Address autocomplete with Google Maps
- [x] Real-time distance and pricing calculation
- [x] Auto-fill customer information
- [x] Photo upload (drag & drop + click)
- [x] Document upload (multiple file types)
- [x] Terms & conditions acceptance
- [x] Stripe payment integration (20% charge)
- [x] Shipment creation in database
- [x] Payment record creation
- [x] Success confirmation screen
- [x] Automatic redirect to dashboard
- [x] Session storage for data persistence
- [x] Form validation (all steps)
- [x] Error handling (payment failures)
- [x] Loading states (spinners)
- [x] Mobile responsive design

---

## 🎯 Success Criteria

✅ User can complete entire flow without errors
✅ Payment processes successfully (20%)
✅ Shipment appears in database
✅ Payment record created with correct amounts
✅ User redirected to dashboard
✅ All validation rules enforced
✅ Photos and documents stored
✅ Coordinates saved for pickup/delivery

---

## 🚀 Next Actions

1. **Test the flow end-to-end** using this guide
2. **Verify database records** after successful payment
3. **Check Stripe dashboard** for payment confirmation
4. **Report any issues** you encounter
5. **Proceed to next feature** (tracking, driver dashboard, etc.)

---

**Ready to test!** 🎉

Start your dev server and follow the steps above to create your first shipment!
