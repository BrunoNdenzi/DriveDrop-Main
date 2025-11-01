# Shipment Status Flow - Complete Tracking System

**Version:** 2.0 with Pickup Verification
**Date:** October 29, 2025

---

## 📊 Complete Status Flow Diagram

```
CLIENT BOOKS
     ↓
┌────────────┐
│  pending   │ ← Initial state after booking
└─────┬──────┘
      ↓
      │ Driver accepts job
      ↓
┌────────────┐
│  accepted  │ ← Driver assigned
└─────┬──────┘
      ↓
      │ Driver clicks "Start Trip" / "Head to Pickup"
      ↓
┌─────────────────┐
│ driver_en_route │ ← Driver traveling to pickup location
└────────┬────────┘
         ↓
         │ Driver clicks "I've Arrived" (GPS verified)
         ↓
┌──────────────────┐
│ driver_arrived   │ ← Driver at pickup location
└────────┬─────────┘
         ↓
         │ System prompts: "Complete Pickup Verification"
         ↓
┌───────────────────────────────┐
│ pickup_verification_pending   │ ← Driver taking photos & comparing
└────────────┬──────────────────┘
             ↓
       ┌─────┴──────┐
       ▼            ▼
  ✅ Matches    ⚠️ Issues
       │            │
       │            ├─► Minor → Client Approves → Continue
       │            │
       │            └─► Major → Cancel → Refund
       ↓
┌──────────────────┐
│ pickup_verified  │ ← Verification complete, ready to load
└────────┬─────────┘
         ↓
         │ Driver loads vehicle, clicks "Mark as Picked Up"
         ↓
┌────────────┐
│ picked_up  │ ← Vehicle secured, ready for transport
└──────┬─────┘
       ↓
       │ Driver starts journey, clicks "Start Delivery"
       ↓
┌──────────────┐
│  in_transit  │ ← Active delivery, tracking enabled
└──────┬───────┘
       ↓
       │ Driver arrives at destination, uploads delivery photos
       ↓
┌─────────────┐
│  delivered  │ ← Final state, payment released
└─────────────┘
```

---

## 🎯 Status Definitions

### **1. pending**
- **When:** After client completes booking & payment
- **Who can see:** Client, Admin
- **Driver actions:** Can view & apply
- **Next status:** `accepted` or `cancelled`

### **2. accepted**
- **When:** Driver accepts the job OR admin assigns driver
- **Who can see:** Client, Driver, Admin
- **Driver actions:** Can view shipment details, contact client
- **Next status:** `driver_en_route` or `cancelled`
- **Notifications:** 
  - Client: "Driver assigned!"
  - Driver: "New shipment accepted"

### **3. driver_en_route** ⭐ NEW
- **When:** Driver clicks "Start Trip" / "Head to Pickup"
- **Who can see:** Client, Driver, Admin
- **Driver actions:** 
  - GPS tracking active
  - Can call/message client
  - Can click "I've Arrived"
- **Client view:** 
  - Shows ETA
  - Real-time driver location
  - Driver info & contact
- **Next status:** `driver_arrived` or `cancelled`
- **Notifications:**
  - Client: "Your driver is on the way! ETA: X minutes"

### **4. driver_arrived** ⭐ NEW
- **When:** Driver clicks "I've Arrived" (GPS verified within 100m)
- **Who can see:** Client, Driver, Admin
- **Driver actions:** 
  - Must complete pickup verification
  - Cannot proceed without verification
- **Client view:**
  - "Driver has arrived"
  - Waiting for verification
- **Next status:** `pickup_verification_pending`
- **Notifications:**
  - Client: "Your driver has arrived at pickup location"

### **5. pickup_verification_pending** ⭐ NEW (CRITICAL)
- **When:** Driver starts pickup verification process
- **Who can see:** Client, Driver, Admin
- **Driver actions:**
  - Taking required photos (6 minimum)
  - Comparing with client's photos
  - Selecting verification outcome
- **Client view:**
  - "Driver is verifying vehicle condition"
  - May receive alert if issues found
- **Next status:** `pickup_verified` or `cancelled`
- **Auto-timeout:** If not completed in 30 minutes, admin notified

### **6. pickup_verified** ⭐ NEW
- **When:** Driver confirms vehicle matches OR client approves minor differences
- **Who can see:** Client, Driver, Admin
- **Driver actions:**
  - Load vehicle
  - Click "Mark as Picked Up"
- **Client view:**
  - "Verification complete"
  - "Driver is loading your vehicle"
- **Next status:** `picked_up`
- **Notifications:**
  - Client: "Vehicle verified! Driver is loading now."

### **7. picked_up** ⭐ UPDATED
- **When:** Driver confirms vehicle is secured/loaded
- **Who can see:** Client, Driver, Admin
- **Driver actions:**
  - Begin transport
  - Click "Start Delivery"
- **Client view:**
  - "Vehicle picked up"
  - "In transit to destination"
- **Next status:** `in_transit`
- **Notifications:**
  - Client: "Your vehicle is loaded and secured!"
  - Payment: 80% pre-auth converts to charge

### **8. in_transit**
- **When:** Driver starts active delivery
- **Who can see:** Client, Driver, Admin
- **Driver actions:**
  - GPS tracking active
  - Can update location
  - Can message client
  - Can upload progress photos
- **Client view:**
  - Real-time tracking
  - Estimated delivery time
  - Driver updates
- **Next status:** `delivered`
- **Notifications:**
  - Client: Regular updates on delivery progress

### **9. delivered**
- **When:** Driver completes delivery, uploads delivery photos
- **Who can see:** Client, Driver, Admin
- **Driver actions:** 
  - Request signature/confirmation
  - Upload delivery photos
  - Complete shipment
- **Client view:**
  - "Delivered successfully"
  - View delivery photos
  - Rate driver
  - Compare pickup vs delivery condition
- **Payment:** 
  - Final payment released to driver
  - Platform fee deducted
- **Next status:** None (terminal state)
- **Notifications:**
  - Client: "Your vehicle has been delivered!"
  - Driver: "Payment released"

### **10. cancelled**
- **When:** Cancellation at any stage
- **Who can see:** Client, Driver, Admin
- **Actions:** None (terminal state)
- **Payment:** Based on cancellation policy
- **Next status:** None (terminal state)

---

## 🚦 Driver Action Buttons by Status

### Mobile UI: Driver Shipment Screen

```typescript
// Status: accepted
<Button>Start Trip to Pickup</Button>

// Status: driver_en_route
<Button>I've Arrived</Button>
<Button>Call Client</Button>
<Button>Cancel Shipment</Button>

// Status: driver_arrived
<Button>Start Pickup Verification</Button> // Opens verification flow

// Status: pickup_verification_pending
// Shows verification screen (photo upload, comparison)

// Status: pickup_verified
<Button>Mark as Picked Up</Button>
<Button>Vehicle Loaded & Secured</Button>

// Status: picked_up
<Button>Start Delivery</Button>
<Button>Begin Transport</Button>

// Status: in_transit
<Button>Upload Progress Photo</Button>
<Button>Update Location</Button>
<Button>Contact Client</Button>

// Status: delivered (waiting for photos)
<Button>Upload Delivery Photos</Button>
<Button>Complete Delivery</Button>
```

---

## 📱 Client View by Status

```typescript
// Status: pending
"Looking for available drivers..."
<Button>Cancel Booking</Button>

// Status: accepted
"Driver assigned!"
- Driver name, photo, rating
- Vehicle info
<Button>Contact Driver</Button>

// Status: driver_en_route
"Driver is on the way"
- Real-time map with driver location
- ETA countdown
<Button>Call Driver</Button>

// Status: driver_arrived
"Driver has arrived"
- "Verification in progress"
- Countdown timer

// Status: pickup_verification_pending
"Driver is verifying vehicle condition"
- May show alert if issues found
- Option to approve/dispute

// Status: pickup_verified
"Vehicle verified & loading"
- Confirmation message

// Status: picked_up
"Vehicle picked up successfully"
- "In transit to destination"

// Status: in_transit
"In transit"
- Real-time tracking
- Estimated delivery time
- Progress updates

// Status: delivered
"Delivered!"
- View delivery photos
- Rate driver
- Report issues (if any)
```

---

## ⏱️ Estimated Time in Each Status

| Status | Typical Duration | Timeout | Action on Timeout |
|--------|------------------|---------|-------------------|
| pending | Hours - Days | 7 days | Auto-cancel, full refund |
| accepted | Hours | 24 hours | Admin review |
| driver_en_route | 30 min - 2 hours | 4 hours | Driver contacted |
| driver_arrived | 5-15 minutes | 30 minutes | Admin notified |
| pickup_verification_pending | 10-20 minutes | 30 minutes | Admin escalation |
| pickup_verified | 5-10 minutes | 20 minutes | Auto-reminder |
| picked_up | Brief | N/A | Immediate transition |
| in_transit | Hours - Days | Based on distance | Track delays |
| delivered | Terminal | N/A | N/A |

---

## 🔔 Notification Strategy

### Push Notifications

```typescript
const notifications = {
  // Status changes
  accepted: {
    client: "Great news! A driver has been assigned to your shipment.",
    driver: "New shipment accepted. Review details and start when ready."
  },
  
  driver_en_route: {
    client: "Your driver is on the way! ETA: {eta} minutes.",
    driver: "Navigate to pickup location. Remember to verify vehicle on arrival."
  },
  
  driver_arrived: {
    client: "Your driver has arrived at the pickup location.",
    driver: "You've arrived. Complete pickup verification to proceed."
  },
  
  pickup_verification_pending: {
    client: "Driver is verifying vehicle condition...",
    driver: "Compare photos carefully. Document any differences."
  },
  
  // Issues during verification
  minor_differences_found: {
    client: "⚠️ Your driver noticed minor differences. Please review and respond within 5 minutes.",
    driver: "Waiting for client response..."
  },
  
  pickup_verified: {
    client: "✅ Vehicle verified! Driver is loading now.",
    driver: "Verification complete. Load vehicle and mark as picked up."
  },
  
  picked_up: {
    client: "Your vehicle is loaded and secured!",
    driver: "Vehicle secured. Start delivery when ready."
  },
  
  in_transit: {
    client: "Your vehicle is in transit. Track real-time progress.",
    driver: "Delivery in progress. Safe travels!"
  },
  
  delivered: {
    client: "🎉 Your vehicle has been delivered! Please rate your experience.",
    driver: "Delivery complete! Payment has been released."
  }
};
```

### SMS Notifications (Critical Events Only)

- Driver assigned (accepted)
- Driver arrived (driver_arrived)
- Verification issues (minor_differences_found)
- Picked up (picked_up)
- Delivered (delivered)

---

## 🔒 Status Update Permissions

| Status | Who Can Update | Conditions |
|--------|----------------|------------|
| pending → accepted | Driver, Admin | Driver applies OR admin assigns |
| accepted → driver_en_route | Driver only | Must be assigned driver |
| driver_en_route → driver_arrived | Driver only | GPS within 100m of address |
| driver_arrived → pickup_verification_pending | Driver only | Clicks "Start Verification" |
| pickup_verification_pending → pickup_verified | Driver only | Verification complete |
| pickup_verification_pending → cancelled | Driver, Client, Admin | Issues found |
| pickup_verified → picked_up | Driver only | Vehicle loaded |
| picked_up → in_transit | Driver only | Transport started |
| in_transit → delivered | Driver only | Delivery photos uploaded |
| Any → cancelled | Client (before pickup), Admin (any time) | Valid reason required |

---

## 💾 Database Tracking

### shipments table updates

```sql
UPDATE shipments SET
  status = 'driver_en_route',
  updated_at = NOW(),
  updated_by = driver_id
WHERE id = shipment_id;

-- Also update specific timestamp columns:
- driver_arrival_time (when status = driver_arrived)
- pickup_verified_at (when status = pickup_verified)
- actual_pickup_time (when status = picked_up)
- actual_delivery_time (when status = delivered)
```

### shipment_status_history logging

```sql
INSERT INTO shipment_status_history (
  shipment_id,
  status,
  changed_by,
  notes,
  location_lat,
  location_lng
) VALUES (
  shipment_id,
  new_status,
  user_id,
  'Status changed via mobile app',
  gps_lat,
  gps_lng
);
```

---

## 🎨 UI Status Colors

```typescript
const statusColors = {
  pending: '#FFB74D',           // Orange
  accepted: '#64B5F6',          // Light Blue
  driver_en_route: '#00B8A9',   // Teal (brand color)
  driver_arrived: '#00B8A9',    // Teal
  pickup_verification_pending: '#FF9800', // Orange (action needed)
  pickup_verified: '#4CAF50',   // Green
  picked_up: '#00B8A9',         // Teal
  in_transit: '#00B8A9',        // Teal (brand color)
  delivered: '#81C784',         // Light Green
  cancelled: '#E57373',         // Light Red
};
```

---

## ✅ Implementation Checklist

- [x] Database schema with new statuses
- [ ] API endpoints for status updates
- [ ] Mobile UI components for each status
- [ ] Driver action buttons
- [ ] Client status views
- [ ] Push notifications
- [ ] SMS notifications (critical only)
- [ ] GPS verification logic
- [ ] Status transition validation
- [ ] Admin dashboard status tracking
- [ ] Analytics & reporting

---

**Next:** Implement API endpoints and mobile UI components for driver flow.
