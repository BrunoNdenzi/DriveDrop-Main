# ROUTE PLANNER BLUEPRINT
## DriveDrop Intelligent Load-Matching & Multi-Stop Route Optimization

**Document Type:** Engineering Specification  
**Scope:** Backend service + Admin/Driver UI integration  
**Phase:** Phase 2 — Post-Core Completion  
**Status:** Pre-implementation (design phase)

---

## 1. PURPOSE

The Route Planner addresses a core efficiency gap: drivers currently select individual loads one at a time without visibility into multi-stop optimization. Carriers hauling 2–8 vehicles per trailer are leaving money on the table because DriveDrop has no engine that can:

1. Cluster nearby open loads into a single profitable trip
2. Sequence pickup/delivery stops to minimize deadhead miles
3. Predict realistic ETAs accounting for drive time, stops, and FMCSA hours-of-service limits
4. Surface these optimized trips as ready-to-claim "bundles" for drivers

This blueprint specifies that engine end-to-end.

---

## 2. SCOPE BOUNDARIES

### In Scope
- Multi-load trip planning for car carriers (2–8 vehicle capacity)
- Route optimization: TSP-based pickup/delivery sequencing
- Deadhead estimation: empty miles between last delivery and next pickup
- ETA prediction: drive time + stop time + HOS buffer
- Driver capacity input: trailer size, current location, preferred radius
- Admin view: suggested bundles for any open load cluster
- Benji integration: "Find me an optimized route for today"

### Out of Scope (Phase 3+)
- Live turn-by-turn navigation (see Navigation System Blueprint)
- Real-time traffic rerouting
- Broker/shipper direct access to route planner
- Automated driver assignment (admins still approve)
- Fuel price optimization by route

---

## 3. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  Driver App (Next.js)    Admin Dashboard (Next.js)       │
│  • "Plan My Trip" CTA    • Load Cluster Map              │
│  • Route Preview Card    • Suggested Bundles Panel       │
└────────────────┬───────────────────┬────────────────────┘
                 │ REST               │ REST
┌────────────────▼───────────────────▼────────────────────┐
│                 ROUTE PLANNER SERVICE                    │
│  POST /api/v1/route-planner/suggest                      │
│  POST /api/v1/route-planner/optimize                     │
│  GET  /api/v1/route-planner/preview/:tripId              │
└────────────────┬────────────────────────────────────────┘
                 │
     ┌───────────┴──────────────┐
     │                          │
┌────▼─────┐           ┌────────▼──────────┐
│ Supabase │           │  Maps Provider    │
│ shipments│           │  (Google or       │
│ profiles │           │   Mapbox Matrix)  │
│ locations│           │  Distance Matrix  │
└──────────┘           │  Geocoding API    │
                       └───────────────────┘
```

---

## 4. DATA MODEL

### New Table: `route_trips`

```sql
CREATE TABLE route_trips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID REFERENCES profiles(id),
  status          TEXT NOT NULL DEFAULT 'suggested'
                  CHECK (status IN ('suggested','accepted','in_progress','completed','cancelled')),
  origin_lat      FLOAT NOT NULL,
  origin_lng      FLOAT NOT NULL,
  origin_label    TEXT NOT NULL,         -- "Current Location" or address
  total_distance  FLOAT NOT NULL,        -- total miles (loaded + deadhead)
  deadhead_miles  FLOAT NOT NULL,        -- empty miles
  estimated_revenue DECIMAL(10,2),       -- sum of shipment prices
  estimated_hours FLOAT NOT NULL,        -- drive time + stop time
  stop_count      INT NOT NULL,
  vehicle_count   INT NOT NULL,          -- total vehicles on trailer
  stops           JSONB NOT NULL,        -- ordered stop array (see below)
  created_at      TIMESTAMPTZ DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

-- stops JSONB schema:
-- [
--   {
--     "order": 1,
--     "type": "pickup" | "delivery",
--     "shipment_id": "uuid",
--     "address": "...",
--     "city": "Charlotte",
--     "state": "NC",
--     "lat": 35.22,
--     "lng": -80.84,
--     "vehicle": "2021 Toyota Camry",
--     "estimated_arrival": "2025-08-15T10:30:00Z",
--     "window_start": "2025-08-15T08:00:00Z",
--     "window_end": "2025-08-15T18:00:00Z",
--     "stop_duration_mins": 30
--   }
-- ]
```

### New Table: `route_trip_shipments`

```sql
CREATE TABLE route_trip_shipments (
  trip_id     UUID REFERENCES route_trips(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id),
  PRIMARY KEY (trip_id, shipment_id)
);
```

### New Column: `shipments.route_trip_id`

```sql
ALTER TABLE shipments ADD COLUMN route_trip_id UUID REFERENCES route_trips(id);
```

---

## 5. ROUTE OPTIMIZATION ALGORITHM

### Problem Formulation

The core problem is a **Pickup and Delivery Problem (PDP)** — a variant of TSP where each load has a paired pickup and delivery node, and the pickup must always precede the delivery for the same vehicle.

For 2–8 loads (4–16 stops), exact methods are feasible. For larger clusters, heuristics are used.

### Algorithm: Nearest Neighbor + 2-Opt Local Search

**Phase 1: Build initial route (Nearest Neighbor Heuristic)**

```
1. Start at driver's current location
2. Find nearest unvisited pickup stop
3. Mark that load as "on trailer"
4. If trailer capacity reached: route to nearest delivery among loaded vehicles
5. Otherwise: find nearest pickup OR delivery that satisfies precedence constraint
6. Repeat until all stops visited
```

**Phase 2: Local Search Improvement (2-opt)**

```
For each pair of edges (i→i+1) and (j→j+1):
  Try reversing the sub-route between i+1 and j
  If this reduces total distance AND respects all precedence constraints:
    Accept the swap
Repeat until no improvement found (or max 500 iterations)
```

**Precedence constraint:** For any load L, `index(pickup_L) < index(delivery_L)` in the stop sequence.

**Capacity constraint:** At any point in the route, `vehicles_on_trailer ≤ trailer_capacity`.

### Distance Matrix

Use Google Maps Distance Matrix API or Mapbox Matrix API to get real road distances between all stop pairs — not haversine (straight-line).

For N stops: request is O(N²). For 16 stops: 256 cells — well within API limits.

```typescript
interface DistanceMatrix {
  [fromKey: string]: {
    [toKey: string]: {
      distanceMiles: number;
      durationMinutes: number;
    };
  };
}
```

Cache matrices in Redis (TTL: 6 hours) keyed by `md5(sorted_stop_coords)`.

### ETA Calculation

```
totalDriveTime = sum of all edge durations from distance matrix
stopTime = stop_count × 30 minutes (industry standard for vehicle loading)
hosBuffer = every 8 hours driving → add 30 min break (FMCSA 30-min rule)
              every 11 hours driving → stop (FMCSA 11-hr limit)

estimatedHours = totalDriveTime + stopTime + hosBuffers
estimatedArrival[stop_i] = departureTime + cumulative_drive_time + cumulative_stop_time
```

---

## 6. LOAD CLUSTERING

Before running optimization, open loads must be grouped into candidate clusters.

### Clustering Strategy: Geo-radius + Time-window Filter

```typescript
async function findCandidateClusters(
  driverLocation: { lat: number; lng: number },
  radiusMiles: number,        // default: 150
  trailerCapacity: number,    // default: 3
  pickupWindowDays: number,   // default: 5
): Promise<LoadCluster[]> {
  // 1. Query shipments where:
  //    - status = 'pending'
  //    - no driver assigned
  //    - pickup_lat/lng within radiusMiles of driverLocation
  //    - pickup_date within pickupWindowDays
  // 2. Group by proximity (50mi radius clusters using DBSCAN)
  // 3. Return top 5 clusters ranked by (revenue / total_miles)
}
```

### DBSCAN Parameters (for geographic clustering)
- ε (epsilon): 50 miles (converted to radians for haversine)
- minPoints: 1 (every load is its own cluster at minimum)

---

## 7. API DESIGN

### POST `/api/v1/route-planner/suggest`

**Auth:** Driver JWT required

**Request:**
```json
{
  "currentLat": 35.2271,
  "currentLng": -80.8431,
  "trailerCapacity": 3,
  "radiusMiles": 200,
  "pickupWindowDays": 5
}
```

**Response:**
```json
{
  "clusters": [
    {
      "tripId": "uuid",
      "stops": 6,
      "vehicleCount": 3,
      "totalMiles": 412,
      "deadheadMiles": 28,
      "estimatedRevenue": 2850.00,
      "estimatedHours": 9.5,
      "revenuePerMile": 6.92,
      "route": [...stops...]
    }
  ]
}
```

### POST `/api/v1/route-planner/optimize`

**Auth:** Driver JWT required

**Request:**
```json
{
  "shipmentIds": ["uuid1", "uuid2", "uuid3"],
  "currentLat": 35.2271,
  "currentLng": -80.8431,
  "trailerCapacity": 3,
  "departureTime": "2025-08-15T07:00:00Z"
}
```

**Response:** Full optimized route with ETAs per stop.

### GET `/api/v1/route-planner/preview/:tripId`

Returns a saved `route_trips` record with full stop detail for map rendering.

---

## 8. SERVICE IMPLEMENTATION

### File Structure

```
backend/src/services/
  route-planner/
    route-planner.service.ts       # Main service: cluster → optimize → persist
    distance-matrix.service.ts     # Maps API wrapper + Redis caching
    optimization/
      nearest-neighbor.ts          # Phase 1 heuristic
      two-opt.ts                   # Phase 2 local search
      precedence.ts                # Constraint checker
    clustering/
      geo-cluster.ts               # DBSCAN implementation
      load-filter.ts               # DB query for candidate loads
    eta-calculator.ts              # HOS-aware ETA per stop
    route-planner.router.ts        # Express router
    route-planner.types.ts         # Shared types
```

### Key Types

```typescript
interface Stop {
  order:         number;
  type:          'pickup' | 'delivery';
  shipmentId:    string;
  lat:           number;
  lng:           number;
  address:       string;
  city:          string;
  state:         string;
  vehicle:       string;
  windowStart?:  string;   // ISO 8601
  windowEnd?:    string;
  stopDurationMins: number;
  estimatedArrival?: string;
}

interface OptimizedRoute {
  stops:              Stop[];
  totalDistanceMiles: number;
  deadheadMiles:      number;
  estimatedHours:     number;
  estimatedRevenue:   number;
  revenuePerMile:     number;
}
```

---

## 9. MAPS API INTEGRATION

### Provider Selection

| Factor | Google Maps | Mapbox |
|---|---|---|
| Distance Matrix API | ✅ Industry standard | ✅ Available |
| Pricing | $0.005 per element | $0.00025 per element (cheaper) |
| Turn-by-turn (Phase 3) | ✅ Routes API | ✅ Directions API |
| Geocoding quality | ✅ Best for US addresses | ✅ Good |
| **Recommendation** | Use if already integrated | **Use if greenfield** |

If Google Maps SDK is already in the project: keep it for matrix calls.  
If no maps SDK exists yet: Mapbox is more cost-effective at scale.

### Distance Matrix Caching

```typescript
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

async function getMatrix(stops: Stop[]): Promise<DistanceMatrix> {
  const cacheKey = `dmatrix:${hashStops(stops)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const matrix = await fetchFromMapsAPI(stops);
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(matrix));
  return matrix;
}
```

---

## 10. BENJI INTEGRATION

New tool: `plan_route` (driver role only)

```typescript
{
  name: 'plan_route',
  description: 'Find and optimize a multi-load route for a car carrier driver based on current location and available loads.',
  parameters: {
    current_location: { type: 'string', description: 'Driver current city/state or address' },
    trailer_capacity: { type: 'number', description: 'Max vehicles on trailer (default: 3)' },
    radius_miles:     { type: 'number', description: 'Search radius for loads (default: 150)' },
    pickup_window_days: { type: 'number', description: 'Days out to look for pickups (default: 5)' },
  }
}
```

**Sample Benji conversation:**
```
Driver: "Find me a good route for today, I'm in Charlotte with a 3-car trailer"
Benji:  [calls plan_route with Charlotte geocode + capacity=3]
        "Found an optimized 3-load route:
         1. Pickup: 2021 BMW 3 Series in Charlotte, NC (10:00 AM)
         2. Pickup: 2020 Toyota Camry in Concord, NC (11:00 AM)  
         3. Delivery: BMW → Raleigh, NC (2:30 PM)
         4. Pickup: 2019 Honda Civic in Durham, NC (4:00 PM)
         5. Delivery: Camry → Cary, NC (5:00 PM)
         6. Delivery: Civic → Chapel Hill, NC (6:00 PM)
         
         Total: 312 miles · ~9.2 hours · $2,650 estimated revenue
         Revenue/mile: $8.49 · Deadhead: 18 miles
         
         Want me to claim all 3 loads and lock this route?"
```

---

## 11. COST ESTIMATION

### Development Effort
| Component | Estimate |
|---|---|
| Distance matrix service + caching | 2 days |
| Nearest-neighbor + 2-opt algorithm | 3 days |
| DBSCAN geo-clustering | 1 day |
| ETA calculator (HOS-aware) | 1 day |
| DB migrations | 0.5 days |
| API router + endpoints | 1 day |
| Driver UI (route preview card) | 2 days |
| Admin UI (cluster map panel) | 2 days |
| Benji tool integration | 1 day |
| Tests | 2 days |
| **Total** | **~15.5 days** |

### API Cost (at scale)
- 100 route suggestions/day × 16 stops² = 25,600 matrix elements/day
- Mapbox: 25,600 × $0.00025 = **$6.40/day**
- Google Maps: 25,600 × $0.005 = **$128/day**

Recommendation: Use Mapbox for matrix calls, cache aggressively.

---

## 12. TESTING STRATEGY

### Unit Tests
- `two-opt.test.ts`: Verify improvement on known suboptimal routes
- `precedence.test.ts`: All pickup-before-delivery constraints satisfied
- `eta-calculator.test.ts`: HOS breaks inserted at correct intervals
- `geo-cluster.test.ts`: DBSCAN correctly groups nearby loads

### Integration Tests
- `route-planner.integration.test.ts`:
  - POST /suggest returns ranked clusters
  - POST /optimize returns valid stop sequence
  - Cached matrix is used on second call (verify API not called twice)

### End-to-End
- Benji: "Find me a route" → plan_route called → multi-load route presented
- Driver claims all loads → route_trip_shipments populated
- Loads marked as `driver_id = driverId` and `route_trip_id = tripId`

---

## 13. OPEN DECISIONS

| Decision | Options | Recommendation |
|---|---|---|
| Maps provider | Google vs Mapbox | Mapbox (cost) |
| Exact vs heuristic TSP | Exact (<8 stops) / Heuristic | Both, switch on stop count |
| Cache store | Redis vs in-memory | Redis (production) / in-memory (dev) |
| HOS enforcement | Soft warning vs hard block | Soft warning initially |
| Multi-driver routing | Single driver per trip | Single driver for Phase 2 |

---

## 14. PHASE 2 DEPENDENCY MAP

```
Phase 1 (complete) → Phase 2 Route Planner
                     ↓
                     Phase 3 Navigation System
                     (turn-by-turn execution of Phase 2 planned routes)
```

The Route Planner produces **planned routes**.  
The Navigation System **executes** those routes in real-time with live tracking.

---

*Document version: 1.0 — DriveDrop Engineering, Phase 2 Pre-Build*
