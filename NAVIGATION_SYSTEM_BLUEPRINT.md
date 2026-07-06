# NAVIGATION SYSTEM BLUEPRINT
## DriveDrop Real-Time Driver Navigation & Client Tracking

**Document Type:** Engineering Specification  
**Scope:** Mobile-first driver nav + real-time client tracking layer  
**Phase:** Phase 3 — Post-Route-Planner  
**Status:** Pre-implementation (design phase)

---

## 1. PURPOSE & DISTINCTION FROM ROUTE PLANNER

The **Route Planner** (Phase 2) answers: *"Which loads should I take and in what order?"*  
The **Navigation System** (Phase 3) answers: *"I know my route — guide me through it in real time."*

These are complementary but architecturally separate:

| Dimension | Route Planner | Navigation System |
|---|---|---|
| When | Pre-trip planning | During trip execution |
| Input | Available open loads | Confirmed, locked route |
| Output | Optimized stop sequence | Turn-by-turn directions + ETAs |
| Interaction | Batch (one request) | Continuous (live location stream) |
| User | Driver (planning) | Driver (driving) + Client (watching) |
| Network | Occasional API calls | Persistent WebSocket / SSE |

---

## 2. SYSTEM OVERVIEW

```
┌──────────────────────────────────────────────────────────────┐
│                     DRIVER (Mobile Browser / PWA)            │
│   • Turn-by-turn directions (Mapbox Nav SDK or Web Directions)│
│   • Next stop card (address, ETA, contact)                   │
│   • "Arrived" button → auto-updates shipment status          │
│   • Voice-ready route instructions (text-to-speech)          │
└──────────────────────┬───────────────────────────────────────┘
                       │ WebSocket (location updates 15s intervals)
┌──────────────────────▼───────────────────────────────────────┐
│                  LOCATION RELAY SERVICE                       │
│  Receives: { driverId, lat, lng, heading, speed, timestamp } │
│  Broadcasts: to subscribed clients (by shipment_id)          │
│  Persists: last-known location to Redis (TTL 1 hour)         │
│  Updates: shipment ETA recalculation on significant deviation │
└──────┬───────────────────────────────────────┬───────────────┘
       │ DB writes                              │ SSE push
       │                                        │
┌──────▼────────────┐                ┌──────────▼───────────────┐
│   Supabase        │                │  CLIENT BROWSER          │
│   driver_locations│                │  • Live map dot          │
│   shipments       │                │  • ETA countdown         │
│   (eta updates)   │                │  • Status banner         │
└───────────────────┘                └──────────────────────────┘
```

---

## 3. CORE COMPONENTS

### 3.1 Driver Navigation UI (Mobile-First)

A Progressive Web App (PWA) page at `/driver/navigate/:tripId` or `/driver/navigate/:shipmentId`.

**Features:**
- **Map view** with current position, next stop pinned, full route polyline
- **Instruction bar** (bottom): "Turn right on I-85 N in 0.3 miles"
- **Next stop card**: Address, client name, vehicle, ETA, phone button
- **Stop list** (collapsible): All remaining stops with ETAs
- **"I'm here" button**: One-tap status update (picked_up / delivered)
- **Offline mode**: Route cached locally; map tiles pre-fetched for route corridor

**Implementation:** Mapbox GL JS (web) or Mapbox Navigation SDK (native app if React Native).

For web/PWA: use Mapbox Directions API to get turn-by-turn steps, render with Mapbox GL JS.

```typescript
// Route rendering
const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/navigation-night-v1' });
const directions = new MapboxDirections({ accessToken, profile: 'mapbox/driving', interactive: false });
map.addControl(directions);
directions.setOrigin([driverLng, driverLat]);
directions.setWaypoints(waypointCoords);
directions.setDestination([finalLng, finalLat]);
```

---

### 3.2 Live Location Service (WebSocket)

**File:** `backend/src/services/location/location.service.ts`

**Protocol:** WebSocket over `wss://api.drivedrop.us.com/ws/location`

**Driver → Server (send every 15 seconds while navigating):**
```json
{
  "type": "location_update",
  "driverId": "uuid",
  "shipmentId": "uuid",
  "lat": 35.2271,
  "lng": -80.8431,
  "heading": 285,
  "speedMph": 65,
  "timestamp": "2025-08-15T14:23:00Z"
}
```

**Server → Client (push to subscribed clients):**
```json
{
  "type": "driver_location",
  "shipmentId": "uuid",
  "lat": 35.2271,
  "lng": -80.8431,
  "heading": 285,
  "etaMinutes": 42,
  "lastUpdated": "2025-08-15T14:23:00Z"
}
```

**Connection auth:** JWT in `Authorization` header on WebSocket upgrade request.

---

### 3.3 Client Tracking Page

**Route:** `/dashboard/client/track/:shipmentId`  
**Auth:** Supabase client session  
**Data source:** SSE stream (simpler than WebSocket for read-only consumers)

```
GET /api/v1/tracking/:shipmentId/stream
Content-Type: text/event-stream
```

The server subscribes to Redis Pub/Sub channel `location:shipmentId` and forwards events as SSE.

**UI:**
```
┌────────────────────────────────────────┐
│  [MAP: Full-width, 60vh]               │
│  📍 Live marker — your vehicle         │
│  📦 Your destination (blinking)        │
│  ── Route line                         │
├────────────────────────────────────────┤
│  🚛 In Transit                         │
│  Toyota Camry (red) · James M., Driver │
│  ETA: 2h 14min (arrives ~4:30 PM)      │
│  Last updated: 30 seconds ago          │
├────────────────────────────────────────┤
│  [Message Driver]  [Call Driver]       │
└────────────────────────────────────────┘
```

---

### 3.4 ETA Recalculation Engine

Recalculate ETAs when:
1. Driver deviates >5 miles from planned route
2. Driver stops for >20 minutes unexpectedly  
3. Driver manually requests recalculation

```typescript
async function recalculateETA(
  driverLocation: LatLng,
  remainingStops: Stop[],
  departureTime: Date,
): Promise<Stop[]> {
  // Re-run distance matrix for remaining stops from current location
  const matrix = await distanceMatrixService.getMatrix([
    { lat: driverLocation.lat, lng: driverLocation.lng },
    ...remainingStops,
  ]);
  
  // Recalculate cumulative ETAs
  let cumulativeTime = 0;
  return remainingStops.map((stop, i) => {
    const edge = i === 0
      ? matrix['current'][stop.key]
      : matrix[remainingStops[i-1].key][stop.key];
    cumulativeTime += edge.durationMinutes + stop.stopDurationMins;
    return {
      ...stop,
      estimatedArrival: addMinutes(departureTime, cumulativeTime).toISOString(),
    };
  });
}
```

---

## 4. DATA MODEL

### New Table: `driver_locations`

```sql
CREATE TABLE driver_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES profiles(id),
  shipment_id UUID REFERENCES shipments(id),
  lat         FLOAT NOT NULL,
  lng         FLOAT NOT NULL,
  heading     FLOAT,              -- degrees (0-360)
  speed_mph   FLOAT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partition by recorded_at (monthly) to manage history volume
-- Keep only last 30 days in hot storage

CREATE INDEX idx_driver_locations_driver_recent
  ON driver_locations (driver_id, recorded_at DESC);
```

### Redis Keys

| Key pattern | Value | TTL |
|---|---|---|
| `location:driver:{driverId}` | `{lat, lng, heading, speed, ts}` JSON | 2 hours |
| `location:shipment:{shipmentId}` | `{lat, lng, etaMinutes, ts}` JSON | 2 hours |
| `eta:{shipmentId}` | `etaMinutes` integer | 30 minutes |

### Supabase Realtime (alternative to WebSocket)

Supabase ships a built-in realtime subscription over WebSocket using Postgres CDC.

For the client tracking page, use Supabase Realtime instead of custom WebSocket:

```typescript
// Client tracking page — subscribes to driver_locations table
const channel = supabase
  .channel('driver-location')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'driver_locations',
    filter: `shipment_id=eq.${shipmentId}`,
  }, (payload) => {
    updateMapMarker(payload.new.lat, payload.new.lng, payload.new.heading);
    updateETA(payload.new.lat, payload.new.lng);
  })
  .subscribe();
```

This eliminates the need for a custom WebSocket server if Supabase Realtime is already in use.

---

## 5. GEOFENCING

Geofences trigger automatic status updates and client notifications without driver manual input.

### Geofence Events

| Event | Trigger | Action |
|---|---|---|
| `pickup_arrive` | Driver enters 0.25mi radius of pickup address | Push notification to driver: "You've arrived at pickup location" |
| `pickup_depart` | Driver exits 0.5mi radius after being inside it | If shipment not yet `picked_up`: prompt driver "Did you pick up the vehicle?" |
| `delivery_arrive` | Driver enters 0.25mi radius of delivery address | Push notification to client: "Your driver has arrived!" |
| `delivery_depart` | Driver exits 0.5mi radius of delivery address | If shipment not yet `delivered`: prompt driver "Did you deliver the vehicle?" |

### Implementation

```typescript
function checkGeofences(
  driverLat: number,
  driverLng: number,
  activeStops: Stop[],
): GeofenceEvent[] {
  const events: GeofenceEvent[] = [];
  for (const stop of activeStops) {
    const distanceMiles = haversine(driverLat, driverLng, stop.lat, stop.lng);
    if (distanceMiles < 0.25 && !stop.arrivedNotified) {
      events.push({ type: `${stop.type}_arrive`, stopId: stop.shipmentId });
    }
  }
  return events;
}
```

---

## 6. PUSH NOTIFICATIONS

For mobile PWA: use Web Push API (service worker + VAPID keys).  
For native (if React Native): use Expo Notifications or FCM.

### Notification Types

| Trigger | Recipient | Message |
|---|---|---|
| Driver within 30 min of pickup | Client | "Your driver is 30 minutes away!" |
| Driver within 5 min of delivery | Client | "Your vehicle is almost there!" |
| Driver marks delivered | Client | "Your vehicle has been delivered. Please confirm." |
| Shipment status changes to `picked_up` | Client | "Your [vehicle] has been picked up in [city]" |
| ETA changes by >1 hour | Client | "Updated ETA: your vehicle now arrives at [new time]" |
| New load in driver's area | Driver | "New load available: $X from [city] to [city]" |

---

## 7. OFFLINE MODE

Drivers may lose connectivity in rural corridors. The PWA must remain functional offline.

### Strategy: Service Worker + Cache-First

```
1. Pre-cache route data when navigation begins (while online)
2. Store all stop addresses, instructions, contact info in IndexedDB
3. Pre-fetch map tiles for the route corridor (offline maps)
4. Location updates queued in IndexedDB when offline
5. Sync queued updates when connectivity resumes
```

Map tiles caching via Mapbox's offline maps API (requires Mapbox SDK, not available in Mapbox GL JS on web without special setup — use Mapbox Mobile SDK for native offline).

For web PWA: cache the static route data and fallback to Apple/Google Maps deep link for navigation when offline.

---

## 8. FILE STRUCTURE

```
backend/src/
  services/location/
    location.service.ts          # Core location processing
    location.router.ts           # REST + SSE endpoints
    geofence.service.ts          # Geofence detection
    eta-recalculator.service.ts  # Deviation-aware ETA updates
    location.types.ts
  
  websocket/
    ws-server.ts                 # WebSocket upgrade handler
    ws-location-handler.ts       # Per-connection location handler

website/src/app/
  driver/navigate/
    [tripId]/
      page.tsx                   # Navigation UI (map + instructions)
      NavigationMap.tsx          # Mapbox GL component
      StopCard.tsx               # Current/next stop info
      StopList.tsx               # All remaining stops

  dashboard/client/track/
    [shipmentId]/
      page.tsx                   # Client tracking page
      LiveMap.tsx                # Mapbox marker component
      ETABanner.tsx              # ETA + last-updated display
```

---

## 9. BENJI INTEGRATION

### For Drivers: `get_navigation_link`

```typescript
{
  name: 'get_navigation_link',
  description: 'Get a deep-link to start navigation for a confirmed trip or shipment',
  parameters: {
    shipment_id: { type: 'string', description: 'Shipment ID to navigate to' }
  }
}
```

Returns: `https://drivedrop.us.com/driver/navigate/{shipmentId}` — drivers tap to open navigation.

### For Clients: Real-Time Updates via `track_shipment`

Enhanced `track_shipment` executor in Phase 3 returns live ETA from Redis if driver is active:

```typescript
// In execTrackShipment (Phase 3 enhancement)
const liveLocation = await redis.get(`location:shipment:${shipmentId}`);
if (liveLocation) {
  const { lat, lng, etaMinutes, ts } = JSON.parse(liveLocation);
  return { ...shipmentData, liveETA: etaMinutes, driverLocation: { lat, lng }, lastUpdated: ts };
}
```

---

## 10. DEVELOPMENT EFFORT

| Component | Estimate |
|---|---|
| WebSocket server + location handler | 2 days |
| Driver locations DB table + Redis layer | 1 day |
| Geofencing service | 2 days |
| ETA recalculation on deviation | 1 day |
| Driver navigation UI (PWA) | 4 days |
| Client tracking page (live map) | 3 days |
| Supabase Realtime integration | 1 day |
| Push notifications (Web Push) | 2 days |
| Offline mode (service worker) | 3 days |
| Benji tool additions | 1 day |
| Tests | 2 days |
| **Total** | **~22 days** |

---

## 11. SECURITY CONSIDERATIONS

1. **Location data access control**: Only the assigned driver and client for a given shipment may receive location updates. Enforced at the WebSocket/SSE subscription level via RLS + JWT verification.

2. **Driver location privacy**: Stop broadcasting when shipment reaches `delivered` status. Delete precise location history after 30 days (retain only city-level for analytics).

3. **Rate limiting on location writes**: Max 1 update per 10 seconds per driverId to prevent abuse.

4. **SSRF prevention on geocoding**: Never use client-provided coordinates in server-side map API calls without bounds checking (lat: -90..90, lng: -180..180).

5. **WebSocket auth**: JWT verified on upgrade request, not on every message. Connection dropped if JWT expires (1-hour re-auth cycle).

---

## 12. PHASE DEPENDENCY MAP

```
Phase 1 (complete)
  └─▶ Phase 2: Route Planner
        Produces: route_trips table, optimized stop sequences
        └─▶ Phase 3: Navigation System
              Consumes: route_trips.stops for turn-by-turn
              Produces: driver_locations, live ETAs, client tracking
              └─▶ Phase 4: AI-Driven Operations
                    (Anomaly detection, predictive ETAs, demand forecasting)
```

---

## 13. OPEN DECISIONS

| Decision | Options | Recommendation |
|---|---|---|
| Real-time channel | Custom WebSocket vs Supabase Realtime | Supabase Realtime (zero infra) |
| Turn-by-turn | Mapbox Navigation SDK vs Mapbox Directions + custom | Mapbox Directions (web) → SDK when native |
| Location store | Redis only vs Redis + DB | Redis for live; DB for history |
| Offline maps | Mapbox offline vs Apple/Google deep link fallback | Deep link fallback for Phase 3 |
| Push notifications | Web Push vs FCM vs Supabase push | Web Push for PWA initially |

---

*Document version: 1.0 — DriveDrop Engineering, Phase 3 Pre-Build*
