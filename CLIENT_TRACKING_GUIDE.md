# Client Shipment Tracking - Quick Guide

## How Clients Track Their Shipments

### 📱 4 Ways to Access Tracking

---

## 1. Dashboard - Quick Overview
**URL:** `/dashboard/client`

**What You See:**
- Recent 5 shipments with status badges
- Active deliveries count (FIXED ✅)
- Total and completed shipments
- Total money spent

**Actions:**
- Click any recent shipment → Goes to details page (FIXED ✅)
- Click "View All" → Goes to My Shipments page

---

## 2. My Shipments - Full List
**URL:** `/dashboard/client/shipments`

**What You See:**
- Complete list of all your shipments
- Tabbed filtering:
  - **Pending Tab:** Awaiting driver assignment
  - **Active Tab:** All 9 active delivery statuses (FIXED ✅)
  - **Past Tab:** Delivered, completed, or cancelled
- Search by vehicle, address, or ID
- Stats cards showing counts per category

**Each Shipment Card Shows:**
- Vehicle information (year, make, model)
- Pickup and delivery addresses
- Status badge with color coding
- Price estimate
- Created date
- Driver assignment status
- "Message" button (if driver assigned)
- "View Details" button

**Actions:**
- Click "View Details" → Goes to shipment details page
- Click "Message" → Opens chat with driver

---

## 3. Shipment Details - Complete Information
**URL:** `/dashboard/client/shipments/[id]`

**What You See:**

### Main Content:
- **Status Timeline:** Visual progress with checkpoints
- **Shipment Details:**
  - Pickup location with date
  - Delivery location with date
  - Vehicle information (type, make, model, year, condition)
  - Distance and estimated delivery time
- **Vehicle Photos:** All uploaded photos

### Sidebar:
- **Pricing Card:**
  - Estimated price
  - Final price (if available)
  - Payment status badge
  
- **Driver Card (when assigned):**
  - Driver photo and name
  - Star rating
  - Phone number (click to call)
  - Email address (click to email)
  - "Send Message" button
  - **"Track Live Location" button** (NEW ✅)

**Actions:**
- Click "Send Message" → Opens messaging modal
- Click "Track Live Location" → Goes to live tracking page (NEW ✅)
- Click phone → Opens phone dialer
- Click email → Opens email client

---

## 4. Live Tracking - Real-Time Map View
**URL:** `/dashboard/client/track/[id]`

**What You See:**

### Real-Time Google Maps:
- **Blue Marker:** Pickup location (circle)
- **Red Marker:** Delivery location (circle)
- **Green Arrow:** Driver's current location (updates live!)
  - Arrow points in direction driver is heading
  - Moves automatically as driver moves

### Information Panels:

**1. Driver Location Status (Green Box):**
- "Driver En Route" message
- Last update timestamp
- Current speed in mph
- Location accuracy

**2. Your Driver Card:**
- Driver photo (or initials)
- Full name
- "Message" button
- "Call" button

**3. Route Information:**
Left Panel:
- Pickup location
- Full pickup address
- City, state, zip
- Pickup timestamp (if picked up)
- Green checkmark when completed

Right Panel:
- Delivery location
- Full delivery address
- City, state, zip
- Delivery timestamp (if delivered)
- Green checkmark when completed

**4. Delivery Timeline:**
Progress tracker showing:
1. ✅ Job Accepted (with timestamp)
2. ✅ Driver En Route to Pickup (with timestamp)
3. ✅ Driver Arrived at Pickup (with timestamp)
4. ✅ Vehicle Picked Up (with timestamp)
5. 🔵 In Transit to Delivery (current step)
6. ⚪ Delivered (not yet)

**Actions:**
- Click "Message" → Opens messaging with driver
- Click "Call" → Opens phone dialer
- Click back arrow → Returns to shipments list
- Map auto-centers on driver as they move

---

## Status Badge Colors

| Status | Color | Badge Text | Meaning |
|--------|-------|------------|---------|
| **pending** | Yellow | Pending | Waiting for driver |
| **assigned** | Blue | Assigned | Admin assigned driver |
| **accepted** | Blue | Accepted | Driver confirmed job |
| **driver_en_route** | Purple | En Route to Pickup | Driver heading to get vehicle |
| **driver_arrived** | Indigo | Driver Arrived | Driver at pickup location |
| **pickup_verified** | Teal | Pickup Verified | Pickup confirmed |
| **picked_up** | Teal | Picked Up | Vehicle loaded |
| **in_transit** | Orange | In Transit | Delivering to destination |
| **delivered** | Green | Delivered | Successfully delivered |
| **completed** | Green | Completed | Job fully closed |
| **cancelled** | Red | Cancelled | Shipment cancelled |

---

## When Can I Track Live Location?

### ✅ Track Button SHOWS for these statuses:
- `accepted` - Driver confirmed the job
- `driver_en_route` - Driver heading to pickup
- `driver_arrived` - Driver at pickup location
- `picked_up` - Vehicle loaded on trailer
- `in_transit` - Delivering to destination
- `in_progress` - General active delivery

### ❌ Track Button HIDDEN for these statuses:
- `pending` - No driver assigned yet
- `delivered` - Already completed
- `completed` - Fully closed
- `cancelled` - Job cancelled

---

## Real-Time Updates

### How Often Location Updates:
- **Driver App:** Sends location every 30 seconds
- **Your View:** Updates instantly (no refresh needed)
- **Map:** Smoothly moves driver marker
- **Timeline:** Auto-updates when status changes

### What Updates in Real-Time:
- ✅ Driver's position on map
- ✅ Driver's heading/direction
- ✅ Current speed
- ✅ Last update timestamp
- ✅ Status changes
- ✅ Timeline checkpoints

---

## Quick Access Flow

### Scenario 1: "Where is my driver?"
```
Dashboard → Click Active Delivery Card → Click "Track Live Location" → See Real-Time Map
```

### Scenario 2: "Check all my shipments"
```
Dashboard → Click "View All" → My Shipments → Select Tab (Active/Pending/Past)
```

### Scenario 3: "View specific shipment details"
```
My Shipments → Search or Browse → Click "View Details" → See Full Information
```

### Scenario 4: "Contact my driver"
```
Shipment Details → Driver Card → Click "Send Message" or "Call"
```

### Scenario 5: "Track delivery progress"
```
Shipment Details → See Status Timeline → Click "Track Live Location" → Watch Map
```

---

## Mobile vs. Website Features

| Feature | Mobile App | Website | Notes |
|---------|-----------|---------|-------|
| Dashboard | ✅ | ✅ | Same functionality |
| Recent Shipments | ✅ | ✅ | NOW clickable! |
| Active Count | ✅ | ✅ | NOW accurate! |
| My Shipments List | ✅ | ✅ | Same 3 tabs |
| Shipment Details | ✅ | ✅ | Same information |
| Status Timeline | ✅ | ✅ | Visual progress |
| Driver Contact | ✅ | ✅ | Call, message, email |
| Live Tracking | ✅ | ✅ | Real-time map |
| Google Maps | ✅ | ✅ | Same markers |
| Location Updates | ✅ | ✅ | Same frequency |
| Messaging | ✅ | ✅ | Real-time chat |

**100% Feature Parity** ✅

---

## Navigation Map

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT DASHBOARD                      │
│  - Welcome banner with "Create New Shipment"            │
│  - Stats cards (Total, Active✅, Completed, Spent)      │
│  - Recent shipments (clickable ✅)                       │
│  - Quick action cards                                    │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ MY SHIPMENTS  │   │ NEW SHIPMENT  │
│ Full list     │   │ Create form   │
│ 3 tabs ✅     │   │ 4 steps       │
└───────┬───────┘   └───────────────┘
        │
        ▼
┌───────────────────────────────────┐
│      SHIPMENT DETAILS             │
│  - Timeline                       │
│  - Vehicle info                   │
│  - Photos                         │
│  - Pricing                        │
│  - Driver card                    │
│    └─ Track Live Location ✅      │
└───────┬───────────────────────────┘
        │
        ▼
┌───────────────────────────────────┐
│    LIVE TRACKING MAP              │
│  - Real-time Google Maps          │
│  - Driver location (live!)        │
│  - Route markers                  │
│  - Driver info                    │
│  - Timeline                       │
│  - Contact buttons                │
└───────────────────────────────────┘
```

---

## Keyboard Shortcuts (Future Enhancement)

| Key | Action | Page |
|-----|--------|------|
| `Ctrl + K` | Search shipments | My Shipments |
| `Ctrl + N` | New shipment | Any page |
| `Escape` | Close modal | Any page |
| `M` | Open messaging | Details page |
| `T` | Track live location | Details page |

---

## Tips for Best Experience

### For Accurate Tracking:
1. **Enable Location Permissions:** Drivers must have location enabled
2. **Stable Connection:** Both you and driver need internet
3. **Keep Page Open:** Real-time updates work when page is active
4. **Refresh if Stuck:** If location seems frozen, refresh the page

### For Quick Access:
1. **Bookmark Details Page:** Direct link to your active shipment
2. **Use Search:** Quick find on My Shipments page
3. **Active Tab First:** Most relevant shipments show here
4. **Dashboard Cards:** Click stats to filter specific status

### For Driver Communication:
1. **Message First:** Less intrusive than calling
2. **Be Specific:** Include pickup/delivery details in messages
3. **Check Timeline:** See progress before asking "where are you?"
4. **Use Phone for Urgent:** Call only for time-sensitive issues

---

## FAQ

**Q: Why don't I see "Track Live Location" button?**  
A: Button only shows when shipment is in active delivery status (driver assigned and en route). Won't show for pending or completed shipments.

**Q: Driver's location not updating?**  
A: Driver may have paused location sharing, poor signal, or location services disabled. Contact driver via message.

**Q: Can I see past location history?**  
A: Currently shows current location only. Historical tracking coming in future update.

**Q: How accurate is the driver's location?**  
A: Typically accurate to 10-50 meters depending on GPS signal quality. Accuracy shown on tracking page.

**Q: Can I share tracking link with others?**  
A: Currently requires login. Public sharing links coming in future update.

**Q: What if shipment shows wrong status?**  
A: Refresh the page. If still wrong, contact driver or support.

---

## All Fixed! ✅

### What Was Broken:
1. ❌ Recent shipments had broken links
2. ❌ Active deliveries count was wrong
3. ❓ Unclear where to track live location

### What's Fixed:
1. ✅ Recent shipments navigate to details page
2. ✅ Active count includes all 9 active statuses
3. ✅ "Track Live Location" button added to details page
4. ✅ Live tracking page fully functional with Google Maps
5. ✅ Real-time location updates working

**Everything works perfectly now!** 🎉

---

**Last Updated:** November 12, 2025  
**Status:** All fixes applied and tested ✅
