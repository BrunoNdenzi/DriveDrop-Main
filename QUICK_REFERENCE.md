# 🎯 Quick Reference: Shipment Status & Actions

## Status Flow Cheat Sheet

```
pending (client books)
    ↓ driver accepts
accepted
    ↓ driver clicks "Start Trip"
driver_en_route (GPS tracking ON)
    ↓ driver clicks "I've Arrived" (GPS verified ≤100m)
driver_arrived
    ↓ driver clicks "Start Verification"
pickup_verification_pending (taking 6+ photos)
    ↓ driver submits decision
    ├─ ✅ Matches → pickup_verified
    ├─ ⚠️ Minor → wait 5min → client approves → pickup_verified
    └─ ❌ Major → cancelled (70% refund)
pickup_verified
    ↓ driver clicks "Mark as Picked Up"
picked_up (vehicle loaded)
    ↓ driver clicks "Start Delivery"
in_transit (GPS tracking ON)
    ↓ driver uploads delivery photos
delivered (payment released)
```

---

## Driver Action Buttons by Status

| Current Status | Button | Next Status |
|----------------|--------|-------------|
| accepted | 🚗 Start Trip to Pickup | driver_en_route |
| driver_en_route | 📍 I've Arrived | driver_arrived (GPS check) |
| driver_arrived | 📸 Start Verification | pickup_verification_pending |
| pickup_verification_pending | ✅ Submit Verification | pickup_verified or cancelled |
| pickup_verified | 📦 Mark as Picked Up | picked_up |
| picked_up | 🚚 Start Delivery | in_transit |
| in_transit | 📸 Upload Delivery Photos | delivered |

---

## GPS Verification Rules

| Action | Requirement | Error if Failed |
|--------|-------------|-----------------|
| Mark Arrived | ≤100m from pickup address | "You must be within 100 meters. Current: 250m" |
| Start Verification | Same location as arrival | - |
| Take Photos | Location logged with each photo | - |

---

## Photo Requirements

**Minimum:** 6 photos  
**Required Angles:**
1. Front view
2. Rear view
3. Driver side
4. Passenger side
5. Front driver quarter
6. Front passenger quarter

**Optional:** Interior, odometer, damage close-ups

---

## Verification Decisions

| Decision | Icon | Next Action | Client Alert |
|----------|------|-------------|--------------|
| **Matches** | ✅ | Auto-approve → pickup_verified | "✅ Verified! Loading now." |
| **Minor Differences** | ⚠️ | Alert client → 5min timer | "⚠️ Review within 5 minutes!" |
| **Major Issues** | ❌ | Auto-cancel → refund 70% | "❌ Cancelled. Refund: $X" |

---

## Refund Quick Reference

| Cancellation Type | Client | Driver | Platform |
|-------------------|--------|--------|----------|
| **Before acceptance** | 💰 100% | 0% | 0% |
| **After acceptance** | 💰 80% | 💰 10% | 10% |
| **At pickup - mismatch** | 💰 70% | 💰 20% | 10% |
| **At pickup - fraud** | 0% | 💰 40% | 60% |
| **During transit** | 💰 50% | 💰 40% | 10% |
| **Force majeure** | 💰 90% | 💰 5% | 5% |

---

## Status Colors

```typescript
const colors = {
  pending: '#FFB74D',           // Orange
  accepted: '#64B5F6',          // Light Blue
  driver_en_route: '#00B8A9',   // Teal (brand)
  driver_arrived: '#00B8A9',    // Teal
  pickup_verification_pending: '#FF9800', // Orange
  pickup_verified: '#4CAF50',   // Green
  picked_up: '#00B8A9',         // Teal
  in_transit: '#00B8A9',        // Teal
  delivered: '#81C784',         // Light Green
  cancelled: '#E57373',         // Light Red
};
```

---

## Time Limits

| Event | Time Limit | Action on Timeout |
|-------|------------|-------------------|
| Verification completion | 30 minutes | Admin notified |
| Client response to minor differences | 5 minutes | Auto-approve |
| Driver arrival (after en route) | ETA + 1 hour | Admin contacted |
| Photo upload | 20 minutes | Reminder sent |

---

## Notifications Summary

### Push Notifications

- 📱 accepted → "Driver assigned!"
- 🚗 driver_en_route → "Driver on way! ETA: 30min"
- 📍 driver_arrived → "Driver has arrived"
- 📸 pickup_verification_pending → "Verifying vehicle..."
- ⚠️ minor_differences → "Review within 5 minutes!"
- ✅ pickup_verified → "Verified! Loading now."
- 📦 picked_up → "Vehicle loaded!"
- 🚚 in_transit → "In transit. Track progress."
- 🎉 delivered → "Delivered!"

### SMS (Critical Only)

- driver_arrived
- minor_differences_found
- picked_up
- delivered

---

## API Endpoints Quick List

```
POST   /api/shipments/:id/driver-en-route
POST   /api/shipments/:id/driver-arrived
POST   /api/shipments/:id/start-verification
POST   /api/shipments/:id/verification-photos
POST   /api/shipments/:id/submit-verification
POST   /api/shipments/:id/client-response
POST   /api/shipments/:id/cancel-at-pickup
PATCH  /api/shipments/:id/status
```

---

## Database Functions

```sql
-- Calculate refund splits
SELECT * FROM calculate_cancellation_refund(
  p_original_amount := 500.00,
  p_cancellation_type := 'at_pickup_mismatch',
  p_fraud_confirmed := false
);

-- Update status safely (with validation)
SELECT update_shipment_status_safe(
  p_shipment_id := 'uuid-here',
  p_new_status := 'driver_en_route',
  p_user_id := 'driver-uuid'
);

-- Check if transition is valid
SELECT is_valid_status_transition('accepted', 'driver_en_route');
-- Returns: TRUE

SELECT is_valid_status_transition('accepted', 'picked_up');
-- Returns: FALSE (must go through intermediate statuses)
```

---

## TypeScript Service Calls

```typescript
import PickupVerificationService from '@/services/pickupVerificationService';

// 1. Mark driver en route
await PickupVerificationService.markDriverEnRoute(shipmentId, driverId);

// 2. Mark driver arrived (GPS check)
await PickupVerificationService.markDriverArrived(
  shipmentId, 
  driverId, 
  { lat: 40.7128, lng: -74.0060 }
);

// 3. Start verification
const verification = await PickupVerificationService.startVerification({
  shipmentId,
  location: { lat, lng, accuracy: 10 }
});

// 4. Upload photos (repeat 6+ times)
await PickupVerificationService.uploadVerificationPhoto(
  verificationId,
  'front',  // angle
  imageUri,
  { lat, lng }
);

// 5. Submit verification
await PickupVerificationService.submitVerification({
  verificationId,
  photos: [{ angle: 'front', uri: '...' }, ...],
  decision: 'matches',  // or 'minor_differences' or 'major_issues'
  differences: [...],  // if issues found
  driverNotes: 'Vehicle in good condition',
  location: { lat, lng }
});

// 6. Client responds (if minor differences)
await PickupVerificationService.clientRespondToVerification({
  verificationId,
  response: 'approved',  // or 'disputed'
  notes: 'Acceptable'
});

// 7. Mark picked up
await PickupVerificationService.markPickedUp(shipmentId, driverId);

// 8. Mark in transit
await PickupVerificationService.markInTransit(shipmentId, driverId);

// 9. Cancel at pickup
await PickupVerificationService.cancelAtPickup({
  shipmentId,
  cancellationType: 'at_pickup_mismatch',
  reason: 'Vehicle does not match photos',
  pickupVerificationId: verificationId,
  fraudConfirmed: false
});
```

---

## Files Modified/Created

### Documentation (5 files)
- `DRIVER_PICKUP_VERIFICATION_SYSTEM.md` - Master plan
- `SHIPMENT_STATUS_FLOW_COMPLETE.md` - Status definitions
- `PHASE_1_COMPLETE_PICKUP_VERIFICATION.md` - Summary
- `PHASE_2_API_IMPLEMENTATION_GUIDE.md` - API guide
- `READY_TO_IMPLEMENT.md` - Quick start
- **`QUICK_REFERENCE.md`** - This file

### Database (1 file)
- `backend/scripts/01_pickup_verification_schema.sql`

### TypeScript (4 files)
- `mobile/src/types/pickupVerification.ts`
- `mobile/src/types/cancellation.ts`
- `mobile/src/types/shipment.ts` (updated)
- `mobile/src/services/pickupVerificationService.ts`

---

## Testing Checklist

- [ ] Apply database migration
- [ ] Test refund calculation function
- [ ] Test status transition validation
- [ ] Test GPS verification (within/outside 100m)
- [ ] Test photo upload to Supabase Storage
- [ ] Test verification with 3 decisions
- [ ] Test client response (approve/dispute)
- [ ] Test 5-minute auto-approve
- [ ] Test cancellation with refund
- [ ] Test full flow end-to-end

---

## Common Issues & Solutions

### Issue: "GPS verification failed"
**Cause:** Driver >100m from pickup address  
**Solution:** Driver must move closer, error shows actual distance

### Issue: "Cannot submit verification"
**Cause:** <6 photos uploaded  
**Solution:** Upload remaining required photos

### Issue: "Invalid status transition"
**Cause:** Trying to skip statuses (e.g., accepted → picked_up)  
**Solution:** Follow status flow, cannot skip steps

### Issue: "Only assigned driver can update"
**Cause:** Different user trying to update driver-only status  
**Solution:** Ensure authenticated user matches shipment.driver_id

### Issue: "Stripe refund failed"
**Cause:** Payment intent not found, insufficient funds, etc.  
**Solution:** Check Stripe dashboard, mark refund_status='failed', admin review

---

## Production Readiness Checklist

- [ ] Database migration applied ✓
- [ ] All RLS policies enabled ✓
- [ ] Stripe webhooks configured
- [ ] Push notifications set up (FCM/APNs)
- [ ] SMS service configured (Twilio)
- [ ] Error logging enabled (Sentry)
- [ ] Monitoring dashboards (Grafana)
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Legal terms updated

---

## Support Contacts

- **Database Issues:** Check Supabase logs
- **Payment Issues:** Stripe dashboard
- **GPS Issues:** Check Location permissions
- **Photo Upload Issues:** Supabase Storage logs

---

**Print this and keep it handy during development!** 📋
