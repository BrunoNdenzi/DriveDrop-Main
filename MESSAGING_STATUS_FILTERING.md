# Messaging Conversations Filtering

## Overview
The conversations list now only shows shipments with **active or completed** statuses to keep the messaging interface clean and relevant.

---

## Filtered Statuses

### ✅ Shown (Active/Completed Shipments)
- **`picked_up`** - Driver has picked up the vehicle
- **`in_transit`** - Vehicle is being transported
- **`delivered`** - Vehicle has been delivered (for follow-up questions)

### ❌ Hidden (Inactive Shipments)
- **`pending`** - Not yet accepted by driver (no conversation needed)
- **`accepted`** - Accepted but not picked up yet (not active)
- **`cancelled`** - Cancelled shipments (no longer relevant)

---

## Why This Filtering?

### 1. **Pending Shipments**
- No driver assigned yet (or driver not accepted)
- Can't have meaningful conversations without a driver
- These show up in "Available Shipments" for drivers

### 2. **Accepted Shipments**
- Driver accepted but hasn't picked up yet
- Coordination happens through shipment details/notifications
- Messaging becomes relevant once pickup happens

### 3. **Cancelled Shipments**
- Job is no longer active
- Historical messages not relevant
- Keeps conversation list clean

---

## Implementation

### Code Change
File: `mobile/src/screens/ConversationsScreen.tsx`

```typescript
const { data, error: queryError } = await supabase
  .from('conversation_summaries')
  .select('*')
  .in('shipment_status', ['picked_up', 'in_transit', 'delivered'])
  .order('last_message_at', { ascending: false, nullsFirst: false });
```

### How It Works
- Uses Supabase `.in()` filter on `shipment_status` column
- Only fetches conversations matching the allowed statuses
- Filters at database level (efficient, no extra data transferred)
- Automatically updates as shipment statuses change

---

## User Experience

### For Clients
**Before**: 
- Sees conversations for all shipments, including pending ones with no driver
- Confusing to see "No Driver Assigned" in messages

**After**:
- Only sees conversations for active shipments
- Clear, actionable conversation list
- Can message driver once pickup happens

### For Drivers
**Before**:
- Sees accepted but not-yet-active shipments in messages
- Mixed with actual active conversations

**After**:
- Only sees conversations for shipments they're actively working on
- Cleaner, more focused messaging interface
- Past deliveries accessible for follow-up

---

## Status Lifecycle & Messaging

```
pending → accepted → picked_up → in_transit → delivered
   ❌        ❌          ✅           ✅          ✅
(not shown) (hidden)  (shown)     (shown)    (shown)
```

### When Conversations Appear

| Event | Status Change | Messaging Enabled |
|-------|--------------|-------------------|
| Shipment created | → pending | ❌ No (no driver) |
| Driver accepts | pending → accepted | ❌ Not yet (not active) |
| Driver picks up | accepted → picked_up | ✅ YES - appears in list |
| Vehicle in transit | picked_up → in_transit | ✅ YES - stays in list |
| Vehicle delivered | in_transit → delivered | ✅ YES - kept for follow-up |
| Shipment cancelled | any → cancelled | ❌ Removed from list |

---

## Edge Cases Handled

### 1. Delivered Shipments
**Decision**: Keep in conversation list
**Reason**: Client may need to contact driver after delivery for questions, items left behind, ratings, etc.

**Optional Enhancement**: Could add a toggle to "Hide Completed" conversations if list gets too long.

### 2. Real-time Updates
When a shipment status changes:
- Real-time subscription triggers `loadConversations()`
- Conversation automatically appears/disappears based on new status
- No manual refresh needed

### 3. Empty State
If no active shipments:
- Shows "No active conversations" message
- Users see this until they have a picked_up/in_transit/delivered shipment
- Not an error state, just means no active work

---

## Future Enhancements (Optional)

### 1. Add Filter Toggle
Allow users to show/hide completed (delivered) shipments:
```typescript
const [showCompleted, setShowCompleted] = useState(true);

const statuses = showCompleted 
  ? ['picked_up', 'in_transit', 'delivered']
  : ['picked_up', 'in_transit'];
```

### 2. Archive Delivered After 7 Days
Auto-hide delivered shipments after 1 week:
```typescript
.in('shipment_status', ['picked_up', 'in_transit', 'delivered'])
.or(`shipment_status.neq.delivered,created_at.gte.${sevenDaysAgo}`)
```

### 3. Status-Based Sections
Group conversations by status:
- **Active Now** (picked_up, in_transit)
- **Recently Delivered** (delivered)

### 4. Add Accepted Pre-Pickup Chat
If coordination is needed before pickup, could add `accepted` to filter and show a badge "Not picked up yet"

---

## Testing Checklist

- [ ] Pending shipments don't appear in conversations
- [ ] Accepted (not picked up) shipments don't appear
- [ ] Cancelled shipments disappear from list
- [ ] Picked up shipments appear immediately
- [ ] In-transit shipments remain visible
- [ ] Delivered shipments stay in list
- [ ] Real-time updates work correctly
- [ ] Empty state shows when no active shipments
- [ ] Status badges still show correct colors

---

## Related Files

- **Implementation**: `mobile/src/screens/ConversationsScreen.tsx`
- **SQL View**: `sql/MESSAGING_SYSTEM_FRESH_START.sql` (conversation_summaries)
- **Status Constants**: Check your shipment status enum/constants file

---

## Notes

- Database filtering is more efficient than client-side filtering
- No changes needed to SQL schema or RLS policies
- Backward compatible - doesn't break existing functionality
- Can easily adjust filter criteria by changing the `.in()` array

---

**Last Updated**: October 16, 2025
**Status**: ✅ Implemented & Ready to Test
