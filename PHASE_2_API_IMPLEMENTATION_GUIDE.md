# Phase 2: API Endpoints Implementation Guide

**Duration:** 1 week  
**Priority:** HIGH  
**Dependencies:** Phase 1 database migration must be applied first

---

## 🎯 Objectives

Create Express.js/Supabase Edge Functions to handle:
- Driver status updates (en route, arrived, picked up, in transit)
- Pickup verification workflow
- Photo uploads to Supabase Storage
- Client responses to verification
- Cancellation processing with Stripe refunds
- Push notifications

---

## 📁 File Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── pickupVerification.ts          ← NEW
│   ├── controllers/
│   │   └── PickupVerificationController.ts ← NEW
│   ├── services/
│   │   ├── PickupVerificationService.ts    ← NEW
│   │   ├── NotificationService.ts          ← UPDATE
│   │   └── StripeService.ts                ← UPDATE
│   ├── middleware/
│   │   ├── auth.ts                         ← EXISTING
│   │   └── validateStatus.ts               ← NEW
│   └── types/
│       └── pickupVerification.ts           ← NEW
```

---

## 🛣️ API Endpoints to Create

### 1. Driver Status Updates

#### **POST /api/shipments/:id/driver-en-route**

**Purpose:** Mark driver as en route to pickup location

**Request:**
```typescript
{
  location: {
    lat: number;
    lng: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  shipment: {
    id: string;
    status: 'driver_en_route';
    updated_at: string;
  }
}
```

**Logic:**
1. Verify authenticated user is the assigned driver
2. Verify current status is 'accepted'
3. Call `update_shipment_status_safe('driver_en_route')`
4. Send push notification to client with ETA
5. Return updated shipment

**Notifications:**
- Client: "Your driver is on the way! ETA: X minutes"

---

#### **POST /api/shipments/:id/driver-arrived**

**Purpose:** Mark driver as arrived at pickup (GPS verified)

**Request:**
```typescript
{
  location: {
    lat: number;
    lng: number;
    accuracy: number;  // meters
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  shipment: {
    id: string;
    status: 'driver_arrived';
    driver_arrival_time: string;
  }
}
```

**Logic:**
1. Verify authenticated user is the assigned driver
2. Verify current status is 'driver_en_route'
3. Get shipment pickup coordinates (pickup_lat, pickup_lng)
4. Calculate distance using Haversine formula
5. **ENFORCE:** Distance must be ≤100 meters
6. If > 100m, return error: "You must be within 100 meters of pickup location. Current distance: Xm"
7. Call `update_shipment_status_safe('driver_arrived')`
8. Update `driver_arrival_time` to NOW()
9. Send push notification to client
10. Return updated shipment

**Error Handling:**
```typescript
if (distance > 100) {
  return {
    success: false,
    error: 'GPS_VERIFICATION_FAILED',
    message: `You must be within 100 meters of pickup location. Current distance: ${Math.round(distance)}m`,
    distance: distance,
    requiredDistance: 100
  }
}
```

**Notifications:**
- Client: "Your driver has arrived at the pickup location"
- Driver: "You may now start the pickup verification"

---

### 2. Pickup Verification Workflow

#### **POST /api/shipments/:id/start-verification**

**Purpose:** Initialize pickup verification process

**Request:**
```typescript
{
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  verification: {
    id: string;
    shipment_id: string;
    driver_id: string;
    status: 'pending';
    photo_count: 0;
    required_photos: ['front', 'rear', 'driver_side', 'passenger_side', 'front_driver_quarter', 'front_passenger_quarter'];
    created_at: string;
  }
}
```

**Logic:**
1. Verify authenticated user is the assigned driver
2. Verify current status is 'driver_arrived'
3. Call `update_shipment_status_safe('pickup_verification_pending')`
4. Insert into `pickup_verifications` table:
   ```sql
   INSERT INTO pickup_verifications (
     shipment_id,
     driver_id,
     verification_location,
     status
   ) VALUES (...)
   ```
5. Return verification record
6. Send push notification to client

**Notifications:**
- Client: "Driver is verifying vehicle condition..."

---

#### **POST /api/shipments/:id/verification-photos**

**Purpose:** Upload verification photo

**Request:** Multipart form data
```typescript
{
  verificationId: string;
  angle: PhotoAngle;  // 'front', 'rear', etc.
  photo: File;  // Image file
  location: {
    lat: number;
    lng: number;
  }
}
```

**Response:**
```typescript
{
  success: boolean;
  photo: {
    id: string;
    url: string;  // Public URL
    angle: 'front';
    timestamp: string;
    location: { lat, lng };
  },
  verification: {
    id: string;
    photo_count: number;
    photos_remaining: ['rear', 'driver_side', ...];
  }
}
```

**Logic:**
1. Verify authenticated user is the driver for this verification
2. Validate image (size <5MB, type: jpg/png)
3. Generate unique filename: `{verificationId}/{angle}_{timestamp}.jpg`
4. Upload to Supabase Storage:
   ```typescript
   const { data, error } = await supabase.storage
     .from('shipment-photos')
     .upload(`pickup-verifications/${filename}`, fileBuffer, {
       contentType: 'image/jpeg',
       upsert: false
     });
   ```
5. Get public URL
6. Update `pickup_verifications.driver_photos` JSONB array:
   ```typescript
   const photoData = {
     id: generateId(),
     url: publicUrl,
     angle: angle,
     timestamp: new Date().toISOString(),
     location: { lat, lng }
   };
   
   UPDATE pickup_verifications
   SET driver_photos = driver_photos || jsonb_build_array(photoData),
       photo_count = photo_count + 1
   WHERE id = verificationId;
   ```
7. Return photo data and updated verification
8. If photo_count >= 6, allow submission

**Error Handling:**
- Image too large: "Photo must be under 5MB"
- Invalid angle: "Photo angle must be one of: front, rear, ..."
- Duplicate angle: "Photo for {angle} already uploaded. Delete first to replace."
- Upload failed: "Failed to upload photo. Please try again."

---

#### **POST /api/shipments/:id/submit-verification**

**Purpose:** Submit completed verification with decision

**Request:**
```typescript
{
  verificationId: string;
  decision: 'matches' | 'minor_differences' | 'major_issues';
  differences?: [
    {
      type: 'new_damage' | 'missing_item' | ...;
      severity: 'minor' | 'major';
      description: string;
      affectedArea: string;
      driverPhoto?: string;  // URL
      clientPhoto?: string;  // URL
    }
  ];
  driverNotes?: string;
  location: { lat, lng };
}
```

**Response:**
```typescript
{
  success: boolean;
  verification: {
    id: string;
    decision: 'matches';
    status: 'approved_by_client';
    verification_completed_at: string;
  },
  shipment: {
    id: string;
    status: 'pickup_verified';  // or 'cancelled' if major issues
  },
  nextAction: 'mark_picked_up' | 'wait_for_client' | 'cancelled';
}
```

**Logic:**
1. Verify authenticated user is the driver
2. Verify photo_count >= 6
3. Calculate distance from pickup
4. Update verification record:
   ```sql
   UPDATE pickup_verifications
   SET decision = p_decision,
       differences = p_differences,
       driver_notes = p_driver_notes,
       distance_from_pickup_meters = p_distance,
       verification_completed_at = NOW()
   WHERE id = verificationId;
   ```
5. **Handle decision:**

   **A. If decision = 'matches':**
   - Call `update_shipment_status_safe('pickup_verified')`
   - Update `pickup_verified = TRUE`, `pickup_verified_at = NOW()`
   - Set `verification.status = 'approved_by_client'`
   - Return `nextAction: 'mark_picked_up'`
   - Send notification: "✅ Vehicle verified! Driver is loading."

   **B. If decision = 'minor_differences':**
   - Keep status as 'pickup_verification_pending'
   - Set `verification.status = 'pending'`
   - Send push notification to client with photos
   - Send SMS to client (high priority)
   - Start 5-minute timer
   - Return `nextAction: 'wait_for_client'`
   - Notification: "⚠️ Your driver noticed minor differences. Please review within 5 minutes."

   **C. If decision = 'major_issues':**
   - Call cancellation endpoint internally
   - Create cancellation record (type: at_pickup_mismatch)
   - Calculate refund (70% client, 20% driver, 10% platform)
   - Process Stripe refund
   - Update shipment status to 'cancelled'
   - Return `nextAction: 'cancelled'`
   - Notification: "❌ Shipment cancelled due to major vehicle issues. Refund: $X"

6. Return verification and shipment data

**Error Handling:**
- Photo count < 6: "Minimum 6 photos required"
- Invalid decision: "Decision must be: matches, minor_differences, or major_issues"
- No differences provided for minor/major: "Differences required when issues found"

---

#### **POST /api/shipments/:id/client-response**

**Purpose:** Client approves or disputes minor differences

**Request:**
```typescript
{
  verificationId: string;
  response: 'approved' | 'disputed';
  notes?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  verification: {
    id: string;
    client_response: 'approved';
    client_responded_at: string;
    status: 'approved_by_client';
  },
  shipment: {
    id: string;
    status: 'pickup_verified';  // or 'cancelled' if disputed
  }
}
```

**Logic:**
1. Verify authenticated user is the client (shipment.client_id)
2. Verify verification exists and has minor_differences
3. Update verification:
   ```sql
   UPDATE pickup_verifications
   SET client_response = p_response,
       client_notes = p_notes,
       client_responded_at = NOW(),
       status = CASE 
         WHEN p_response = 'approved' THEN 'approved_by_client'
         ELSE 'disputed_by_client'
       END
   WHERE id = verificationId;
   ```
4. **If approved:**
   - Call `update_shipment_status_safe('pickup_verified')`
   - Update shipment pickup_verified fields
   - Notification to driver: "Client approved pickup. Proceed with loading."
   
5. **If disputed:**
   - Call cancellation endpoint
   - Create cancellation record (type: at_pickup_mismatch)
   - Calculate refund (70% client, 20% driver, 10% platform)
   - Process Stripe refund
   - Update shipment status to 'cancelled'
   - Notification to driver: "Client disputed verification. Shipment cancelled."

6. Return updated verification and shipment

**5-Minute Timer Logic:**
- If client doesn't respond within 5 minutes, auto-approve
- Implement via cron job or scheduled function:
  ```sql
  -- Find pending responses > 5 minutes
  SELECT * FROM pickup_verifications
  WHERE status = 'pending'
    AND decision = 'minor_differences'
    AND verification_completed_at < NOW() - INTERVAL '5 minutes'
    AND client_response IS NULL;
  
  -- Auto-approve them
  UPDATE pickup_verifications
  SET client_response = 'approved',
      status = 'approved_by_client',
      client_notes = 'Auto-approved - no response within 5 minutes'
  WHERE id IN (above query);
  ```

**Notifications:**
- Driver (approved): "✅ Client approved pickup. Load vehicle."
- Driver (disputed): "❌ Client disputed. Shipment cancelled. Compensation: $X"

---

#### **POST /api/shipments/:id/cancel-at-pickup**

**Purpose:** Cancel shipment at pickup (mismatch or fraud)

**Request:**
```typescript
{
  cancellationType: 'at_pickup_mismatch' | 'at_pickup_fraud';
  reason: string;
  pickupVerificationId?: string;
  evidenceUrls?: string[];
  fraudConfirmed?: boolean;
}
```

**Response:**
```typescript
{
  success: boolean;
  cancellation: {
    id: string;
    shipment_id: string;
    cancellation_type: 'at_pickup_mismatch';
    refund_to_client: 350.00;
    compensation_to_driver: 100.00;
    platform_fee: 50.00;
    refund_status: 'processing';
  },
  shipment: {
    id: string;
    status: 'cancelled';
  }
}
```

**Logic:**
1. Verify authenticated user is driver, client, or admin
2. Get shipment payment details
3. Call database function:
   ```sql
   SELECT * FROM calculate_cancellation_refund(
     p_original_amount := shipment.estimated_price,
     p_cancellation_type := request.cancellationType,
     p_fraud_confirmed := request.fraudConfirmed
   );
   ```
4. Create cancellation record:
   ```sql
   INSERT INTO cancellation_records (
     shipment_id,
     initiated_by,
     initiator_id,
     cancellation_type,
     reason,
     fraud_confirmed,
     original_amount,
     refund_to_client,
     compensation_to_driver,
     platform_fee,
     refund_status,
     pickup_verification_id,
     evidence_urls
   ) VALUES (...);
   ```
5. **Process Stripe refund:**
   ```typescript
   // Get payment intent from shipment
   const paymentIntent = shipment.stripe_payment_intent_id;
   
   // Refund to client
   if (refundData.refund_to_client > 0) {
     const refund = await stripe.refunds.create({
       payment_intent: paymentIntent,
       amount: Math.round(refundData.refund_to_client * 100), // cents
       reason: 'requested_by_customer',
       metadata: {
         shipment_id: shipmentId,
         cancellation_id: cancellation.id,
         cancellation_type: request.cancellationType
       }
     });
     
     // Update cancellation with Stripe refund ID
     UPDATE cancellation_records
     SET stripe_refund_id = refund.id,
         refund_status = 'processing'
     WHERE id = cancellation.id;
   }
   
   // Transfer to driver
   if (refundData.compensation_to_driver > 0) {
     const transfer = await stripe.transfers.create({
       amount: Math.round(refundData.compensation_to_driver * 100),
       currency: 'usd',
       destination: driver.stripe_account_id,
       metadata: {
         shipment_id: shipmentId,
         cancellation_id: cancellation.id,
         type: 'cancellation_compensation'
       }
     });
     
     // Update with transfer ID
     UPDATE cancellation_records
     SET stripe_transfer_id = transfer.id
     WHERE id = cancellation.id;
   }
   ```
6. Update shipment status to 'cancelled':
   ```sql
   UPDATE shipments
   SET status = 'cancelled',
       cancellation_record_id = cancellation.id,
       updated_at = NOW()
   WHERE id = shipmentId;
   ```
7. Send notifications to both parties
8. If fraud, escalate to admin for review
9. Return cancellation record

**Notifications:**
- Client: "Shipment cancelled. Refund of $X will be processed within 5-10 business days."
- Driver: "Shipment cancelled. Compensation of $X has been transferred."
- Admin (if fraud): "Fraud alert: Shipment {id} cancelled. Review required."

**Error Handling:**
- Stripe refund failed: Mark refund_status = 'failed', notify admin
- Invalid cancellation type: Return error
- Already cancelled: Return error

---

### 3. Simple Status Updates

#### **PATCH /api/shipments/:id/status**

**Purpose:** Generic status update (picked_up, in_transit, delivered)

**Request:**
```typescript
{
  status: 'picked_up' | 'in_transit' | 'delivered';
  notes?: string;
  location?: { lat, lng };
  deliveryPhotos?: string[];  // URLs if delivered
}
```

**Response:**
```typescript
{
  success: boolean;
  shipment: {
    id: string;
    status: 'picked_up';
    updated_at: string;
  }
}
```

**Logic:**
1. Verify authenticated user is the assigned driver
2. Validate status transition using `is_valid_status_transition()`
3. Call `update_shipment_status_safe()`
4. Update relevant timestamp column:
   - picked_up → actual_pickup_time
   - delivered → actual_delivery_time
5. If delivered, require delivery photos (minimum 3)
6. Send appropriate notification
7. Return updated shipment

**Notifications:**
- picked_up → Client: "Your vehicle is loaded and secured!"
- in_transit → Client: "Your vehicle is in transit. Track progress."
- delivered → Client: "🎉 Your vehicle has been delivered!"

---

## 🔔 Notification Service Updates

### Add to NotificationService.ts

```typescript
export class NotificationService {
  /**
   * Send verification alert to client (minor differences found)
   */
  static async sendVerificationAlert(
    clientId: string,
    shipmentId: string,
    verificationId: string,
    differences: VerificationDifference[]
  ): Promise<void> {
    // Push notification
    await this.sendPushNotification(clientId, {
      title: '⚠️ Verification Issue',
      body: 'Your driver noticed minor differences. Please review within 5 minutes.',
      data: {
        type: 'verification_alert',
        shipmentId,
        verificationId,
        action: 'open_verification_review'
      }
    });
    
    // SMS (high priority)
    await this.sendSMS(clientId, 
      `DriveDrop: Your driver found minor vehicle differences for shipment ${shipmentId}. ` +
      `Please respond within 5 minutes: [Link]`
    );
    
    // Email
    await this.sendEmail(clientId, {
      subject: 'Action Required: Vehicle Verification',
      template: 'verification_alert',
      data: {
        shipmentId,
        verificationId,
        differences,
        expiresIn: '5 minutes'
      }
    });
  }
  
  /**
   * Send cancellation notification
   */
  static async sendCancellationNotification(
    userId: string,
    role: 'client' | 'driver',
    cancellation: CancellationRecord
  ): Promise<void> {
    const amount = role === 'client' 
      ? cancellation.refund_to_client 
      : cancellation.compensation_to_driver;
    
    await this.sendPushNotification(userId, {
      title: 'Shipment Cancelled',
      body: role === 'client'
        ? `Your refund of $${amount} is being processed.`
        : `Your compensation of $${amount} has been transferred.`,
      data: {
        type: 'cancellation',
        shipmentId: cancellation.shipment_id,
        cancellationId: cancellation.id
      }
    });
  }
  
  /**
   * Send status change notification
   */
  static async sendStatusChangeNotification(
    userId: string,
    role: 'client' | 'driver',
    shipment: Shipment,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    const messages = {
      driver_en_route: {
        client: 'Your driver is on the way! ETA: 30 minutes',
        driver: 'Navigate to pickup location'
      },
      driver_arrived: {
        client: 'Your driver has arrived',
        driver: 'Complete pickup verification to proceed'
      },
      pickup_verified: {
        client: '✅ Vehicle verified! Driver is loading now.',
        driver: 'Load vehicle and mark as picked up'
      },
      picked_up: {
        client: 'Your vehicle is loaded and secured!',
        driver: 'Start delivery when ready'
      },
      in_transit: {
        client: 'Your vehicle is in transit',
        driver: 'Safe travels!'
      },
      delivered: {
        client: '🎉 Your vehicle has been delivered!',
        driver: 'Delivery complete! Payment released.'
      }
    };
    
    const message = messages[newStatus]?.[role];
    if (!message) return;
    
    await this.sendPushNotification(userId, {
      title: `Shipment Update`,
      body: message,
      data: {
        type: 'status_change',
        shipmentId: shipment.id,
        oldStatus,
        newStatus
      }
    });
  }
}
```

---

## 🔒 Middleware

### validateStatus.ts (New)

```typescript
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

/**
 * Validate status transition before allowing update
 */
export async function validateStatusTransition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id: shipmentId } = req.params;
    const { status: newStatus } = req.body;
    const userId = req.user.id;
    
    // Get current shipment status
    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('status, driver_id')
      .eq('id', shipmentId)
      .single();
    
    if (error || !shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    // Check if user is the assigned driver (for driver-only statuses)
    const driverOnlyStatuses = [
      'driver_en_route',
      'driver_arrived',
      'pickup_verification_pending',
      'pickup_verified',
      'picked_up',
      'in_transit',
      'delivered'
    ];
    
    if (driverOnlyStatuses.includes(newStatus) && shipment.driver_id !== userId) {
      return res.status(403).json({ 
        error: 'Only the assigned driver can update this status' 
      });
    }
    
    // Validate transition using database function
    const { data: isValid, error: validationError } = await supabase
      .rpc('is_valid_status_transition', {
        p_current_status: shipment.status,
        p_new_status: newStatus
      })
      .single();
    
    if (validationError || !isValid) {
      return res.status(400).json({
        error: 'Invalid status transition',
        currentStatus: shipment.status,
        attemptedStatus: newStatus,
        message: `Cannot transition from ${shipment.status} to ${newStatus}`
      });
    }
    
    // Attach shipment to request for next middleware
    req.shipment = shipment;
    next();
  } catch (error) {
    console.error('Status validation error:', error);
    res.status(500).json({ error: 'Status validation failed' });
  }
}
```

---

## 🧪 Testing Checklist

### API Tests

- [ ] POST /driver-en-route
  - ✓ Success with valid driver
  - ✓ Fail if not assigned driver
  - ✓ Fail if wrong status
  - ✓ Notification sent to client

- [ ] POST /driver-arrived
  - ✓ Success when within 100m
  - ✓ Fail when > 100m with distance message
  - ✓ Fail if wrong status
  - ✓ driver_arrival_time set correctly

- [ ] POST /start-verification
  - ✓ Creates verification record
  - ✓ Updates status to pickup_verification_pending
  - ✓ Returns required photo list

- [ ] POST /verification-photos
  - ✓ Uploads to Supabase Storage
  - ✓ Returns public URL
  - ✓ Updates photo_count
  - ✓ Fails if file too large
  - ✓ Fails if duplicate angle

- [ ] POST /submit-verification
  - ✓ Matches → auto-approve → pickup_verified
  - ✓ Minor → alert client → wait
  - ✓ Major → cancel → refund
  - ✓ Fails if < 6 photos

- [ ] POST /client-response
  - ✓ Approved → pickup_verified
  - ✓ Disputed → cancelled → refund
  - ✓ Only client can respond
  - ✓ 5-minute auto-approve works

- [ ] POST /cancel-at-pickup
  - ✓ Calculates refund correctly (70/20/10)
  - ✓ Processes Stripe refund
  - ✓ Creates cancellation record
  - ✓ Updates shipment status

### Integration Tests

- [ ] Full flow: accepted → en_route → arrived → verification → pickup → transit → delivered
- [ ] Cancellation flow: verification → major issues → cancelled → refund
- [ ] Client approval flow: minor → client approved → pickup_verified
- [ ] Client dispute flow: minor → client disputed → cancelled
- [ ] GPS blocking: driver 200m away cannot mark arrived
- [ ] Photo requirement: cannot submit with < 6 photos
- [ ] 5-minute timer: auto-approve after timeout

---

## 📦 Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.38.0",
    "stripe": "^14.0.0",
    "expo-notifications": "^0.27.0",
    "expo-location": "^17.0.0",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.0"
  }
}
```

---

## 🚀 Deployment Steps

1. **Apply database migration:**
   ```sql
   -- Run in Supabase SQL Editor
   -- File: backend/scripts/01_pickup_verification_schema.sql
   ```

2. **Deploy API endpoints:**
   ```bash
   cd backend
   npm install
   npm run build
   npm run deploy
   ```

3. **Test endpoints:**
   ```bash
   npm run test:api
   ```

4. **Deploy Stripe webhooks:**
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```

5. **Configure push notifications:**
   - Update Expo credentials
   - Test FCM/APNs delivery

---

## ✅ Phase 2 Complete Checklist

- [ ] 8 API endpoints created
- [ ] Middleware for validation
- [ ] Notification service updated
- [ ] Stripe refund processing
- [ ] GPS verification logic
- [ ] Photo upload to Storage
- [ ] Status transition validation
- [ ] 5-minute auto-approve cron
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] API documentation updated
- [ ] Postman collection created

---

**Ready to start coding?** Begin with the routes file and work through each endpoint! 🚀
