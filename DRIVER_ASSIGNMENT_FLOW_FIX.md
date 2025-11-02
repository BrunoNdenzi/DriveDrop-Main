# Driver Assignment Flow - Fixed & Enhanced

## Date: November 1, 2025

---

## Problem Identified

When an admin assigns a driver to a shipment, the status is set to **`assigned`**, not **`accepted`**. The driver UI was missing the intermediate "Accept Job" step, causing drivers to bypass the entire pickup verification flow.

**Symptoms:**
- Driver couldn't see "Start Trip" or "Start Verification" buttons
- Status jumped from `assigned` → `picked_up` (skipping verification steps)
- Pickup verification system never activated

---

## Solution Implemented

### 1. Added "Accept Job" Action for Assigned Shipments

**File:** `mobile/src/screens/driver/ShipmentDetailsScreen.tsx`

**Changes:**
- Added `'assigned'` case in `getNextStatusAction()`:
  ```typescript
  case 'assigned':
    return {
      label: 'Accept Job',
      status: 'accepted',
      icon: 'check-circle',
      color: Colors.info,
      requiresAccept: true,
    };
  ```

- Added handler in `handleNextAction()` to call the database RPC:
  ```typescript
  if (nextAction.requiresAccept) {
    if (!shipment?.id) {
      Alert.alert('Error', 'Shipment ID is missing.');
      return;
    }
    
    const { data, error } = await supabase.rpc('accept_shipment', { 
      shipment_id: shipment.id 
    });
    
    if (error) throw error;
    Alert.alert('Accepted', 'You have accepted the shipment. You may now Start Trip.');
    fetchShipmentDetails();
  }
  ```

**What it does:**
- Calls the existing `accept_shipment` database function
- Updates shipment status: `assigned` → `accepted`
- Sets `driver_id` in the database
- Creates a tracking event for the acceptance
- Refreshes the screen to show the next action ("Start Trip")

---

### 2. Added Visual Banner for Assigned Shipments

**UI Enhancement:**
Added a prominent blue banner at the top of the shipment details screen when status is `assigned`:

```typescript
{shipment.status === 'assigned' && (
  <View style={styles.assignedBanner}>
    <MaterialIcons name="info" size={24} color={Colors.info} />
    <View style={styles.bannerTextContainer}>
      <Text style={styles.bannerTitle}>Job Assigned to You!</Text>
      <Text style={styles.bannerText}>
        An admin has assigned this shipment to you. Please review the 
        details and tap "Accept Job" below to begin.
      </Text>
    </View>
  </View>
)}
```

**Banner Styling:**
- Light blue background (`Colors.info + '15'`)
- Blue border (`Colors.info`)
- Info icon on the left
- Clear title and instructions
- Appears above the shipment header
- Matches app design system (12px border radius, consistent padding)

---

## Complete Flow Now

### Admin Side:
1. **Create Shipment** (status: `pending`)
2. **Assign Driver** (status: `assigned`)

### Driver Side:
1. **Open Assigned Shipment** → See blue "Job Assigned to You!" banner
2. **Tap "Accept Job"** → Calls `accept_shipment` RPC → Status: `accepted`
3. **Tap "Start Trip"** → GPS tracked → Status: `driver_en_route`
4. **Tap "I've Arrived"** → GPS verified (100m) → Status: `driver_arrived`
5. **Tap "Start Verification"** → Opens camera screen → Status: `pickup_verification_pending`
6. **Capture 6 Photos** → Front, Back, Left, Right, Interior, Dashboard
7. **Select Decision** → Matches / Minor Differences / Major Issues
8. **Submit Verification** → Status: `pickup_verified`
9. **Tap "Mark as Picked Up"** → Status: `picked_up`
10. **Tap "Start Transit"** → GPS tracked → Status: `in_transit`
11. **Tap "Mark as Delivered"** → Status: `delivered`

---

## Testing Steps

### Quick Test (Complete Flow):

1. **Client Side:**
   - Create a new shipment
   - Note the shipment ID

2. **Admin Side:**
   - Go to Admin Assignment screen
   - Find the pending shipment
   - Assign it to a driver
   - Verify status shows "ASSIGNED"

3. **Driver Side:**
   - Refresh "My Shipments" if needed
   - Open the assigned shipment
   - **Verify:** Blue banner appears at top saying "Job Assigned to You!"
   - **Verify:** "Accept Job" button shows at bottom
   - Tap "Accept Job"
   - **Verify:** Alert shows "You have accepted the shipment. You may now Start Trip."
   - **Verify:** Button changes to "Start Trip"
   - Tap "Start Trip" → GPS location captured → Status: `driver_en_route`
   - Tap "I've Arrived" → GPS verified → Status: `driver_arrived`
   - **Tap "Start Verification"** → **Camera screen opens** ← THIS IS THE NEW FEATURE
   - Capture 6 photos (one for each angle)
   - **Verify:** Progress shows "6 of 6 required photos"
   - Select a decision (Matches / Minor Differences / Major Issues)
   - Tap "Submit Verification"
   - **Verify:** Photos upload and verification submits
   - Continue with "Mark as Picked Up" → "Start Transit" → etc.

4. **Client Side (if Minor Differences):**
   - Open the shipment
   - **Verify:** Verification progress card shows
   - **Verify:** Modal appears if minor differences found
   - Review photos in the modal
   - Tap "Approve & Continue" or "Dispute & Cancel"

---

## Files Modified

1. **mobile/src/screens/driver/ShipmentDetailsScreen.tsx**
   - Added `'assigned'` case to `getNextStatusAction()`
   - Added `requiresAccept` handling in `handleNextAction()`
   - Added visual banner for assigned shipments
   - Added banner styles: `assignedBanner`, `bannerTextContainer`, `bannerTitle`, `bannerText`
   - Fixed TypeScript error (shipment?.id guard)

---

## Database Function Used

**Function:** `accept_shipment(shipment_id UUID)`

**Location:** `supabase/migrations/03_functions_and_triggers.sql`

**What it does:**
- Verifies the current user is a driver
- Updates shipment:
  - Sets `driver_id` to the current user
  - Changes `status` to `'accepted'`
  - Updates `updated_at` timestamp
- Creates a tracking event with type `'accepted'`
- Returns the updated shipment

**Security:** Uses `SECURITY DEFINER` and checks `auth.uid()` for driver role

---

## Alternative Options (If Needed)

### Option A: Auto-Accept on Admin Assignment
If you want to skip the driver acceptance step entirely:

**Change:** Update `assignDriverToShipment` in backend to set status to `'accepted'` instead of `'assigned'`

**Pros:**
- Driver immediately sees "Start Trip" button
- One less step in the flow

**Cons:**
- Driver doesn't explicitly accept the job
- No acceptance tracking event
- Less driver control

### Option B: Show Warning if Driver Skips Accept
Add validation to prevent drivers from manually changing status without accepting.

---

## UI Preview

```
┌─────────────────────────────────────────────────┐
│  ℹ️  Job Assigned to You!                       │
│                                                  │
│  An admin has assigned this shipment to you.   │
│  Please review the details and tap "Accept      │
│  Job" below to begin.                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Vehicle Transport        [ASSIGNED]            │
└─────────────────────────────────────────────────┘

Customer Information
👤 John Doe
📞 (555) 123-4567  📞

Pickup Details
📍 Pickup Location  🗺️
123 Main St...

...

┌─────────────────────────────────────────────────┐
│            ✓ Accept Job                         │
└─────────────────────────────────────────────────┘
```

After accepting:
```
┌─────────────────────────────────────────────────┐
│  Vehicle Transport        [ACCEPTED]            │
└─────────────────────────────────────────────────┘

...

┌─────────────────────────────────────────────────┐
│            🚚 Start Trip                         │
└─────────────────────────────────────────────────┘
```

---

## Status Reference

| Status | Display Name | Next Action | Required |
|--------|-------------|-------------|----------|
| `assigned` | ASSIGNED | Accept Job | RPC call |
| `accepted` | ACCEPTED | Start Trip | GPS |
| `driver_en_route` | DRIVER EN ROUTE | I've Arrived | GPS |
| `driver_arrived` | DRIVER ARRIVED | Start Verification | Navigate |
| `pickup_verification_pending` | PICKUP VERIFICATION PENDING | (capturing photos) | Camera |
| `pickup_verified` | PICKUP VERIFIED | Mark as Picked Up | None |
| `picked_up` | PICKED UP | Start Transit | GPS |
| `in_transit` | IN TRANSIT | Mark as Delivered | None |
| `delivered` | DELIVERED | (complete) | - |

---

## Success Criteria

✅ **Fixed:**
- TypeScript error on line 234 (shipment?.id undefined)
- Driver can now accept assigned jobs
- Visual banner guides drivers through acceptance

✅ **Enhanced:**
- Clear visual feedback for assigned shipments
- Professional blue info banner with icon
- Helpful instructions for drivers
- Consistent with app design system

✅ **Ready for Testing:**
- Complete flow from client → admin → driver
- All Phase 3 verification features accessible
- No TypeScript errors

---

## Next Steps

1. **Test the complete flow** as outlined in the Testing Steps section
2. **Verify the banner** appears and looks good on your device
3. **Confirm GPS permissions** work properly
4. **Test the camera screen** opens when you tap "Start Verification"
5. **Capture and submit photos** to ensure backend integration works
6. **Report any issues** you encounter during testing

---

## Notes

- The banner only shows when status is exactly `'assigned'`
- It disappears immediately after accepting the job
- The `accept_shipment` RPC is atomic and handles all necessary updates
- All verification features from Phase 3 are now accessible through the proper flow
- The flow matches industry-standard acceptance patterns (Uber, DoorDash, etc.)

---

**Status:** ✅ READY FOR TESTING
**Testing Required:** YES
**Breaking Changes:** NO
**Database Changes:** NO (uses existing function)
