# Route Planner + Benji: Two-Phase Production Plan

**Date:** 2026-07-25
**Scope:** Driver website first, standalone independent-driver product second
**Routing direction:** HERE commercial truck routing behind a provider abstraction
**Data policy:** Production APIs and verified database records only; no mock, placeholder, or silently estimated live data

**Confirmed product decisions:**

- Fuel prices: evaluate commercial vendors before selecting the production source.
- Weather: evaluate commercial route-weather vendors before selecting the production source.
- Operating costs: reviewed DriveDrop defaults, explicitly confirmed or overridden per driver.
- Safety: block legal and safety violations; allow overrides only for clearly labeled business-risk warnings.
- HERE: the DriveDrop project and credentials have been created. Use a newly rotated key server-side because the originally supplied key was visible in a screenshot.

## 1. Product Outcome

Build one Route Operations experience that lets a driver:

1. Select or import loads.
2. Create a legal, capacity-safe pickup and delivery plan.
3. Compare fastest, lowest-cost, lowest-risk, and highest-profit alternatives.
4. See a complete cost model, fuel plan, tolls, weather, traffic, truck restrictions, ETAs, and HOS feasibility.
5. Accept and execute a persisted plan.
6. Ask Benji to create, explain, compare, modify, or reoptimize the plan using the same deterministic route services as the UI.

Phase 1 serves authenticated DriveDrop drivers and DriveDrop shipments. Phase 2 reuses the route domain for independent drivers and external load sources.

## 2. Non-Negotiable Data Rules

- Benji never invents route facts, restrictions, prices, costs, ETAs, fuel stops, or weather.
- The LLM explains and operates deterministic services; it does not calculate or approve routes itself.
- Every live datum includes `provider`, `observedAt`, `expiresAt`, and `status` (`live`, `cached`, `stale`, or `unavailable`).
- Stale data is visibly labeled. Safety-critical stale data cannot produce a `ready` plan.
- A provider failure returns partial availability and a clear warning. It must not fall back to a fabricated road distance, fuel price, toll, restriction, or weather condition.
- Estimates are allowed only for user-owned operating assumptions such as maintenance cost per mile. They must be labeled `driver assumption`, not `live`.
- Server-side services load shipment addresses, revenue, status, and ownership from the database. The browser and Benji send shipment IDs, not authoritative shipment facts.

## 3. Live Data Sources

| Capability | Production source | Phase | Behavior |
|---|---|---:|---|
| Geocoding and address validation | Existing Google integration initially; provider adapter | 1 | Store coordinates, place ID, normalized address, and confidence |
| Commercial truck path, restrictions, ETA, traffic, tolls | HERE Routing API with truck profile | 1 | Height, width, length, weight, axle count, hazmat, trailer count, traffic-aware departure |
| Map rendering and places | Existing Google Maps JavaScript/Places | 1 | Render HERE route geometry; find candidate services only |
| Weather and route hazards | Paid weather provider selected before implementation | 1 | Forecast sampled along route and ETA, not origin-only weather |
| Fuel stations | Places/provider POI feed | 1 | Diesel availability and truck suitability required where available |
| Fuel prices | Contracted fuel-price provider selected before implementation | 1 | Station-level diesel price and observation time; no regional constants |
| HOS | Driver-entered remaining clocks | 1 | Drive, shift/on-duty, cycle, last qualifying break, timezone |
| Live driver location | Browser geolocation while Route Operations is open | 1 | Consent, accuracy, freshness, and route execution state recorded |
| ELD/HOS integrations | Adapter interface, first vendors selected by demand | 2 | Samsara, Motive, or other OAuth integrations |
| External load sources | CSV/manual/email/API adapters | 2 | Normalize into standalone load records with provenance |

HERE is the selected truck-routing direction, but all provider calls must implement internal interfaces so a second provider can be benchmarked or used for failover without changing the optimizer or UI.

Fuel and weather vendor selection is a Phase 1 entry task. The evaluation must compare geographic coverage, update frequency, route-corridor support, attribution and storage rights, SLA, rate limits, API cost at projected volume, and failure behavior. No vendor-specific implementation begins until the benchmark and commercial terms are approved.

### Recommended Phase 1 Provider Stack

- Truck route, traffic, restrictions, and launch toll estimates: HERE Routing v8 and Matrix Routing. Start with HERE toll data and add a dedicated toll provider only if pilot reconciliation shows unacceptable gaps.
- Route weather: Tomorrow.io is the recommended first evaluation because its timeline and alert model fits ETA-based sampling along a route. Benchmark it against WeatherAPI before contracting.
- Retail diesel prices: OPIS is the recommended enterprise benchmark for station-level pricing and commercial data rights. Also quote PDI/Fuel Prices and GasBuddy Business; selection depends on API rights, update frequency, truck-stop coverage, and minimum contract cost.
- Fuel-station discovery: retain Google Places initially, but do not infer diesel price, truck access, parking, or availability from a generic place result.
- HOS: manual driver-entered clocks in Phase 1; design the adapter for Motive and Samsara in Phase 2.

The launch stack therefore uses HERE tolls, Tomorrow.io weather, and the winning commercial diesel feed after contract review. Until that feed is active, fuel prices are `unavailable`; regional constants must not appear as live prices.

## 4. Complete Trip Cost Model

Route profitability must be separate from customer quote pricing. The trip model calculates:

### Revenue

- Driver payout or offered load revenue from authorized shipment records.
- Accessorial revenue, bonuses, detention reimbursement, and other load-specific additions.
- Revenue confidence and missing-payment warnings.

### Variable Costs

- Fuel by leg using loaded/empty MPG, route elevation/traffic adjustment when supported, gallons required, and station-level diesel prices.
- Tolls returned by truck routing for the exact truck profile and payment method/transponder assumptions.
- Driver labor or owner-operator time cost: driving, on-duty service, detention, breaks, and overnight time.
- Maintenance reserve per mile.
- Tire reserve per mile.
- Insurance allocation per mile or per day.
- Depreciation or equipment lease allocation.
- Platform/dispatch/load-board fees.
- Payment processing or factoring fees.
- Lodging, parking, meals/per diem, permits, ferries, scales, washes, and user-added costs.

### Route Metrics

- Loaded miles, deadhead miles, out-of-route miles, and deadhead percentage.
- Gross revenue, total cost, projected net profit, profit per loaded mile, profit per total mile, profit per driving hour, and profit per on-duty hour.
- Break-even revenue and break-even rate per mile.
- Planned versus actual cost after completion.
- Confidence level based on live data freshness and driver-profile completeness.

No generic customer quote cost constants may be presented as the driver's actual operating cost. Existing pricing configuration can seed onboarding defaults, but each assumption must be editable and owned by the driver or fleet.

### Recommended Launch Operating Defaults

These values are onboarding seeds, not verified driver costs. The driver must confirm or replace them before the UI labels profit as personalized:

| Assumption | Open/enclosed semi | Pickup + wedge | Treatment |
|---|---:|---:|---|
| Loaded MPG | 6.5 | 9.0 | Driver editable |
| Empty MPG | 8.0 | 12.0 | Driver editable |
| Tank capacity | 200 gal | 60 gal | Driver editable |
| Fuel reserve | 20% | 20% | Hard planning floor |
| Maintenance reserve | $0.22/mi | $0.18/mi | Driver editable |
| Tire reserve | $0.06/mi | $0.04/mi | Driver editable |
| Insurance allocation | $0.16/mi | $0.14/mi | Driver editable |
| Equipment/lease reserve | $0.30/mi | $0.22/mi | Driver editable |
| Driver time value | $30/hour | $30/hour | Driving and on-duty time |
| Detention allowance | 60 min/stop | 60 min/stop | Warn when exceeded |

Fuel price and toll values never come from these defaults. Actual costs entered after a trip remain separate from planned assumptions and are used for driver-approved calibration.

## 5. Fuel Planning

Fuel planning is part of optimization, not a decorative list:

- Capture tank capacity, current fuel level, reserve threshold, loaded MPG, empty MPG, fuel type, preferred chains/cards, and maximum detour.
- Project fuel burn per route leg based on trailer load state.
- Search stations within a route corridor, not only near stop coordinates.
- Filter for diesel, truck access, opening status, card/chain preference, and route compatibility where provider data supports it.
- Optimize total fuel cost: purchase cost plus detour fuel, detour time, and schedule impact.
- Show station name, verified location, live price, price age, gallons planned, projected spend, detour miles/minutes, arrival fuel level, and reason selected.
- Recompute when price, traffic, route, load order, or fuel level changes.
- Never display an estimated station price as a live price.

## 6. Constrained Optimization

Replace the current unconstrained TSP with a pickup-and-delivery vehicle-routing model. A plan is valid only when it satisfies:

- Every pickup precedes its matching delivery.
- Trailer capacity and vehicle slot/size constraints hold after every stop.
- Truck dimensions and restrictions are applied to every route leg.
- Pickup and delivery windows are feasible, including service duration.
- Manual HOS clocks, 30-minute break requirements, 11-hour driving limit, 14-hour window, cycle availability, and required rest are modeled.
- Driver start location, optional end/home location, and departure time are respected.
- Already-picked-up loads begin as onboard inventory and do not receive a new pickup.
- Completed stops cannot be reordered.

Generate alternatives using weighted objectives:

- `balanced`: time, cost, compliance, and profit.
- `fastest`: earliest feasible completion.
- `lowest_cost`: fuel, toll, labor, and operating cost.
- `highest_profit`: net profit and profit per on-duty hour.
- `lowest_risk`: schedule slack, weather, restrictions, and HOS buffer.

Use a proven optimization engine such as OR-Tools behind a service boundary. HERE supplies the road/truck matrix and route details; the optimizer owns load sequencing and business constraints.

## 7. Phase 1: DriveDrop Driver Web Production Release

### 7.1 Backend and Database

Create a neutral route domain now so Phase 2 does not require a rewrite:

- `route_plans`: owner, source, status, objective, version, truck profile, HOS snapshot, origin/end, totals, confidence, provider metadata.
- `route_plan_loads`: route-to-DriveDrop shipment links and immutable planning snapshots.
- `route_stops`: ordered pickups, deliveries, fuel, breaks, overnight, and custom stops.
- `route_legs`: geometry, loaded state, truck route, traffic ETA, toll, fuel, restrictions, and provider freshness.
- `route_cost_items`: estimated and actual cost items with source and confidence.
- `route_events`: plan created, optimized, accepted, started, rerouted, stop arrived/completed, and completed.
- `driver_operating_profiles`: truck/trailer dimensions, MPG, fuel, reserve, fixed/variable cost assumptions, preferences.

### 7.1.1 Basic Launch Truck and Trailer Profiles

Presets reduce onboarding work but are never legal declarations. Every driver must confirm actual registration values, current loaded gross weight, axle count, and cargo before route acceptance.

| Preset | Height | Width | Total length | Routing gross weight | Axles | Trailer count | Vehicle slots |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pickup + 3-car wedge | 11 ft 6 in | 8 ft 6 in | 65 ft | 36,000 lb | 4 | 1 | 3 |
| Open 7-8 car hauler | 13 ft 6 in | 8 ft 6 in | 75 ft | 80,000 lb | 5 | 1 | 8 |
| Enclosed car hauler | 13 ft 6 in | 8 ft 6 in | 75 ft | 80,000 lb | 5 | 1 | 6 |

All presets default to non-hazmat and standard legal dimensions. `Custom` is required for a different trailer, oversize/overweight operation, more than one trailer, hazmat, unusual axle layout, or a vehicle that does not match these presets. Vehicle slots are an initial business-capacity limit; the optimizer must also check cargo weight and dimensions when those facts are available.

The stored profile fields are `name`, `powerUnitType`, `trailerType`, `heightInches`, `widthInches`, `lengthInches`, `grossWeightLb`, `axleCount`, `trailerCount`, `vehicleSlots`, `hazmat`, `loadedMpg`, `emptyMpg`, `tankCapacityGallons`, `reservePercent`, `isPreset`, and `confirmedAt`. HERE requests convert these canonical US units to provider-required units at the adapter boundary.

Add RLS and service-level authorization. Drivers access only their plans and assigned shipments; admins receive explicit scoped access. Route mutations use idempotency keys and optimistic plan version checks.

### 7.2 Services and APIs

- `RoutingProvider` and `HereRoutingProvider`.
- `WeatherProvider`, `FuelPriceProvider`, and provider freshness contracts.
- `RoutePlanService` for CRUD, ownership, versions, and status transitions.
- `RouteOptimizationEngine` for constrained alternatives.
- `RouteCostService` for complete trip economics.
- `FuelPlanService` for corridor station selection and fuel purchases.
- `RouteExecutionService` for location updates, arrival detection, completion, and reoptimization.
- Validation schemas, stop/load limits, route-specific throttling, provider timeouts, retries, circuit breakers, caching, and usage telemetry.

Primary endpoints:

- `POST /route-plans/preview`
- `POST /route-plans`
- `GET /route-plans/:id`
- `POST /route-plans/:id/optimize`
- `POST /route-plans/:id/accept`
- `POST /route-plans/:id/start`
- `POST /route-plans/:id/reoptimize`
- `POST /route-plans/:id/stops/:stopId/complete`
- `POST /route-plans/:id/location`
- `POST /route-plans/:id/costs/actual`

### 7.3 Benji Integration

Add driver-only Benji V3 tools that call the same route services:

- `list_route_eligible_loads`
- `create_route_plan`
- `get_route_plan`
- `compare_route_options`
- `modify_route_plan`
- `accept_route_plan`
- `reoptimize_route_plan`
- `explain_route_costs`
- `find_route_fuel_stops`
- `report_route_condition`

Read-only tools may run immediately. Creating a draft is reversible. Accepting a plan, changing an active plan, claiming loads, or changing shipment status requires explicit confirmation and an audit event. Benji responses reference plan IDs and structured facts returned by tools.

The route planner receives structured Benji events so a successful tool call updates the visible plan/map. Chat text alone must not be treated as an executed route action.

### 7.4 Website Experience

Merge the current Route Planner and Navigation pages into one `Route Operations` entry:

- `Plan`: load selection, truck profile, HOS clocks, start/end, departure, objective, and cost assumptions.
- `Review`: map plus itinerary; alternative comparison; revenue/cost/profit; fuel plan; tolls; weather; traffic; HOS; warnings; data freshness.
- `Drive`: low-distraction next stop, live ETA, remaining HOS, fuel state, hazards, arrival/complete actions, and reoptimization.
- `History`: accepted/completed plans, planned versus actual performance, and reusable profiles.

The map is the primary workspace. Summary cards are limited to the most actionable metrics. Detailed costs use an expandable ledger with source labels. Desktop and mobile-web layouts must be tested, although Phase 1 remains website-only.

### 7.5 Phase 1 Exit Criteria

- No possible route violates pickup precedence or trailer capacity in property/golden tests.
- HERE confirms every production leg against the saved truck profile.
- Server rejects unauthorized shipment IDs and altered client shipment facts.
- Every displayed live value has source and freshness metadata.
- Provider outages produce honest partial/unavailable states and never fabricated values.
- Plans survive refresh, support versioning, and maintain an audit trail.
- Benji can create, compare, explain, modify, and reoptimize the visible plan through tools.
- Fuel stops include live station prices or are explicitly unavailable.
- Cost ledger reconciles to its displayed total and supports driver assumptions.
- Focused unit, integration, authorization, provider-contract, and Playwright tests pass.
- Pilot routes are checked against known truck routes and reviewed by real drivers before general release.

## 8. Phase 2: Standalone Independent-Driver Product

### 8.1 Load Intake

- Manual load entry with address validation.
- CSV/XLSX import with review and correction.
- Email/rate-confirmation document extraction with source attachment and confidence.
- Public API and webhooks.
- Adapter model for load boards, brokers, TMS, and ELD providers without coupling the route engine to any one source.
- Duplicate detection and canonical load records.

### 8.2 Decision Intelligence

- Recommend which offered loads to accept, not only how to sequence accepted loads.
- Model incremental profit, deadhead, reload probability, appointment risk, home-time preference, HOS feasibility, trailer fit, and payment/factoring effects.
- Compare adding or removing a load from an existing route.
- Backhaul and reload suggestions near final delivery.
- Scenario planning: fuel price change, delayed pickup, road closure, rejected load, breakdown, or changed destination.
- Learn driver-specific actual MPG, stop duration, detention, and operating cost from completed plans with user review.

### 8.3 Standalone Operations

- Subscription and usage limits with transparent provider-cost controls.
- Multi-truck/fleet profiles, dispatcher collaboration, and driver assignment.
- Shareable route/run sheet and customer ETA links.
- Offline-tolerant active-plan snapshot for weak connectivity.
- ELD adapters and automated HOS synchronization.
- Actual expense capture from receipts and fuel transactions.
- Tax/export reports and route profitability history.

### 8.4 Phase 2 Exit Criteria

- A driver with no DriveDrop shipments can import loads, optimize, execute, and close a trip.
- All load facts retain source provenance and review status.
- Independent-driver data is tenant-isolated from DriveDrop marketplace data.
- Subscription quotas cover routing, weather, fuel, toll, AI, storage, and document-processing costs.
- Recommendations expose assumptions, uncertainty, and the reason each load improves or harms the plan.

## 9. Testing and Observability

- Golden routes covering multi-load precedence, capacity, picked-up loads, time windows, overnight/HOS, truck restrictions, tolls, fuel range, and provider outages.
- Property tests for precedence, capacity, no missing/duplicate stops, monotonic ETAs, and cost reconciliation.
- Contract tests against recorded, sanitized provider responses; live provider smoke tests outside normal unit runs.
- Authorization and RLS tests for every plan and shipment operation.
- Benji tests proving correct tool selection, role blocking, confirmation, structured results, and no invented live data.
- Playwright tests and screenshots at desktop and mobile-web sizes.
- Metrics: optimization latency, provider latency/error/rate limit, cache hit rate, cost per plan, infeasible plans, reroutes, ETA error, planned-vs-actual cost, and Benji tool success.
- Alerts for provider failure, stale safety data, unusual API spend, optimizer infeasibility spikes, and route execution update loss.

## 10. Information and Access Required From Product Owner

### Required Before Phase 1 Live-Provider Work

1. HERE project exists. Rotate the screenshot-exposed API key, place the replacement in the backend/Railway `HERE_API_KEY`, confirm Routing v8 and Matrix Routing access, and set expected monthly route volume and billing alerts.
2. Fuel-price vendor selection and credentials. Required coverage: station-level diesel price, update timestamp, truck-access metadata if available, US coverage, and commercial display/storage rights.
3. Weather vendor selection and credentials. Required coverage: route-point forecasts, severe alerts, precipitation, wind/gust, visibility, ice/snow, and commercial use rights.
4. HERE toll data is the launch recommendation. Reconsider a dedicated toll provider only after pilot estimates are reconciled with actual toll statements.
5. DriveDrop launch defaults: loaded/empty MPG ranges, tank sizes, reserve policy, maintenance/tire/insurance/depreciation assumptions, labor/time valuation, detention policy, and default fees. Drivers must confirm or override these values before profit is labeled personalized.
6. The three basic presets above are approved for launch planning. Drivers must confirm actual values; custom, hazmat, and oversize/overweight profiles remain blocked until their required fields and operating policy are defined.
7. Safety rule review confirming the selected policy: pickup precedence, capacity, truck restrictions, and HOS/legal violations are hard blocks; schedule, profitability, weather caution, and preference conflicts are warnings with explicit driver override where legally appropriate.
8. Pilot drivers and representative real routes for acceptance testing.

### Required Before Phase 2

1. Initial standalone customer segment: owner-operators only or small fleets as well.
2. First external load sources and access method.
3. First ELD integration based on pilot-driver usage.
4. Subscription model, route/API quotas, trial policy, and target gross margin.
5. Data retention, document retention, expense retention, and account deletion policies.

## 11. Immediate Repository Hygiene

- Rotate any credential that has been exposed outside its intended secret store.
- Remove real-looking credentials from example files and replace them with placeholders.
- Keep provider credentials server-side; only browser-restricted map-rendering keys may be public.
- Apply domain, IP, API, and quota restrictions to every provider key.
- Add automated secret scanning to CI before route-provider credentials are introduced.

## 12. Recommended Execution Sequence

1. Resolve the Phase 1 provider/account and operating-profile inputs above.
2. Build migrations, shared contracts, authorization, and provider interfaces.
3. Implement HERE truck matrix/routing and the constrained optimizer with tests.
4. Add persistence, costs, fuel planning, HOS, weather, and execution services.
5. Integrate Benji V3 tools and structured frontend plan updates.
6. Replace the two current pages with Route Operations and validate via Playwright.
7. Run pilot routes, calibrate cost assumptions, and release behind a driver feature flag.
8. Begin Phase 2 only after Phase 1 route quality, provider cost, and pilot metrics meet agreed thresholds.