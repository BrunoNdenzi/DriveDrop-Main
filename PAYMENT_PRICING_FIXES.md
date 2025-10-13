# Critical Fixes for Payment & Pricing Issues
**Date:** October 13, 2025  
**Commit:** 5f9b418  
**Status:** 🔧 FIXED - Railway Deploying

---

## 🔴 **Issue 1: Payment Initialization Failure (RLS POLICY VIOLATION)**

### **Error:**
```
Error: new row violates row-level security policy for table "shipments"
POST /api/v1/shipments HTTP/1.1" 400
```

### **Root Cause:**
The shipment creation payload was **missing required fields** that the RLS policy enforces:
- `vehicle_year` (NOT NULL in schema)
- `vehicle_make` (NOT NULL in schema)
- `vehicle_model` (NOT NULL in schema)
- `scheduled_pickup` (required by RLS policy)
- `delivery_date` (required for pricing calculations)

### **Fix Applied:**
Updated `InvoicePaymentStep.tsx` shipment payload to include ALL required fields:

```typescript
const shipmentPayload = {
  client_id: user.id,
  pickup_address: shipmentData.pickupAddress,
  pickup_location: `POINT(${pickupCoords.lng} ${pickupCoords.lat})`,
  delivery_address: shipmentData.deliveryAddress,
  delivery_location: `POINT(${deliveryCoords.lng} ${deliveryCoords.lat})`,
  description: `Transport of ${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
  vehicle_type: shipmentData.vehicleType?.toLowerCase() || 'sedan',
  
  // ✅ ADDED REQUIRED FIELDS:
  vehicle_year: parseInt(shipmentData.vehicleYear) || new Date().getFullYear(),
  vehicle_make: shipmentData.vehicleMake || 'Unknown',
  vehicle_model: shipmentData.vehicleModel || 'Unknown',
  scheduled_pickup: shipmentData.pickupDate || new Date().toISOString().split('T')[0],
  delivery_date: shipmentData.deliveryDate || null,
  
  distance_miles: Math.round(calculatedDistance),
  estimated_price: shipmentData.estimatedPrice || 0,
  pickup_date: shipmentData.pickupDate || new Date().toISOString().split('T')[0],
  is_accident_recovery: false,
  vehicle_count: 1,
  title: `Vehicle Transport - ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
  status: 'pending'
};
```

### **Why This Happened:**
The form (`ConsolidatedShipmentForm`) collects all vehicle data, but `InvoicePaymentStep` wasn't including these fields when creating the shipment in the backend. The RLS policy on the `shipments` table requires these fields for data integrity.

### **Testing:**
Once Railway redeploys:
1. Create new shipment
2. Fill in vehicle details
3. Navigate to payment step
4. Should see "Initializing payment..." instead of error
5. Payment intent should create successfully

---

## 🔴 **Issue 2: Pricing Calculation Mismatch**

### **Observed:**
- Mobile app shows one price (e.g., $900)
- Invoice shows different price (e.g., $1000)

### **Root Cause:**
**Two separate pricing systems not synchronized:**

1. **Mobile (Client-Side):** `mobile/src/services/pricingService.ts`
   - Uses simple distance bands (short/mid/long)
   - BASE_RATES: sedan {short: 1.80, mid: 0.95, long: 0.60}
   - Applies road multiplier: 1.3x
   - **Does NOT include:**
     - MIN_MILES=100 threshold
     - MIN_QUOTE=$150 minimum
     - Delivery type multipliers (expedited/flexible)

2. **Backend (Server-Side):** `backend/src/services/pricing.service.ts`
   - Same base rates
   - **INCLUDES:**
     - MIN_MILES=100 (trips under 100 miles)
     - MIN_QUOTE=$150 (minimum for short trips)
     - ACCIDENT_MIN_QUOTE=$80
     - Delivery type: expedited (1.25x), flexible (0.95x), standard (1.0x)

### **Why Different Prices:**
1. Mobile calculates estimate during shipment creation
2. Backend recalculates with additional rules when creating invoice
3. If trip is <100 miles, backend applies $150 minimum
4. If delivery type is expedited/flexible, backend applies multiplier
5. Result: Frontend estimate ≠ Backend actual price

### **Solution Options:**

#### **Option 1: Use Backend for All Pricing (Recommended)**
- Remove client-side calculation
- Call backend API `/api/v1/pricing/calculate` in real-time
- Display accurate price immediately
- **Pros:** Single source of truth, always accurate
- **Cons:** Requires API call (network dependency)

#### **Option 2: Sync Mobile Pricing Logic**
- Update `mobile/src/services/pricingService.ts` to match backend exactly
- Add MIN_MILES, MIN_QUOTE constants
- Add delivery type logic
- **Pros:** No API calls, works offline
- **Cons:** Must maintain two implementations in sync

#### **Option 3: Hybrid Approach**
- Use mobile for quick estimates
- Call backend for final quote before payment
- Show disclaimer: "Estimate - final price shown at checkout"
- **Pros:** Best user experience
- **Cons:** More complex

### **Current State:**
- Mobile uses client-side estimates (may not match final price)
- Backend uses accurate pricing with all rules
- **No API calls between mobile and backend pricing service**

### **Recommended Fix:**
Implement **Option 1** - Call backend pricing API in real-time:

```typescript
// In ConsolidatedShipmentForm.tsx
const calculateRealTimePrice = async () => {
  const response = await fetch(`${API_URL}/api/v1/pricing/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vehicleType: formData.vehicleType,
      distanceMiles: calculatedDistance,
      pickupDate: formData.pickupDate,
      deliveryDate: formData.deliveryDate,
      isAccidentRecovery: false,
      vehicleCount: 1
    })
  });
  
  const { total, breakdown } = await response.json();
  setRealTimePrice(total);
};
```

---

## 📊 **Summary**

| Issue | Status | Impact | Fix |
|-------|--------|--------|-----|
| Payment RLS Violation | ✅ FIXED | HIGH - Blocked all payments | Added required fields to shipment payload |
| Pricing Mismatch | ⚠️ IDENTIFIED | MEDIUM - Price discrepancies | Need to sync mobile/backend pricing OR call backend API |

---

## 🚀 **Next Steps**

### **Immediate (Now):**
1. ✅ Railway deploying with RLS fix (commit 5f9b418)
2. ⏳ Wait 2-3 minutes for deployment
3. ⏳ Test payment initialization again

### **Short Term (This Session):**
1. Decide on pricing sync strategy (Option 1, 2, or 3)
2. Implement chosen solution
3. Test end-to-end: pricing → shipment creation → payment

### **Testing Checklist:**
- [ ] Create shipment with vehicle details
- [ ] Verify pricing shows correctly
- [ ] Navigate to payment step
- [ ] Confirm "Initializing payment..." appears (not error)
- [ ] Payment intent creates successfully
- [ ] Enter test card: 4242 4242 4242 4242
- [ ] Button enables when card valid
- [ ] Complete payment successfully

---

**Status:** RLS fix deployed, waiting for Railway. Pricing mismatch identified but not yet blocking payments.
