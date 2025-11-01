# Phase 2 API Testing - Production Railway Environment

**Backend URL:** `https://drivedrop-main-production.up.railway.app`

## Prerequisites

Before testing, reset the test shipment in Supabase SQL Editor:

```sql
-- Reset shipment to 'assigned' status
UPDATE shipments 
SET status = 'assigned',
    driver_arrival_time = NULL,
    pickup_verified = false,
    pickup_verified_at = NULL,
    pickup_verification_status = NULL,
    actual_pickup_time = NULL,
    cancellation_record_id = NULL,
    updated_at = NOW()
WHERE id = '2961b4a8-6727-4ce8-b103-86240afb91cc';

-- Delete any existing verification records
DELETE FROM pickup_verifications WHERE shipment_id = '2961b4a8-6727-4ce8-b103-86240afb91cc';

-- Delete any existing cancellation records
DELETE FROM cancellation_records WHERE shipment_id = '2961b4a8-6727-4ce8-b103-86240afb91cc';
```

---

## Step 1: Get JWT Token (Login as Driver)

```powershell
$loginResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"driver@test.com","password":"Test123!"}'

$token = $loginResponse.token
Write-Host "Token obtained: $($token.Substring(0,50))..." -ForegroundColor Green
```

---

## Step 2: Mark Driver En Route

```powershell
$enRouteResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/driver-en-route" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json"

Write-Host "`n=== Driver En Route Response ===" -ForegroundColor Cyan
$enRouteResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "status": "driver_en_route",
    "message": "Driver is now en route to pickup location"
  }
}
```

---

## Step 3: Mark Driver Arrived at Pickup

```powershell
$arrivedResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/driver-arrived" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body '{"latitude":32.7767,"longitude":-96.7970}'

Write-Host "`n=== Driver Arrived Response ===" -ForegroundColor Cyan
$arrivedResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "status": "driver_arrived",
    "driver_arrival_time": "2025-11-01T10:00:00.000Z",
    "message": "Driver has arrived at pickup location"
  }
}
```

---

## Step 4: Start Pickup Verification

```powershell
$startVerificationResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/start-verification" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body '{"latitude":32.7767,"longitude":-96.7970,"gpsAccuracy":10.5}'

Write-Host "`n=== Start Verification Response ===" -ForegroundColor Cyan
$startVerificationResponse | ConvertTo-Json -Depth 5

# Save verification ID for next steps
$verificationId = $startVerificationResponse.data.verification_id
Write-Host "`nVerification ID: $verificationId" -ForegroundColor Yellow
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verification_id": "uuid-here",
    "shipment_id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "status": "pending",
    "message": "Verification process started"
  }
}
```

---

## Step 5: Upload Verification Photos

```powershell
$photosBody = @{
    photos = @(
        @{
            url = "https://example.com/photos/front.jpg"
            angle = "front"
            timestamp = "2025-11-01T10:05:00Z"
        },
        @{
            url = "https://example.com/photos/left.jpg"
            angle = "left_side"
            timestamp = "2025-11-01T10:06:00Z"
        },
        @{
            url = "https://example.com/photos/right.jpg"
            angle = "right_side"
            timestamp = "2025-11-01T10:07:00Z"
        },
        @{
            url = "https://example.com/photos/back.jpg"
            angle = "back"
            timestamp = "2025-11-01T10:08:00Z"
        }
    )
} | ConvertTo-Json -Depth 5

$photosResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/verification-photos" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $photosBody

Write-Host "`n=== Upload Photos Response ===" -ForegroundColor Cyan
$photosResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verification_id": "uuid-here",
    "photo_count": 4,
    "message": "Photos uploaded successfully"
  }
}
```

---

## Step 6: Submit Verification (Vehicle Matches)

```powershell
$submitBody = @{
    verification_status = "matches"
    notes = "Vehicle condition matches description exactly. All details verified."
} | ConvertTo-Json

$submitResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/submit-verification" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $submitBody

Write-Host "`n=== Submit Verification Response ===" -ForegroundColor Cyan
$submitResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verification_id": "uuid-here",
    "shipment_id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "verification_status": "matches",
    "shipment_status": "pickup_verified",
    "message": "Verification submitted successfully"
  }
}
```

---

## Step 7: Get Verification Details

```powershell
$getVerificationResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/verification" `
    -Method GET `
    -Headers @{ "Authorization" = "Bearer $token" }

Write-Host "`n=== Get Verification Response ===" -ForegroundColor Cyan
$getVerificationResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "verification_id": "uuid-here",
    "shipment_id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "driver_id": "22222222-2222-2222-2222-222222222222",
    "verification_status": "matches",
    "driver_photos": [...],
    "verification_completed_at": "2025-11-01T10:10:00Z",
    "pickup_location": {...}
  }
}
```

---

## Step 8: Update Pickup Status (Mark as Picked Up)

```powershell
$pickupStatusBody = @{
    status = "picked_up"
} | ConvertTo-Json

$pickupStatusResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/pickup-status" `
    -Method PATCH `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $pickupStatusBody

Write-Host "`n=== Update Pickup Status Response ===" -ForegroundColor Cyan
$pickupStatusResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "status": "picked_up",
    "actual_pickup_time": "2025-11-01T10:15:00Z",
    "message": "Shipment status updated to picked_up"
  }
}
```

---

## Step 9: Test Cancellation Flow (Optional)

**First, reset the shipment again:**
```sql
UPDATE shipments SET status = 'driver_arrived' WHERE id = '2961b4a8-6727-4ce8-b103-86240afb91cc';
DELETE FROM pickup_verifications WHERE shipment_id = '2961b4a8-6727-4ce8-b103-86240afb91cc';
```

**Then test cancellation API:**
```powershell
$cancelBody = @{
    reason_category = "vehicle_mismatch"
    reason_description = "Vehicle has significant undisclosed damage"
    evidence_photos = @(
        @{
            url = "https://example.com/damage1.jpg"
            timestamp = "2025-11-01T10:20:00Z"
        }
    )
} | ConvertTo-Json -Depth 5

$cancelResponse = Invoke-RestMethod `
    -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/cancel-at-pickup" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token" } `
    -ContentType "application/json" `
    -Body $cancelBody

Write-Host "`n=== Cancellation Response ===" -ForegroundColor Cyan
$cancelResponse | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "cancellation_id": "uuid-here",
    "shipment_id": "2961b4a8-6727-4ce8-b103-86240afb91cc",
    "status": "cancelled",
    "refund_breakdown": {
      "client_refund": 856.34,
      "driver_compensation": 244.67,
      "platform_fee": 122.33
    },
    "message": "Shipment cancelled successfully"
  }
}
```

---

## Complete Test Script (Run All at Once)

```powershell
# Step 1: Login
Write-Host "`n========== STEP 1: LOGIN ==========" -ForegroundColor Magenta
$loginResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"driver@test.com","password":"Test123!"}'
$token = $loginResponse.token
Write-Host "✅ Login successful" -ForegroundColor Green

# Step 2: En Route
Write-Host "`n========== STEP 2: MARK EN ROUTE ==========" -ForegroundColor Magenta
$enRouteResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/driver-en-route" -Method POST -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json"
Write-Host "✅ Status: $($enRouteResponse.data.status)" -ForegroundColor Green

# Step 3: Arrived
Write-Host "`n========== STEP 3: MARK ARRIVED ==========" -ForegroundColor Magenta
$arrivedResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/driver-arrived" -Method POST -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"latitude":32.7767,"longitude":-96.7970}'
Write-Host "✅ Status: $($arrivedResponse.data.status)" -ForegroundColor Green

# Step 4: Start Verification
Write-Host "`n========== STEP 4: START VERIFICATION ==========" -ForegroundColor Magenta
$startVerificationResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/start-verification" -Method POST -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"latitude":32.7767,"longitude":-96.7970,"gpsAccuracy":10.5}'
Write-Host "✅ Verification started: $($startVerificationResponse.data.verification_id)" -ForegroundColor Green

# Step 5: Upload Photos
Write-Host "`n========== STEP 5: UPLOAD PHOTOS ==========" -ForegroundColor Magenta
$photosBody = @{photos=@(@{url="https://example.com/front.jpg";angle="front";timestamp="2025-11-01T10:05:00Z"},@{url="https://example.com/left.jpg";angle="left_side";timestamp="2025-11-01T10:06:00Z"},@{url="https://example.com/right.jpg";angle="right_side";timestamp="2025-11-01T10:07:00Z"},@{url="https://example.com/back.jpg";angle="back";timestamp="2025-11-01T10:08:00Z"})} | ConvertTo-Json -Depth 5
$photosResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/verification-photos" -Method POST -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json" -Body $photosBody
Write-Host "✅ Photos uploaded: $($photosResponse.data.photo_count)" -ForegroundColor Green

# Step 6: Submit Verification
Write-Host "`n========== STEP 6: SUBMIT VERIFICATION ==========" -ForegroundColor Magenta
$submitBody = @{verification_status="matches";notes="Vehicle matches description"} | ConvertTo-Json
$submitResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/submit-verification" -Method POST -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json" -Body $submitBody
Write-Host "✅ Verification status: $($submitResponse.data.verification_status)" -ForegroundColor Green

# Step 7: Get Verification
Write-Host "`n========== STEP 7: GET VERIFICATION ==========" -ForegroundColor Magenta
$getVerificationResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/verification" -Method GET -Headers @{ "Authorization" = "Bearer $token" }
Write-Host "✅ Retrieved verification data" -ForegroundColor Green
$getVerificationResponse.data | ConvertTo-Json -Depth 5

# Step 8: Mark as Picked Up
Write-Host "`n========== STEP 8: MARK PICKED UP ==========" -ForegroundColor Magenta
$pickupStatusBody = @{status="picked_up"} | ConvertTo-Json
$pickupStatusResponse = Invoke-RestMethod -Uri "https://drivedrop-main-production.up.railway.app/api/shipments/2961b4a8-6727-4ce8-b103-86240afb91cc/pickup-status" -Method PATCH -Headers @{ "Authorization" = "Bearer $token" } -ContentType "application/json" -Body $pickupStatusBody
Write-Host "✅ Final status: $($pickupStatusResponse.data.status)" -ForegroundColor Green

Write-Host "`n========== ALL TESTS COMPLETE ==========" -ForegroundColor Green
Write-Host "🎉 Phase 2 APIs working perfectly in production!" -ForegroundColor Cyan
```

---

## Test Results Checklist

- [ ] ✅ Step 1: Login successful, JWT token obtained
- [ ] ✅ Step 2: Driver marked en route
- [ ] ✅ Step 3: Driver marked arrived with GPS coordinates
- [ ] ✅ Step 4: Verification record created
- [ ] ✅ Step 5: Photos uploaded (4 photos)
- [ ] ✅ Step 6: Verification submitted (matches)
- [ ] ✅ Step 7: Verification details retrieved
- [ ] ✅ Step 8: Shipment marked as picked_up
- [ ] ✅ Step 9: Cancellation flow works (optional)

---

## Success Criteria

All endpoints should return:
- ✅ `"success": true`
- ✅ Proper status codes (200 for success)
- ✅ Expected data structures
- ✅ Database updated correctly

---

## 🚀 Ready to Test!

Copy and paste the **Complete Test Script** into your PowerShell terminal to run all Phase 2 API tests in sequence!
