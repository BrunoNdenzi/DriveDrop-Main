# Driver Pickup Verification & Cancellation Policy

**Status:** Production-Ready Implementation Plan
**Priority:** CRITICAL - Prevents disputes & fraud
**Date:** October 29, 2025

---

## 🔴 Critical Gap Identified

### **Problem:**
- Clients upload photos during booking
- Driver accepts job based on those photos
- **NO VERIFICATION** when driver arrives at pickup
- Driver has no recourse if vehicle doesn't match
- No clear cancellation/refund policy for mismatches

### **Risks:**
- Disputes: "Car was damaged before I got it"
- Fraud: Fake photos submitted by client
- Driver losses: Wasted time/fuel with no compensation
- Legal liability: Unclear damage responsibility

---

## ✅ Industry Best Practices

### **How Top Platforms Handle This:**

| Platform | Pickup Verification | Mismatch Policy |
|----------|-------------------|-----------------|
| **uShip** | Both parties sign BOL | 24hr cancellation, partial refund |
| **Uber Freight** | Photo verification required | Inspection period, dispute resolution |
| **Ship a Car Direct** | Driver documents on arrival | Cancellation fees apply |
| **Montway Auto** | Condition report signed | Photos from both sides |

---

## 🎯 Recommended Solution

### **Multi-Stage Verification System**

```
Client Books → Driver Accepts → DRIVER ARRIVES → NEW VERIFICATION STEP → Proceed/Cancel
```

---

## 📱 Implementation: Driver Pickup Verification Flow

### **New Screen: `DriverPickupVerificationScreen`**

**When:** Driver arrives at pickup location
**Trigger:** Driver clicks "I've Arrived" button
**Required:** BEFORE shipment can start

### **Verification Steps:**

#### **Step 1: Location Confirmation**
```typescript
- GPS verification (within 100m of pickup address)
- Manual override if GPS inaccurate
- Timestamp recorded
```

#### **Step 2: Vehicle Photo Capture** (MANDATORY)
```typescript
Required Photos (6 minimum):
1. Front view (full vehicle)
2. Rear view (full vehicle)
3. Driver side (full profile)
4. Passenger side (full profile)
5. Interior front (dashboard/seats)
6. Odometer reading

Optional Photos:
7-12. Any existing damage/concerns
```

#### **Step 3: Photo Comparison Mode** (NEW FEATURE)
```typescript
Interface:
┌─────────────────────────────────────┐
│  Client's Original Photo            │
│  (Uploaded at booking)              │
├─────────────────────────────────────┤
│  Your Photo                         │
│  (Just taken)                       │
├─────────────────────────────────────┤
│  Does this match? ▼                 │
│  ○ Yes - Matches                    │
│  ○ Minor Differences                │
│  ○ Major Issues - Cannot Proceed    │
└─────────────────────────────────────┘
```

#### **Step 4: Driver Decision**

**Option A: ✅ "Confirmed - Matches Photos"**
```
Action: Proceed with shipment
Payment: Normal flow (90% driver, 10% platform)
Photos: Stored for delivery comparison
```

**Option B: ⚠️ "Minor Differences - Need Client Approval"**
```
Examples:
- Small scratch not in original photos
- Tire looks flatter than photo
- Minor dent noticed

Flow:
1. Driver documents differences (text + photos)
2. Client gets push notification
3. Client has 5 minutes to respond:
   - Accept: "Proceed anyway" → Shipment continues
   - Dispute: "This is different" → Enter cancellation flow
4. If no response in 5 min → Auto-escalate to platform
```

**Option C: ❌ "Major Issues - Cannot Proceed"**
```
Examples:
- Vehicle not drivable (client said it was)
- Significant undisclosed damage
- Wrong vehicle entirely
- Safety hazards
- Vehicle not present

Flow:
1. Driver selects reason from dropdown
2. Driver uploads evidence photos
3. Automatic cancellation initiated
4. Payment split applied
```

---

## 💰 Payment & Refund Policy (Production-Ready)

### **Current System:**
```javascript
Booking Deposit: 20% charged immediately
Remaining: 80% pre-authorized (charged on delivery)
Platform Fee: 10% of total
Driver Earnings: 90% of total
```

### **NEW: Cancellation Policy Matrix**

| **Scenario** | **Timing** | **Client Refund** | **Driver Compensation** | **Platform Fee** |
|---|---|---|---|---|
| **Client cancels** | Before driver accepts | 95% | 0% | 5% |
| **Client cancels** | After driver accepts, before arrival | 80% | 10% | 10% |
| **Driver cancels** | Before arrival (no fault) | 90% | 0% | 10% |
| **Driver arrives - Minor mismatch, client declines** | At pickup | 75% | 15% | 10% |
| **Driver arrives - Major mismatch (verified)** | At pickup | 70% | 20% | 10% |
| **Driver arrives - Client fraud (proven)** | At pickup | 0% | 40% | 60% |
| **After pickup started** | In transit | 0% | 100% | 0% |

### **Detailed Breakdown:**

#### **Scenario 1: Major Mismatch - Vehicle Condition Issues**
```
Original Booking: $500
Platform Commission: $50 (10%)
Driver Expected: $450 (90%)

Driver Cancels at Pickup (Vehicle Mismatch):
├── Client Refund: $350 (70%)
├── Driver Compensation: $100 (20%) ← For wasted time/fuel
└── Platform Keeps: $50 (10%) ← Processing/admin costs

Reasoning:
✅ Driver compensated for wasted trip (avg 1-2 hours + fuel)
✅ Client gets most money back (not fully penalized)
✅ Platform covers payment processing + dispute handling
✅ Fair to both parties
```

#### **Scenario 2: Client Fraud - Fake Photos / Wrong Vehicle**
```
Original Booking: $500

Admin Verifies Fraud (after driver evidence):
├── Client Refund: $0 (0%) ← Penalty for fraud
├── Driver Compensation: $200 (40%) ← Higher compensation
└── Platform Keeps: $300 (60%) ← Fraud handling + penalty

Reasoning:
✅ Strong deterrent against fraud
✅ Driver compensated for significant time loss
✅ Platform covers investigation + legal protection
✅ Client banned from platform
```

#### **Scenario 3: Minor Differences - Client Approves**
```
Original Booking: $500

Shipment Proceeds with Documentation:
├── Normal payment flow continues
├── Driver photos stored as "pickup condition"
├── Delivery photos compared to pickup photos (not client's original)
├── Protects both parties from delivery disputes
```

---

## 🔧 Technical Implementation

### **Database Changes Required**

#### **1. New Table: `pickup_verifications`**

```sql
CREATE TABLE pickup_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  
  -- Location Data
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address_verified BOOLEAN NOT NULL,
  gps_accuracy_meters NUMERIC,
  
  -- Photos
  driver_photos JSONB NOT NULL, -- Array of photo URLs
  client_photos_reference JSONB NOT NULL, -- Original client photos
  
  -- Verification Decision
  verification_status TEXT NOT NULL, -- 'matches', 'minor_differences', 'major_issues'
  differences_description TEXT,
  cannot_proceed_reason TEXT,
  
  -- Client Response (if minor differences)
  client_notified_at TIMESTAMPTZ,
  client_response TEXT, -- 'approved', 'disputed', 'no_response'
  client_responded_at TIMESTAMPTZ,
  
  -- Timestamps
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_completed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT pickup_verifications_shipment_unique UNIQUE(shipment_id)
);

CREATE INDEX idx_pickup_verifications_shipment ON pickup_verifications(shipment_id);
CREATE INDEX idx_pickup_verifications_driver ON pickup_verifications(driver_id);
```

#### **2. Update `shipments` Table**

```sql
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS driver_arrival_time TIMESTAMPTZ;
```

#### **3. New Table: `cancellation_records`**

```sql
CREATE TABLE cancellation_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  cancelled_by UUID NOT NULL REFERENCES profiles(id), -- driver or client
  cancellation_type TEXT NOT NULL, -- 'before_pickup', 'at_pickup_mismatch', 'at_pickup_fraud'
  
  -- Reason & Evidence
  reason_category TEXT NOT NULL, -- 'vehicle_mismatch', 'not_drivable', 'safety_concern', 'fraud', etc.
  reason_description TEXT NOT NULL,
  evidence_photos JSONB, -- Array of photo URLs
  
  -- Financial
  original_amount NUMERIC NOT NULL,
  client_refund_amount NUMERIC NOT NULL,
  driver_compensation_amount NUMERIC NOT NULL,
  platform_fee_amount NUMERIC NOT NULL,
  refund_processed BOOLEAN DEFAULT FALSE,
  refund_processed_at TIMESTAMPTZ,
  
  -- Review
  admin_reviewed BOOLEAN DEFAULT FALSE,
  admin_reviewer_id UUID REFERENCES profiles(id),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  fraud_confirmed BOOLEAN,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cancellation_amounts_match CHECK (
    original_amount = client_refund_amount + driver_compensation_amount + platform_fee_amount
  )
);

CREATE INDEX idx_cancellation_records_shipment ON cancellation_records(shipment_id);
CREATE INDEX idx_cancellation_records_cancelled_by ON cancellation_records(cancelled_by);
CREATE INDEX idx_cancellation_records_admin_review ON cancellation_records(admin_reviewed, created_at);
```

---

## 📱 Mobile App UI Components

### **Component 1: `DriverPickupVerificationScreen.tsx`**

**Location:** `mobile/src/screens/driver/DriverPickupVerificationScreen.tsx`

**Features:**
- GPS location verification
- Camera integration for 6+ photos
- Side-by-side photo comparison
- Radio button selection (Matches / Minor / Major Issues)
- Conditional text input for descriptions
- Evidence photo upload
- Submit/Cancel buttons

### **Component 2: `PhotoComparisonView.tsx`**

**Reusable component for comparing photos:**
```tsx
<PhotoComparisonView
  originalPhoto={clientPhoto}
  currentPhoto={driverPhoto}
  label="Front View"
/>
```

### **Component 3: `ClientPickupAlertModal.tsx`**

**Shown to client when driver reports minor differences:**
- Shows driver's concerns
- Displays comparison photos
- 5-minute countdown timer
- "Approve" / "Dispute" buttons

---

## 🔄 Complete Workflow Diagram

```
┌──────────────────────────────────────────────────┐
│ 1. Client Books & Uploads Photos                │
│    └─ Payment: 20% charged, 80% pre-authorized  │
└────────────────┬─────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────┐
│ 2. Driver Accepts Job                           │
│    └─ Views client photos                        │
└────────────────┬─────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────┐
│ 3. Driver Arrives at Pickup                     │
│    └─ Clicks "I've Arrived"                      │
└────────────────┬─────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────┐
│ 4. PICKUP VERIFICATION REQUIRED                  │
│    ├─ GPS verification                           │
│    ├─ Take 6+ photos                             │
│    └─ Compare with client photos                 │
└────────────────┬─────────────────────────────────┘
                 ▼
         ┌───────┴────────┐
         ▼                ▼
┌─────────────────┐  ┌──────────────────┐
│ ✅ Matches      │  │ ⚠️ Issues Found  │
└────┬────────────┘  └─────┬────────────┘
     ▼                     ▼
     │              ┌──────┴───────┐
     │              ▼              ▼
     │     ┌────────────────┐  ┌─────────────────┐
     │     │ Minor Diffs    │  │ Major Issues    │
     │     └───┬────────────┘  └────┬────────────┘
     │         ▼                     ▼
     │   ┌──────────────┐      ┌────────────────┐
     │   │ Notify Client│      │ Cancel Shipment│
     │   └───┬──────────┘      └────┬───────────┘
     │       ▼                       ▼
     │  Client Decision         Payment Split:
     │  ┌──┴───┐                - Client: 70%
     │  ▼      ▼                - Driver: 20%
     │ Approve Dispute          - Platform: 10%
     │  │      │
     │  │      └───► Cancel & Refund
     │  ▼
     └──┴─────────────────► PROCEED WITH SHIPMENT
                            (Normal payment flow)
```

---

## 🚨 Fraud Detection & Prevention

### **Red Flags System**

Track these indicators:

```javascript
const fraudIndicators = {
  // Account-level
  accountAge: 'less than 30 days',
  previousCancellations: 'more than 2',
  
  // Booking-level
  photoQuality: 'low resolution or stock photos',
  priceDiscrepancy: 'quoted much lower than market',
  urgencyPatterns: 'always "urgent" shipments',
  
  // Behavior
  multiplePhoneNumbers: 'different numbers for same account',
  unusualBookingTimes: '2-4 AM bookings',
  paymentIssues: 'multiple declined cards',
};
```

### **Automatic Fraud Score**

```javascript
fraudScore = {
  low: 0-30,    // Normal processing
  medium: 31-60, // Manual review
  high: 61-100,  // Hold deposit, require verification
};
```

---

## 📊 Admin Dashboard Features

### **New Section: "Pickup Disputes"**

**Filters:**
- Status: Pending Review / Reviewed / Fraud Confirmed
- Date Range
- Amount Range
- Driver/Client ID

**Details View:**
- Side-by-side photo comparison
- Driver's statement
- Client's response (if any)
- Payment breakdown
- Action buttons:
  - Approve Driver's Assessment
  - Approve Client's Dispute
  - Mark as Fraud (ban user)
  - Request More Evidence

---

## 💼 Legal & Terms Updates

### **Updated Terms of Service**

**Section: "Cancellation Policy"**

```
4.1 Pre-Pickup Cancellation
- Client may cancel before driver arrives: 80% refund
- Driver may cancel before arrival: No penalty to driver

4.2 At-Pickup Verification
- Driver is required to verify vehicle condition upon arrival
- Driver may refuse shipment if vehicle condition differs significantly 
  from photos provided at booking
- Client will be notified of discrepancies and given 5 minutes to respond

4.3 Pickup Cancellation Fees
- Vehicle Mismatch (verified): Client receives 70% refund, 
  Driver receives 20% compensation
- Client Fraud (proven): No refund, Driver receives 40% compensation
- See full breakdown in Cancellation Policy Matrix

4.4 Evidence Requirements
- All cancellations must include photo evidence
- Platform reserves right to review and make final decision
- Fraudulent claims may result in account suspension
```

---

## 📅 Implementation Timeline

### **Phase 1: Database & API (Week 1)**
- [ ] Create `pickup_verifications` table
- [ ] Create `cancellation_records` table
- [ ] Update `shipments` table
- [ ] API endpoints:
  - `POST /api/shipments/:id/pickup-verification`
  - `POST /api/shipments/:id/cancel-at-pickup`
  - `PATCH /api/shipments/:id/client-pickup-response`

### **Phase 2: Mobile UI (Week 2)**
- [ ] `DriverPickupVerificationScreen`
- [ ] `PhotoComparisonView` component
- [ ] `ClientPickupAlertModal`
- [ ] Update driver shipment screen (add "I've Arrived" button)
- [ ] Push notifications for client alerts

### **Phase 3: Payment Integration (Week 3)**
- [ ] Stripe refund logic for cancellations
- [ ] Split payment calculations
- [ ] Automated refund processing
- [ ] Driver compensation payments

### **Phase 4: Admin Dashboard (Week 4)**
- [ ] Pickup Disputes section
- [ ] Photo comparison view
- [ ] Review/approval workflow
- [ ] Fraud detection flagging

### **Phase 5: Testing & Launch (Week 5)**
- [ ] End-to-end testing with test accounts
- [ ] Edge case testing (GPS issues, no response, etc.)
- [ ] Terms of Service updates
- [ ] User communication (email about new policy)
- [ ] Soft launch with selected drivers
- [ ] Monitor first 50 verifications
- [ ] Full rollout

---

## ✅ Success Metrics

Track these KPIs:

```javascript
const metrics = {
  // Dispute Prevention
  verificationCompletionRate: 'Target: 98%+',
  matchRate: 'Baseline: TBD (track first month)',
  minorDifferencesRate: 'Expected: 5-10%',
  majorIssuesRate: 'Expected: 1-3%',
  
  // Client Satisfaction
  clientResponseTime: 'Target: < 3 minutes average',
  clientApprovalRate: 'Expected: 70%+ of minor differences',
  
  // Fraud Detection
  fraudCasesIdentified: 'Track monthly',
  falsePositiveRate: 'Target: < 2%',
  
  // Financial
  avgDriverCompensationPerCancellation: 'Track',
  totalRefundsIssued: 'Track monthly',
  disputeResolutionTime: 'Target: < 24 hours',
};
```

---

## 🎓 Driver Training Materials

### **Required Training Module: "Pickup Verification"**

**Topics:**
1. Why verification is important
2. How to take quality photos
3. When to report minor vs major issues
4. How payment works if you cancel
5. Fraud detection (help us spot fake bookings)

**Quiz at end (must pass to access feature)**

---

## 📱 Push Notifications

### **New Notification Types:**

```javascript
// To Driver
"You're close! Remember to complete pickup verification before starting."

// To Client (minor differences)
"⚠️ Your driver has noticed minor differences. Please review and respond within 5 minutes."

// To Client (cancellation)
"Your shipment has been cancelled at pickup. Refund processing."

// To Both (admin decision)
"Your pickup dispute has been reviewed. See details in app."
```

---

## 🔐 Privacy & Data Storage

**Photo Storage:**
- Store in Supabase Storage
- Retention: 90 days after delivery
- Client can request deletion after 90 days
- Encrypted at rest
- Access logged for audit trail

**PII Protection:**
- Driver can't see client's full address until arrived
- Client photos watermarked with booking ID
- GPS data anonymized after 30 days

---

## ⚖️ Dispute Resolution Process

```
Driver Cancels → Auto-refund → Client disputes refund amount?
                                  ↓
                              Admin Review
                         ┌──────┴───────┐
                         ▼              ▼
                   Approve Driver   Approve Client
                         │              │
                         ▼              ▼
                    Refund stands   Adjust refund
                                    + compensate driver less
```

---

## 🎯 Summary

This comprehensive system:

✅ Protects drivers from fraud/waste
✅ Protects clients from unfair cancellations
✅ Clear, fair refund policy
✅ Evidence-based dispute resolution
✅ Industry-standard best practices
✅ Production-ready implementation plan

**Estimated Implementation:** 5 weeks
**Estimated Cost:** Developer time only (no new services)
**Risk Mitigation:** Prevents costly disputes & chargebacks

---

**Ready to begin implementation?** Start with Phase 1 (Database & API).
