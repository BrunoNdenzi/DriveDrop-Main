# 📊 Visual Diagrams - Pickup Verification System

---

## 1. Complete Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHIPMENT LIFECYCLE                           │
└─────────────────────────────────────────────────────────────────┘

CLIENT BOOKS SHIPMENT
         │
         ▼
    ┌─────────┐
    │ PENDING │ ← Waiting for driver
    └────┬────┘
         │
         │ Driver accepts OR Admin assigns
         │
         ▼
    ┌──────────┐
    │ ACCEPTED │ ← Driver assigned
    └────┬─────┘
         │
         │ Driver clicks "Start Trip"
         │
         ▼
┌──────────────────┐
│ DRIVER_EN_ROUTE  │ ← GPS tracking active
└────────┬─────────┘
         │
         │ Driver clicks "I've Arrived" + GPS check (≤100m)
         │
         ▼
┌──────────────────┐
│ DRIVER_ARRIVED   │ ← Driver at location
└────────┬─────────┘
         │
         │ Driver clicks "Start Verification"
         │
         ▼
┌────────────────────────────────┐
│ PICKUP_VERIFICATION_PENDING    │ ← Taking photos (6 minimum)
└────────────┬───────────────────┘
             │
             │ Driver submits decision
             │
        ┌────┴────────────┐
        │                 │
        ▼                 ▼
    ✅ MATCHES      ⚠️ MINOR         ❌ MAJOR
        │           DIFFERENCES       ISSUES
        │                │              │
        │           ┌────┴────┐        │
        │           ▼         ▼         │
        │      CLIENT     CLIENT       │
        │      APPROVES   DISPUTES     │
        │           │         │         │
        │           │         └─────────┤
        │           │                   │
        │           │              ┌────▼────┐
        │           │              │CANCELLED│
        │           │              └─────────┘
        │           │              Refund: 70%
        └───────────┴──────┐
                           ▼
                   ┌──────────────────┐
                   │ PICKUP_VERIFIED  │ ← Ready to load
                   └────────┬─────────┘
                            │
                            │ Driver clicks "Mark as Picked Up"
                            │
                            ▼
                     ┌─────────────┐
                     │ PICKED_UP   │ ← Vehicle loaded & secured
                     └──────┬──────┘
                            │
                            │ Driver clicks "Start Delivery"
                            │
                            ▼
                     ┌──────────────┐
                     │  IN_TRANSIT  │ ← Active delivery
                     └──────┬───────┘
                            │
                            │ Driver uploads delivery photos
                            │
                            ▼
                     ┌─────────────┐
                     │  DELIVERED  │ ← Payment released
                     └─────────────┘
```

---

## 2. Verification Decision Tree

```
┌────────────────────────────────────────────────────────────────┐
│         DRIVER COMPLETES PHOTO COMPARISON                       │
└────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │ SELECT DECISION │
                  └────────┬────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  ✅ MATCHES  │ │ ⚠️ MINOR     │ │ ❌ MAJOR     │
    │              │ │ DIFFERENCES  │ │ ISSUES       │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           │                │                │
           ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │Auto-approve  │ │Alert client  │ │Auto-cancel   │
    │              │ │              │ │              │
    │Status:       │ │5-min timer   │ │Status:       │
    │pickup_       │ │starts        │ │cancelled     │
    │verified      │ │              │ │              │
    └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
           │                │                │
           │           ┌────┴────┐          │
           │           ▼         ▼           │
           │      ┌─────────┐ ┌─────────┐  │
           │      │APPROVED │ │DISPUTED │  │
           │      └────┬────┘ └────┬────┘  │
           │           │           │        │
           │           │           └────────┤
           │           │                    │
           ▼           ▼                    ▼
    ┌─────────────────────────────┐ ┌─────────────────┐
    │     PROCEED WITH PICKUP      │ │   CANCELLED     │
    │                              │ │                 │
    │ • Driver loads vehicle       │ │ • Refund client │
    │ • Marks as "picked_up"       │ │ • Pay driver    │
    │ • Starts delivery            │ │ • Close shipment│
    └──────────────────────────────┘ └─────────────────┘
```

---

## 3. GPS Verification Flow

```
┌────────────────────────────────────────────────────────────────┐
│                 DRIVER ARRIVAL VERIFICATION                     │
└────────────────────────────────────────────────────────────────┘

   Driver clicks "I've Arrived"
           │
           ▼
   ┌────────────────┐
   │ Get GPS coords │
   │ lat, lng, acc  │
   └───────┬────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Get pickup address  │
   │ coordinates from DB │
   └──────────┬──────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Calculate distance     │
   │ using Haversine formula│
   └──────────┬─────────────┘
              │
              ▼
        ┌─────┴─────┐
        │ Distance? │
        └─────┬─────┘
              │
      ┌───────┴────────┐
      │                │
      ▼                ▼
   ≤ 100m          > 100m
      │                │
      ▼                ▼
   ┌─────────┐    ┌─────────────────────────┐
   │ SUCCESS │    │ ERROR                   │
   │         │    │ "You must be within     │
   │ Update  │    │ 100 meters. Current:    │
   │ status  │    │ 250m"                   │
   │ to      │    │                         │
   │ driver_ │    │ Retry allowed           │
   │ arrived │    └─────────────────────────┘
   └────┬────┘
        │
        ▼
   ┌─────────────────────┐
   │ Set driver_arrival_ │
   │ time to NOW()       │
   └──────────┬──────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Send notification to   │
   │ client: "Driver has    │
   │ arrived"               │
   └────────────────────────┘
```

---

## 4. Photo Upload Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    PHOTO UPLOAD PROCESS                         │
└────────────────────────────────────────────────────────────────┘

   Driver takes photo
           │
           ▼
   ┌────────────────┐
   │ Select angle   │
   │ (front, rear,  │
   │  side, etc.)   │
   └───────┬────────┘
           │
           ▼
   ┌────────────────────┐
   │ Validate image     │
   │ • Size < 5MB       │
   │ • Type: jpg/png    │
   │ • Angle required   │
   └──────────┬─────────┘
              │
              ▼
        ┌─────┴─────┐
        │  Valid?   │
        └─────┬─────┘
              │
      ┌───────┴────────┐
      │                │
      ▼                ▼
    YES              NO
      │                │
      │                ▼
      │        ┌─────────────┐
      │        │ Show error  │
      │        │ • Size limit│
      │        │ • Invalid   │
      │        │   type      │
      │        └─────────────┘
      │
      ▼
   ┌────────────────────────┐
   │ Upload to Supabase     │
   │ Storage                │
   │                        │
   │ Path: pickup-          │
   │ verifications/         │
   │ {verificationId}/      │
   │ {angle}_{timestamp}.jpg│
   └──────────┬─────────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Get public URL         │
   └──────────┬─────────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Update verification    │
   │ record                 │
   │ • Add photo to JSONB   │
   │ • Increment photo_count│
   │ • Save GPS coords      │
   │ • Save timestamp       │
   └──────────┬─────────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Update UI              │
   │ • Show thumbnail       │
   │ • Update progress:     │
   │   "3 of 6 photos"      │
   │ • Enable submit if ≥6  │
   └────────────────────────┘
```

---

## 5. Refund Calculation Matrix

```
┌────────────────────────────────────────────────────────────────┐
│                   CANCELLATION SCENARIOS                        │
└────────────────────────────────────────────────────────────────┘

Original Amount: $500.00

┌─────────────────────────┬──────────┬─────────┬──────────┐
│ Cancellation Type       │  Client  │ Driver  │ Platform │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ Before Acceptance       │ $500 100%│  $0  0% │  $0   0% │
│                         │  ████████│         │          │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ After Accept,           │ $400  80%│ $50 10% │ $50  10% │
│ Before Pickup           │  ██████  │  █      │  █       │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ At Pickup - Mismatch    │ $350  70%│$100 20% │ $50  10% │
│                         │  █████   │  ██     │  █       │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ At Pickup - FRAUD       │   $0   0%│$200 40% │$300  60% │
│ ⚠️ Confirmed Fraud      │          │  ████   │  ██████  │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ During Transit          │ $250  50%│$200 40% │ $50  10% │
│                         │  ████    │  ████   │  █       │
├─────────────────────────┼──────────┼─────────┼──────────┤
│ Force Majeure           │ $450  90%│ $25  5% │ $25   5% │
│ (Weather, emergency)    │  ███████ │  █      │  █       │
└─────────────────────────┴──────────┴─────────┴──────────┘
```

---

## 6. Client Response Timeline

```
┌────────────────────────────────────────────────────────────────┐
│         CLIENT NOTIFICATION & RESPONSE TIMELINE                 │
└────────────────────────────────────────────────────────────────┘

Driver finds minor differences
           │
           ▼
   ┌────────────────────┐
   │ Push notification  │ ← Instant
   │ SMS alert          │ ← Within 10 seconds
   │ Email              │ ← Within 1 minute
   └──────────┬─────────┘
              │
              ▼
        ┌─────────┐
        │ 5:00    │ ← Timer starts
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ 4:00    │
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ 3:00    │ ← Reminder notification
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ 2:00    │
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ 1:00    │ ← Final warning
        └────┬────┘
             │
             ▼
        ┌─────────┐
        │ 0:00    │ ← Time's up
        └────┬────┘
             │
      ┌──────┴───────┐
      │              │
      ▼              ▼
 CLIENT          NO RESPONSE
 RESPONDED
      │              │
      │              ▼
      │      ┌──────────────┐
      │      │AUTO-APPROVE  │
      │      │              │
      │      │"Client did   │
      │      │not respond   │
      │      │within 5 min" │
      │      └──────┬───────┘
      │             │
      └─────────────┴─────────┐
                              ▼
                      ┌──────────────┐
                      │PICKUP_VERIFIED│
                      └───────────────┘
```

---

## 7. Database Relationships

```
┌────────────────────────────────────────────────────────────────┐
│                   DATABASE SCHEMA DIAGRAM                       │
└────────────────────────────────────────────────────────────────┘

┌──────────────┐           ┌──────────────────────┐
│   profiles   │           │      shipments       │
│──────────────│           │──────────────────────│
│ id (PK)      │◄─────────│ client_id (FK)       │
│ email        │           │ driver_id (FK)       │
│ role         │     ┌────►│ id (PK)              │
│ ...          │     │     │ status               │
└──────────────┘     │     │ pickup_address       │
                     │     │ pickup_lat/lng       │
                     │     │ driver_arrival_time  │
                     │     │ pickup_verified      │
                     │     │ pickup_verified_at   │
                     │     │ actual_pickup_time   │
                     │     │ cancellation_record_id│
                     │     │ ...                  │
                     │     └────────┬─────────────┘
                     │              │
                     │              │ 1:1
        ┌────────────┴──────┐       │
        │                   │       ▼
        │         ┌─────────────────────────────┐
        │         │   pickup_verifications      │
        │         │─────────────────────────────│
        │         │ id (PK)                     │
        │         │ shipment_id (FK)            │
        │         │ driver_id (FK)              │
        │         │ driver_photos (JSONB[])     │
        │         │ photo_count                 │
        │         │ decision                    │
        │         │ differences (JSONB[])       │
        │         │ driver_notes                │
        │         │ verification_location       │
        │         │ distance_from_pickup_meters │
        │         │ client_response             │
        │         │ client_notes                │
        │         │ client_responded_at         │
        │         │ status                      │
        │         │ verification_completed_at   │
        │         │ ...                         │
        │         └─────────────┬───────────────┘
        │                       │
        │                       │ 1:1
        │                       │
        │                       ▼
        │         ┌─────────────────────────────┐
        └────────►│   cancellation_records      │
                  │─────────────────────────────│
                  │ id (PK)                     │
                  │ shipment_id (FK)            │
                  │ pickup_verification_id (FK) │
                  │ initiated_by                │
                  │ initiator_id                │
                  │ cancellation_type           │
                  │ reason                      │
                  │ fraud_confirmed             │
                  │ original_amount             │
                  │ refund_to_client            │
                  │ compensation_to_driver      │
                  │ platform_fee                │
                  │ processing_fee              │
                  │ refund_status               │
                  │ refund_processed_at         │
                  │ stripe_refund_id            │
                  │ stripe_transfer_id          │
                  │ evidence_urls               │
                  │ ...                         │
                  └─────────────────────────────┘
```

---

## 8. Mobile UI Component Tree

```
┌────────────────────────────────────────────────────────────────┐
│                  MOBILE APP COMPONENT STRUCTURE                 │
└────────────────────────────────────────────────────────────────┘

DriverApp
├── DriverShipmentsScreen
│   ├── ShipmentCard (status-based display)
│   └── FilterTabs
│
├── DriverShipmentDetailScreen
│   ├── StatusBadge
│   ├── ShipmentInfo
│   ├── ActionButtons (status-based)
│   │   ├── "Start Trip" (if accepted)
│   │   ├── "I've Arrived" (if en_route)
│   │   ├── "Start Verification" (if arrived)
│   │   ├── "Mark Picked Up" (if verified)
│   │   └── "Start Delivery" (if picked_up)
│   ├── MapView (if en_route or in_transit)
│   └── ClientContactButtons
│
├── DriverPickupVerificationScreen ⭐ NEW
│   ├── Header
│   │   ├── Progress: "3 of 6 photos"
│   │   └── Timer (optional)
│   ├── CameraView
│   │   ├── Camera preview
│   │   ├── Capture button
│   │   └── Photo angle selector
│   ├── PhotoGallery
│   │   ├── Thumbnail grid
│   │   ├── Required angles checklist
│   │   └── "View comparison" button
│   ├── ComparisonView ⭐ NEW
│   │   ├── Split screen
│   │   │   ├── Client photo (left)
│   │   │   └── Driver photo (right)
│   │   ├── Angle selector tabs
│   │   ├── Zoom controls
│   │   └── "Mark difference" button
│   ├── DifferencesForm (if issues found)
│   │   ├── Difference type selector
│   │   ├── Severity (minor/major)
│   │   ├── Description textarea
│   │   └── Affected area
│   ├── DecisionSelector ⭐ NEW
│   │   ├── ✅ Matches card
│   │   ├── ⚠️ Minor Differences card
│   │   └── ❌ Major Issues card
│   └── SubmitButton (enabled if ≥6 photos)
│
└── VerificationStatusScreen
    ├── Status indicator
    ├── Client response wait (if minor)
    └── Next steps instructions

ClientApp
├── ClientShipmentsScreen
│   ├── ShipmentCard
│   └── FilterTabs
│
├── ClientShipmentTrackingScreen
│   ├── StatusTimeline
│   ├── MapView (if driver en_route or in_transit)
│   ├── ETADisplay
│   ├── DriverInfoCard
│   ├── ContactButtons
│   └── StatusSpecificViews
│       ├── WaitingForDriver (if pending/accepted)
│       ├── DriverEnRoute (if en_route)
│       ├── DriverArrived (if arrived)
│       ├── VerificationInProgress (if pending)
│       └── ReadyForPickup (if verified)
│
├── ClientPickupAlertModal ⭐ NEW
│   ├── Header: "⚠️ Verification Issue"
│   ├── ComparisonView
│   │   ├── Client photo
│   │   ├── Driver photo
│   │   └── Swipe to compare angles
│   ├── DifferencesList
│   │   ├── Issue type
│   │   ├── Severity badge
│   │   ├── Description
│   │   └── Photos
│   ├── CountdownTimer: "4:32 remaining"
│   ├── RefundCalculator: "$350 (70%) if cancelled"
│   └── ActionButtons
│       ├── "Approve Pickup" (green)
│       └── "Cancel & Get Refund" (red)
│
└── VerificationResultScreen
    ├── Result badge (✅/⚠️/❌)
    ├── Summary
    └── Next steps
```

---

## 9. Notification Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION TRIGGERS                       │
└────────────────────────────────────────────────────────────────┘

Status Change Event
        │
        ▼
┌──────────────────┐
│ Detect status    │
│ change in        │
│ database         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ Get shipment data    │
│ • Client ID          │
│ • Driver ID          │
│ • Status             │
│ • Details            │
└────────┬─────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Determine recipients        │
│ • Client? → Most statuses   │
│ • Driver? → Some statuses   │
│ • Admin? → Fraud, issues    │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Select notification channels         │
│                                      │
│ High Priority (SMS + Push + Email): │
│ • driver_arrived                     │
│ • minor_differences_found            │
│ • cancelled                          │
│                                      │
│ Medium Priority (Push + Email):      │
│ • accepted                           │
│ • driver_en_route                    │
│ • pickup_verified                    │
│ • picked_up                          │
│ • delivered                          │
│                                      │
│ Low Priority (Push only):            │
│ • pickup_verification_pending        │
│ • in_transit                         │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Send Push Notif    │────▶│   Send SMS       │────▶│  Send Email  │
│                      │     │  (if critical)   │     │  (if needed) │
│ • Title              │     │                  │     │              │
│ • Body               │     │ • Phone number   │     │ • Template   │
│ • Data payload       │     │ • Message        │     │ • Variables  │
│ • Badge count        │     │ • Link           │     │ • CTA button │
└──────────────────────┘     └──────────────────┘     └──────────────┘
         │                            │                        │
         └────────────────────────────┴────────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │ Log notification │
                            │ in database      │
                            │ • Sent at        │
                            │ • Delivered      │
                            │ • Opened         │
                            └──────────────────┘
```

---

**Save these diagrams for reference during development!** 📊
