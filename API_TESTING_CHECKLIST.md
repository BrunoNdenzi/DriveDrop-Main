# API Testing Checklist - Pickup Verification System

**Date:** Ready for Testing  
**Base URL:** `http://localhost:3000/api/v1`

## Prerequisites

### 1. Backend Running
```powershell
cd backend
npm run dev
# Should see: Server running on port 3000
```

### 2. Database Ready
- ✅ SQL migration applied (pickup_verifications & cancellation_records tables)
- ✅ RLS policies enabled
- ✅ Database functions created (calculate_cancellation_refund, etc.)

### 3. Test Data Ready
- Driver account with email/password
- Client account with email/password
- At least one shipment in 'assigned' or 'accepted' status
- Shipment must have driver_id assigned

## Testing Flow

### Step 1: Get Authentication Token

#### Driver Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "driver@example.com",
  "password": "test123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "user": {
      "id": "uuid-here",
      "email": "driver@example.com",
      "role": "driver"
    }
  }
}
```

**Save the access_token for subsequent requests!**

---

### Step 2: Mark Driver En Route

```http
POST /api/v1/shipments/{shipmentId}/pickup/mark-en-route
Authorization: Bearer {access_token}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Marked as en route to pickup"
}
```

**Verify in Database:**
```sql
SELECT status FROM shipments WHERE id = '{shipmentId}';
-- Should be: driver_en_route
```

---

### Step 3: Mark Driver Arrived

```http
POST /api/v1/shipments/{shipmentId}/pickup/mark-arrived
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Marked as arrived at pickup"
}
```

**Note:** GPS verification (100m radius) happens at verification stage, not here.

---

### Step 4: Start Pickup Verification

```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/start
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "location": {
    "lat": 40.7128,
    "lng": -74.0060,
    "accuracy": 10
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "uuid-here",
    "status": "pending",
    "distanceFromPickup": 45.2,
    "withinRadius": true
  }
}
```

**Verify in Database:**
```sql
SELECT 
  id,
  shipment_id,
  driver_id,
  ST_AsText(pickup_location) as location,
  verification_status,
  distance_from_pickup_meters
FROM pickup_verifications 
WHERE shipment_id = '{shipmentId}'
ORDER BY created_at DESC LIMIT 1;
```

---

### Step 5: Upload Verification Photos

#### Upload Photo 1 - Front
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/photos
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

verificationId: {verificationId}
angle: front
location[lat]: 40.7128
location[lng]: -74.0060
photo: [file upload]
```

#### Upload Photo 2 - Left Side
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/photos
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

verificationId: {verificationId}
angle: left_side
location[lat]: 40.7128
location[lng]: -74.0060
photo: [file upload]
```

#### Upload Photo 3 - Right Side
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/photos
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

verificationId: {verificationId}
angle: right_side
location[lat]: 40.7128
location[lng]: -74.0060
photo: [file upload]
```

#### Upload Photo 4 - Back
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/photos
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

verificationId: {verificationId}
angle: back
location[lat]: 40.7128
location[lng]: -74.0060
photo: [file upload]
```

**Expected Response (each photo):**
```json
{
  "success": true,
  "data": {
    "photoId": "uuid-here",
    "url": "https://your-storage.com/path/to/photo.jpg",
    "angle": "front",
    "timestamp": "2025-01-30T12:00:00Z"
  }
}
```

---

### Step 6: Submit Verification

#### Option A: Vehicle Matches Description
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/submit
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "decision": "matches",
  "driverNotes": "Vehicle condition matches description exactly",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "{verificationId}",
    "decision": "approved",
    "status": "approved_by_client"
  },
  "message": "Verification approved - proceed with pickup"
}
```

#### Option B: Minor Differences
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/submit
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "decision": "minor_differences",
  "differences": [
    "Small scratch on door",
    "Tire tread slightly worn"
  ],
  "driverNotes": "Minor cosmetic issues, vehicle is operational",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "{verificationId}",
    "decision": "minor_differences",
    "status": "pending_client_response",
    "requiresClientResponse": true
  },
  "message": "Verification submitted - waiting for client response"
}
```

#### Option C: Major Issues
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/submit
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "decision": "major_issues",
  "differences": [
    "Engine damage not disclosed",
    "Frame bent - safety issue"
  ],
  "driverNotes": "Vehicle condition significantly worse than described",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verificationId": "{verificationId}",
    "decision": "major_issues",
    "status": "rejected",
    "cancellationInitiated": true
  },
  "message": "Verification rejected - cancellation initiated"
}
```

---

### Step 7: Get Verification Status

```http
GET /api/v1/shipments/{shipmentId}/pickup/verify
Authorization: Bearer {access_token}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "{verificationId}",
    "shipmentId": "{shipmentId}",
    "driverId": "{driverId}",
    "verificationStatus": "approved_by_client",
    "decision": "matches",
    "photoCount": 4,
    "distanceFromPickup": 45.2,
    "withinRadius": true,
    "createdAt": "2025-01-30T12:00:00Z",
    "completedAt": "2025-01-30T12:10:00Z"
  }
}
```

---

### Step 8A: Client Response (If Minor Differences)

**Client Login First:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "test123"
}
```

**Client Approves:**
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/client-response
Authorization: Bearer {client_access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "response": "approved",
  "notes": "Minor issues are acceptable"
}
```

**Client Disputes:**
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/client-response
Authorization: Bearer {client_access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "response": "disputed",
  "notes": "These issues were not disclosed"
}
```

---

### Step 8B: Cancel at Pickup (If Rejected)

```http
POST /api/v1/shipments/{shipmentId}/pickup/cancel
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "cancellationType": "at_pickup_mismatch",
  "reason": "Vehicle condition significantly worse than described",
  "fraudConfirmed": false,
  "pickupVerificationId": "{verificationId}",
  "evidenceUrls": [
    "https://storage.com/photo1.jpg",
    "https://storage.com/photo2.jpg"
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "cancellationId": "uuid-here",
    "shipmentId": "{shipmentId}",
    "refundBreakdown": {
      "originalAmount": 500.00,
      "clientRefund": 350.00,
      "driverCompensation": 100.00,
      "platformFee": 50.00
    },
    "refundStatus": "pending"
  }
}
```

---

### Step 9: Mark as Picked Up (If Approved)

```http
POST /api/v1/shipments/{shipmentId}/pickup/mark-picked-up
Authorization: Bearer {access_token}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Marked as picked up"
}
```

**Verify in Database:**
```sql
SELECT 
  status,
  pickup_verified,
  pickup_verified_at,
  actual_pickup_time
FROM shipments 
WHERE id = '{shipmentId}';
-- status should be: picked_up
-- pickup_verified should be: true
```

---

## Error Cases to Test

### 1. Not Within 100m Radius
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/start
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "location": {
    "lat": 40.8128,
    "lng": -74.1060,
    "accuracy": 10
  }
}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Driver must be within 100 meters of pickup location. Current distance: 154m"
}
```

### 2. Unauthorized Driver
```http
POST /api/v1/shipments/{different_shipment_id}/pickup/verify/start
Authorization: Bearer {access_token}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Not authorized for this shipment"
}
```

### 3. Invalid Shipment Status
```http
POST /api/v1/shipments/{completed_shipment_id}/pickup/verify/start
Authorization: Bearer {access_token}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "Cannot start verification for shipment with status: completed"
}
```

### 4. Missing Photos
```http
POST /api/v1/shipments/{shipmentId}/pickup/verify/submit
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "verificationId": "{verificationId}",
  "decision": "matches"
}
```

**Expected Error:**
```json
{
  "success": false,
  "error": "All 4 verification photos required (front, back, left_side, right_side)"
}
```

---

## Database Verification Queries

### Check Verification Record
```sql
SELECT 
  id,
  shipment_id,
  driver_id,
  verification_status,
  decision,
  photo_count,
  distance_from_pickup_meters,
  ST_AsText(pickup_location) as location_wkt,
  driver_notes,
  client_response,
  created_at,
  verification_completed_at
FROM pickup_verifications
WHERE shipment_id = '{shipmentId}'
ORDER BY created_at DESC;
```

### Check Cancellation Record
```sql
SELECT 
  id,
  shipment_id,
  cancelled_by,
  canceller_role,
  cancellation_type,
  cancellation_stage,
  reason_category,
  reason_description,
  original_amount,
  client_refund_amount,
  driver_compensation_amount,
  platform_fee_amount,
  refund_status,
  fraud_confirmed
FROM cancellation_records
WHERE shipment_id = '{shipmentId}';
```

### Check Shipment Status Updates
```sql
SELECT 
  id,
  status,
  driver_id,
  pickup_verified,
  pickup_verified_at,
  pickup_verification_status,
  driver_arrival_time,
  actual_pickup_time,
  cancellation_record_id
FROM shipments
WHERE id = '{shipmentId}';
```

---

## Test Results Checklist

- [ ] ✅ Driver can login and get JWT token
- [ ] ✅ Driver can mark en-route
- [ ] ✅ Driver can mark arrived
- [ ] ✅ Driver can start verification (within 100m)
- [ ] ❌ Driver cannot start verification (outside 100m)
- [ ] ✅ Driver can upload 4 photos
- [ ] ✅ Photos are stored in Supabase Storage
- [ ] ✅ Driver can submit verification with "matches"
- [ ] ✅ Driver can submit verification with "minor_differences"
- [ ] ✅ Driver can submit verification with "major_issues"
- [ ] ✅ Client can approve minor differences
- [ ] ✅ Client can dispute minor differences
- [ ] ✅ Cancellation record created on major issues/dispute
- [ ] ✅ Refund calculation works (70/20/10 split)
- [ ] ✅ Driver can mark as picked up after approval
- [ ] ✅ Shipment status updates correctly throughout flow
- [ ] ❌ Unauthorized driver cannot access other's shipments
- [ ] ❌ Cannot submit verification without required photos
- [ ] ✅ Database triggers fire correctly
- [ ] ✅ RLS policies enforce access control

---

## Notes

1. **PostGIS Location Format:** `POINT(longitude latitude)` - longitude first!
2. **Photo Requirements:** All 4 angles required (front, back, left_side, right_side)
3. **GPS Accuracy:** 100m radius enforced at verification start
4. **Refund Split:** 70% client, 20% driver, 10% platform (at_pickup cancellation)
5. **Status Flow:** assigned → driver_en_route → driver_arrived → pickup_verification_pending → pickup_verified → picked_up → in_transit

## Ready to Test!

Start your backend server and use Thunder Client, Postman, or curl to test the API endpoints following this checklist.
