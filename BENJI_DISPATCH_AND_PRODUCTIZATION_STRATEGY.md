# Benji Dispatch and Productization Strategy

**Status:** Architecture, risk, implementation, and commercialization assessment
**Date:** August 18, 2026
**Scope:** Dispatch lifecycle, route optimization, operations intelligence, multi-tenancy, APIs, licensing, and go-to-market

**Cross-cutting gaps:** Record adjacent incomplete or unsafe foundations in `PRODUCT_READINESS_GAP_REGISTER.md` and apply its triage rule before expanding this strategy's scope.

## Executive Summary

Benji can become both DriveDrop's operating system and a family of products sold to other transportation companies. The correct approach is not to split the codebase into unrelated products. Build one tenant-aware intelligence platform with independently licensed capabilities:

- Benji Pricing Intelligence.
- Benji Route Intelligence.
- Benji Dispatch Copilot.
- Benji Load Matching.
- Benji Communications and Operations Assistant.
- Benji Dispatch OS as the complete suite.

The existing repository contains valuable foundations for all of these products. It does not yet have the security, tenant isolation, data contracts, billing, configuration, reliability, or operational accuracy needed to sell them as production SaaS.

The highest-leverage business sequence is:

1. Make dispatch trustworthy inside DriveDrop.
2. Extract stable domain services behind internal APIs.
3. Offer managed pilots to a small number of design partners.
4. Productize Pricing and Route APIs first.
5. Offer Dispatch Copilot next, retaining human approval.
6. Offer the full multi-tenant Dispatch OS only after tenant isolation and workflow reliability are proven.

## Product Vision

Benji should be understood as a transportation intelligence platform, not simply a chatbot.

The conversational agent is one interface. The durable product value is the shared operational intelligence underneath it:

- Pricing and margin decisions.
- Driver-load compatibility.
- Assignment optimization.
- Capacity and lane balancing.
- Route and ETA planning.
- Workflow orchestration.
- Exception detection and resolution.
- Customer, carrier, and dispatcher communications.
- Auditable approvals and operational analytics.

Each module should use the same canonical shipment, driver, vehicle, lane, quote, assignment, route, event, and policy contracts.

## Verified Dispatch Architecture

### Production workflow paths

DriveDrop currently has several overlapping dispatch paths:

1. **Driver marketplace:** Drivers browse unassigned pending shipments and apply.
2. **Application approval:** Admins accept or reject driver applications using database procedures.
3. **Admin direct assignment:** Admins select a driver and assign a shipment.
4. **Benji Dispatcher:** Admins request heuristic load-driver matches and submit selected assignments.
5. **Driver recommendations:** Benji ranks pending loads for an individual driver.
6. **Benji V3 operations:** The agent can list loads, apply, withdraw, assign as admin, update statuses, message participants, and plan assigned routes.
7. **Route Optimization API:** Drivers and admins can submit arbitrary stop and shipment data for optimization.

These paths are not yet unified behind one assignment domain service or one state machine.

## Capability Assessment

| Capability | Current maturity | Assessment |
|---|---:|---|
| Shipment marketplace | 3/5 | Usable for single-platform operations |
| Driver applications | 3/5 | Database procedures exist; workflow inconsistencies remain |
| Admin assignment | 2/5 | Functional but not consistently atomic or eligibility-aware |
| Automated matching | 2/5 | Heuristic prototype presented as AI |
| Driver recommendations | 2/5 | Useful UI concept; action path is incomplete |
| Capacity/equipment matching | 1/5 | Route slot constraint exists, assignment eligibility does not |
| Multi-load optimization | 3/5 | Strongest dispatch intelligence component |
| Live driver location | 1/5 | Data concepts exist; reliable runtime feed is missing |
| ETA and exception monitoring | 1/5 | No closed-loop live operational engine |
| Pickup/delivery evidence | 3/5 | Useful foundation, fragmented across workflows |
| Messaging/notifications | 3/5 | Multiple channels exist; dispatch escalation policy is incomplete |
| Dispatch analytics | 1/5 | On-demand estimates, little outcome measurement |
| Multi-tenant SaaS | 1/5 | Partial commercial accounts are not tenant isolation |
| External product APIs | 1/5 | Endpoints exist but contracts, auth, metering, and isolation are incomplete |

## Deep Dispatch Findings

### 1. Shipment visibility and readiness

Dispatch analysis considers shipments where:

- `driver_id` is null.
- Status is `pending`.

It does not consistently establish that:

- Payment or credit approval is complete.
- Shipment data is operationally complete.
- Vehicle count and operability are valid.
- Pickup and delivery coordinates are fresh and validated.
- Required documents or gate passes exist.
- The shipment is eligible for the requesting company or carrier network.

A shipment needs an explicit `dispatch_ready` projection derived from validated commercial, payment, document, service, and scheduling requirements.

### 2. Driver availability is not actually measured

The dispatcher fetches all profiles with role `driver`. It does not filter by:

- Verification state.
- Current availability.
- Active duty status.
- Current assignments and remaining capacity.
- Home terminal or preferred region.
- Hours of service.
- Equipment and trailer.
- Insurance and registration expiration.
- Tenant or approved carrier network.

The resulting `available_drivers` count should not be treated as an operational metric.

### 3. Driver location is unreliable

Both matching services estimate location from the driver's last completed shipment. Drivers without history default to Austin, Texas.

This directly affects 35% of recommendation score and 40% of dispatch score. New drivers, inactive drivers, and drivers who reposition after delivery therefore receive misleading rankings.

Required location hierarchy:

1. Fresh, consented GPS position.
2. Recent tracking event or check-in.
3. Current assignment's projected route position.
4. Explicit available-from location and timestamp.
5. Home terminal or preferred operating region.
6. Unknown, with proximity omitted and confidence reduced.

Never substitute a geographically unrelated default point.

### 4. Matching is heuristic, not AI

#### Admin dispatch score

- Proximity: 40%.
- Route fit: 25%.
- Earnings: 20%.
- Completed-shipment experience: 10%.
- Rating: 5%.

#### Driver recommendation score

- Proximity: 35%.
- Route fit: 30%.
- Earnings: 25%.
- Load recency: 5%.
- Compatibility: 5%.

The current compatibility score only checks whether year/make/model text exists. It does not evaluate physical compatibility.

The confidence values are also heuristic. Admin dispatch confidence is approximately score plus points for generated reasons. Recommendation confidence starts at 70 and adds points for available fields and rating. Neither represents calibrated completion, acceptance, or service-quality probability.

The UI should label these as rule-based match scores until validated predictive models exist.

### 5. Economic scoring uses the customer price

The earnings score uses customer `estimated_price` and assumes the driver receives a hardcoded 80%. It does not use:

- A negotiated or offered carrier rate.
- Driver-specific minimums.
- Deadhead and loaded miles separately.
- Tolls, fuel, time, equipment, and opportunity cost.
- Broker or carrier contract terms.
- Tenant-specific payout policy.

Dispatch should optimize contribution and fulfillment probability, not simply favor the largest customer quote.

### 6. The assignment optimizer is greedy

Loads are sorted by price and age. The service chooses the highest-scoring unused driver for each load. Each driver can receive only one load during an analysis run, even if they operate a multi-car hauler.

This does not model:

- Multiple vehicles per trailer.
- Pickup and delivery precedence across assignments.
- Existing onboard vehicles.
- Time windows.
- Hours of service.
- Driver route continuation.
- Driver preferences or declining behavior.
- Contracted carriers and tenant boundaries.
- Global fleet profit or service-level optimization.

The target is a constraint optimization problem. Begin with a solver-based objective, then add learned acceptance/cost predictions as features.

### 7. Assignment is not consistently atomic

The application and direct-assignment SQL procedures read shipment status and driver state, then update later without a row lock. Benji V3's direct assignment updates by shipment ID without checking current status, current driver, or driver eligibility.

The admin batch endpoint accepts complete match objects from the browser. It trusts caller-supplied load, driver, score, confidence, and economics instead of accepting IDs and recomputing server-side.

The batch update conditions on `driver_id IS NULL`, but does not request updated rows or verify that one row was affected before reporting success.

Required assignment command behavior:

- Receive shipment ID, driver ID, recommendation version, and idempotency key.
- Lock or atomically compare-and-set the shipment.
- Revalidate dispatch readiness and driver eligibility inside the transaction.
- Persist the decision snapshot and actor.
- Update related applications.
- Create assignment and status events.
- Queue notifications through an outbox.
- Return a conflict when another assignment wins.

### 8. Driver recommendation acceptance is misleading

The driver UI's `Accept Load` action displays success but performs no API request. This must be removed or wired to the intended application/offer workflow before production use.

The product must distinguish:

- **Apply:** Driver expresses interest; dispatcher decides.
- **Offer:** Dispatcher offers a load; driver accepts or declines before expiration.
- **Instant book:** Eligible driver atomically claims an explicitly instant-bookable load.
- **Assign:** Authorized dispatcher creates a binding assignment.

Those are different commercial and legal events and should not share ambiguous UI language.

### 9. Route optimization is promising but overstated

The route service includes:

- Google distance matrices and directions.
- Nearest-neighbor ordering.
- 2-opt route improvement.
- Pickup-before-delivery constraints.
- Configurable trailer slot capacity.
- Stop durations and estimated arrival times.
- Regional corridor tips.
- Fuel estimates and break recommendations.

Important limitations:

- Traffic warnings are time-of-day rules, not a live incident feed.
- Fuel prices are hardcoded regional estimates but stamped with the current response time.
- Weather output is seasonal text, not live weather.
- Time windows are sorted by deadline but actual feasibility is not rigorously enforced.
- Break planning is advisory and not connected to electronic logs or actual duty time.
- `returnToOrigin`, `avoidHighways`, `maxDetourMinutes`, and some daily-plan options are accepted but not fully applied.
- The public route endpoints accept caller-supplied shipment IDs, addresses, payouts, and slot counts without verifying ownership of those shipments.
- Benji V3's internal route tool is safer because it queries assigned shipments server-side.

The route engine should be productized around trusted shipment references or explicitly documented stateless stops, never a mixture that implies authorization.

### 10. Status transitions are fragmented

Benji V3 permits several statuses but does not enforce a complete transition graph. Direct database updates, controllers, RPCs, payment handlers, pickup verification, and agent tools can each mutate shipment state.

Create one transition service with:

- Allowed transition graph.
- Role and tenant authorization.
- Preconditions and evidence requirements.
- Idempotency.
- Timestamp and actor attribution.
- Transactional event/outbox records.
- Compensation behavior for failed downstream operations.

### 11. Live operations and exception handling are missing

Benji cannot yet reliably detect or act on:

- Driver is late or stationary unexpectedly.
- Pickup window will be missed.
- Route has become infeasible.
- Driver declined or did not respond to an offer.
- Equipment failed.
- Weather or closure threatens delivery.
- Shipment data differs at pickup.
- Carrier cost or margin has changed.

These require live events and deterministic incident policies before adding an LLM explanation layer.

### 12. Metrics are estimates, not measured outcomes

The dispatcher reports:

- Efficiency from average match score and confidence.
- Fuel savings from an assumed 10% distance reduction.
- Time savings from an assumed 15 minutes per assignment.

These should not be marketed as achieved savings. Store dispatch runs and compare them against actual control outcomes.

Required measurements include:

- Time to first offer and assignment.
- Offer acceptance and decline rate.
- Assignment-to-pickup cancellation.
- Deadhead and loaded miles.
- Capacity utilization.
- On-time pickup and delivery.
- Manual override rate and reason.
- Predicted versus actual carrier cost.
- Margin and contribution by decision version.
- Claims and service failures.
- Dispatcher minutes per completed load.

## Immediate Dispatch Remediation

### Priority 0: Safety and truthfulness

1. Disable or wire the false `Accept Load` action.
2. Stop calling heuristic scores and estimated savings AI certainty.
3. Replace Austin fallback with unknown-location handling.
4. Filter verified, active, available, compliant drivers.
5. Add equipment, insurance, capacity, and service eligibility gates.
6. Make all assignment paths atomic and idempotent.
7. Recompute selected matches server-side; never trust browser-submitted scores.
8. Add ownership checks to route optimization or make stateless behavior explicit.
9. Centralize status transitions.
10. Record complete assignment and recommendation outcomes.

### Priority 1: Operational foundation

- Canonical driver availability and available-from location.
- Driver equipment and trailer capacity model.
- Offer, application, instant-book, and assignment entities.
- Assignment policy and approval modes.
- Live location ingestion with consent and retention controls.
- ETA refresh and exception events.
- Transactional outbox for notifications and webhooks.
- Persistent dispatch runs, candidates, decisions, overrides, and outcomes.

### Priority 2: Optimization

- Constraint solver for multi-load, multi-driver assignment.
- Real traffic, weather, toll, and fuel features.
- Hours-of-service and time-window feasibility.
- Carrier bid and acceptance workflow.
- Learned cost, acceptance, lateness, and cancellation predictions.
- Shadow and controlled rollout modes.

## Target Dispatch Architecture

### Domain services

- **Shipment Readiness Service:** Determines whether a shipment can enter dispatch.
- **Driver Eligibility Service:** Applies hard safety, compliance, equipment, capacity, and tenant constraints.
- **Candidate Generation Service:** Produces plausible driver-load or carrier-load candidates.
- **Feature Service:** Resolves location, route, cost, capacity, history, and live-condition features.
- **Scoring Service:** Produces versioned, explainable predictions and rule scores.
- **Optimization Service:** Selects the best global assignment set under constraints.
- **Offer Service:** Manages timed offers and responses.
- **Assignment Service:** Performs atomic binding assignments.
- **Route Service:** Optimizes assigned work and refreshes ETA.
- **Incident Service:** Detects and manages operational exceptions.
- **Communication Service:** Sends tenant-branded messages from event policies.
- **Audit and Evaluation Service:** Records inputs, versions, decisions, overrides, and outcomes.

### Benji's role

Benji should:

- Gather missing information.
- Invoke domain services.
- Explain recommendations and tradeoffs.
- Ask for approval when policy requires it.
- Monitor incidents and summarize recommended actions.
- Execute approved commands through governed tools.

Benji should not:

- Bypass eligibility rules.
- Write shipment assignments directly.
- Generate prices or payouts without the financial engine.
- Invent live traffic, weather, or fuel conditions.
- Treat model confidence as authorization.

## Can Benji Be Sold or Rented?

Yes. The product opportunity is credible, but the saleable asset is the governed operational platform, not the current chatbot wrapper.

### Potential customers

- Vehicle transport brokers.
- Small and mid-sized carrier fleets.
- Dealership groups.
- Auto auctions and remarketing operators.
- Rental and fleet-repositioning companies.
- Freight dispatch agencies.
- Towing and recovery networks after domain-specific configuration.
- Enterprise shippers with private carrier networks.

Do not claim general freight readiness until cargo, equipment, dimensional, regulatory, and workflow differences are explicitly modeled. The current system is vehicle-transport oriented.

## Product Packaging

### 1. Benji Pricing API

**Buyer:** Brokers, marketplaces, auctions, dealerships, transport software vendors.
**Value:** Quote, carrier-cost range, margin recommendation, confidence, and explanation.
**Integration:** REST API, SDK, webhook, and embedded quote widget.
**Commercial model:** Per quote plus monthly platform fee.

This can become the first external product after the pricing correctness, feature snapshot, tenant policy, authentication, and metering work in the pricing strategy is complete.

### 2. Benji Route Intelligence API

**Buyer:** Small fleets, dispatch software vendors, dealerships, recovery operators.
**Value:** Multi-stop sequencing, pickup-delivery precedence, trailer capacity, ETA, route cost, and reoptimization.
**Integration:** Stateless stops API or tenant-owned shipment references.
**Commercial model:** Per optimized stop/route or fleet subscription.

This is technically closest to extraction, but it needs generalized geography, real source labeling, strict request contracts, ownership controls, quotas, and asynchronous jobs for large plans.

### 3. Benji Dispatch Copilot

**Buyer:** Brokers and fleet dispatch teams that retain human dispatchers.
**Value:** Candidate ranking, load offers, assignment recommendations, exception alerts, and conversational operations.
**Integration:** Web dashboard plus APIs/webhooks to the customer's TMS.
**Commercial model:** Per dispatcher seat plus per active truck or completed load.

This should be sold before autonomous dispatch. Human approval reduces operational and contractual risk while generating the labels needed for better models.

### 4. Benji Load Matching

**Buyer:** Carrier networks, brokerages, and marketplaces.
**Value:** Rank loads for drivers or carriers using compatibility, position, capacity, economics, and preferences.
**Integration:** Recommendations API and embeddable feed.
**Commercial model:** Per active driver/carrier, per recommendation batch, or success fee where legally appropriate.

This requires accurate availability, equipment, location, and response tracking before sale.

### 5. Benji Communications and Operations Assistant

**Buyer:** Small transport teams with high call/SMS volume.
**Value:** Shipment intake, status answering, document requests, reminders, exception triage, and dispatcher summaries across web/SMS/voice.
**Integration:** Hosted channels or API into existing communications.
**Commercial model:** Platform fee plus message, minute, and model usage.

Tenant knowledge retrieval, consent, escalation, recording policy, and branded templates are prerequisites.

### 6. Benji Dispatch OS

**Buyer:** Companies replacing spreadsheets or basic dispatch tools.
**Value:** Full quote-to-delivery operating system.
**Integration:** Hosted SaaS, enterprise deployment, and integration hub.
**Commercial model:** Base subscription, users/vehicles, transaction volume, and premium modules.

This is the largest opportunity and the last product that should be opened broadly because it requires complete tenant isolation and operational breadth.

## Commercial Models

### Recommended

- **SaaS subscription:** Recurring base fee with tiered usage.
- **Usage-based API:** Quotes, optimized stops, active shipments, messages, or model calls.
- **Per active vehicle:** Appropriate for fleet dispatch and route products.
- **Per completed load:** Aligns value but requires precise attribution and contractual controls.
- **Enterprise annual contract:** Includes SSO, audit, custom integrations, support, and service commitments.
- **Managed service:** DriveDrop operates Benji for the customer during early pilots.

### Use cautiously

- **Revenue share:** Attractive but introduces attribution, reconciliation, regulation, and margin disputes.
- **White-label licensing:** Valuable after branding, tenant config, support boundaries, and data processing contracts exist.
- **On-premise/private cloud:** Enterprise-only; operationally expensive for a startup.
- **Source-code licensing:** Avoid as a default. It fragments the platform and weakens recurring revenue and data advantages.

“Renting Benji” should generally mean SaaS access or managed operations, not transferring model or source ownership.

## One Platform, Multiple Products

Avoid creating separate pricing, routing, and dispatch forks. Use a modular monolith first, with enforceable package boundaries and versioned APIs.

Shared platform capabilities:

- Identity, tenant context, roles, and service accounts.
- Canonical operational data model.
- Policy and approval engine.
- Feature collection and source health.
- Audit events and evaluation.
- Usage metering and billing.
- Webhooks and integrations.
- Prompt, rule, and model registry.
- Secrets and provider configuration.
- Branding and communications.

Licensed capability flags determine which APIs, screens, tools, and jobs are available to each tenant.

## Multi-Tenancy Readiness

### Existing useful foundation

- `commercial_accounts` with API key hashes, webhook settings, credit, and rate-limit fields.
- `commercial_account_id` on shipments.
- Integration, webhook, BOL, and bulk-upload concepts.
- RLS policies for some commercial resources.
- Stripe subscription service code.

### Why this is not yet SaaS tenancy

- Core profiles, shipments, drivers, payments, messages, pricing, dispatch, and Benji sessions do not share a mandatory tenant boundary.
- Dispatch queries do not filter by `commercial_account_id`.
- One user owns each commercial account; organization membership and multi-role teams are absent.
- Commercial shipments are expected to have an account only by application convention, not a database constraint.
- Platform administrators and tenant administrators are not distinct roles.
- Tenant configuration, branding, feature entitlements, and model policies are absent.
- Service-role clients bypass RLS and therefore require flawless application authorization.
- Secrets and provider accounts are global.
- Usage and billing are incomplete.

### Critical commercial API security issue

The current `requireAdmin` middleware only checks that an Authorization header begins with `Bearer`; it contains a TODO instead of verifying the JWT or role. The routes use a Supabase service-role client, so any caller with any Bearer string could potentially invoke privileged commercial-account operations when the feature is enabled.

Do not expose this API until real authentication, authorization, input validation, audit, and tenant scoping are implemented.

## Required SaaS Foundation

### Identity and isolation

- `organizations` or `tenants`.
- `organization_members` with tenant roles.
- Mandatory `tenant_id` on all tenant-owned records.
- Tenant ID derived from verified identity or service credential, never trusted from request bodies.
- Composite foreign keys or database checks preventing cross-tenant references.
- RLS policies and application-level authorization tests.
- Separate platform-admin and tenant-admin privileges.
- Service accounts with scoped permissions.

### Configuration

- Tenant pricing and dispatch policies.
- Geography, currency, units, vehicle/equipment taxonomy, and operating rules.
- Approval limits and automation modes.
- Branding, domains, email/SMS/voice identity, and legal links.
- Provider configuration and encrypted secrets.
- Feature entitlements and limits.

### External API platform

- Versioned OpenAPI contracts.
- OAuth client credentials or securely scoped API keys.
- Key rotation, expiration, and revocation.
- Idempotency keys for writes.
- Request signing for high-risk callbacks.
- Tenant and endpoint rate limits.
- Usage records and customer-visible logs.
- Signed, retried, ordered webhooks with dead-letter handling.
- Sandbox accounts and test credentials.
- SDKs only after the API contract stabilizes.

### Reliability and operations

- Background job system.
- Transactional outbox.
- Distributed tracing with tenant-safe logs.
- Service-level indicators and alerting.
- Provider failure and fallback policies.
- Backup, restore, export, retention, and deletion by tenant.
- Incident response and customer support tooling.

### AI and data governance

- Per-tenant data usage and model-training consent.
- Explicit prohibition on cross-tenant retrieval.
- Redaction and retention policy for prompts and documents.
- Model, prompt, feature, and policy version audit.
- Evaluation by tenant and domain without leaking customer data.
- Human approval controls for financial and binding operational actions.

## Build, Partner, or License

### Build internally

- Canonical transportation domain model.
- Pricing and dispatch policy engine.
- Candidate generation and assignment orchestration.
- Benji tool governance and explanations.
- Tenant configuration, audit, and product APIs.
- Proprietary carrier response and operational outcome data.

### Partner or license

- Maps, traffic, tolls, and geocoding.
- Fuel and weather data.
- ELD and telematics integrations.
- FMCSA and insurance verification.
- External load-board or market-rate access.
- Voice, SMS, email, payments, and identity providers.
- Optimization solver libraries where they outperform custom heuristics.

Do not hand-roll commodity infrastructure solely to label Benji as proprietary. Proprietary value should come from transportation decisions, workflow, data, and measurable outcomes.

## Go-to-Market Sequence

### Stage 1: Internal proof

- Correct high-risk dispatch defects.
- Run recommendations in shadow mode.
- Measure dispatcher decisions and outcomes.
- Establish credible baseline metrics.
- Use DriveDrop as the first and most demanding tenant.

### Stage 2: Design partners

Recruit two to five narrowly matched partners, such as vehicle transport brokers or small fleets.

Offer a managed Dispatch Copilot with:

- Isolated account and data.
- Manual approval required.
- Limited integrations.
- Weekly outcome review.
- Contractual permission to use de-identified operational feedback where appropriate.

Do not promise autonomous dispatch or generalized freight coverage.

### Stage 3: APIs

Release Pricing and Route APIs with:

- Sandbox.
- Strong contracts.
- Metering.
- Source freshness and confidence.
- Service status.
- Clear geographic and cargo limitations.

### Stage 4: Dispatch SaaS

Release Dispatch Copilot to a broader segment after tenant isolation, eligibility, offers, atomic assignment, and live operational events are reliable.

### Stage 5: Dispatch OS and ecosystem

- Full configurable workflow.
- Integration marketplace.
- White-label option.
- Enterprise security and support.
- Domain packs for adjacent transportation categories.

## Suggested Initial Market Position

Do not begin by marketing “AI dispatch for everyone.” A more credible initial position is:

> Transportation intelligence for vehicle logistics teams: price loads, match capacity, optimize routes, and manage exceptions from one governed system.

The narrow vehicle-logistics focus is an advantage. It gives Benji a specific vocabulary, workflow, equipment model, carrier network, and data advantage. Adjacent verticals can be added as explicit domain packs rather than diluting the initial product.

## Pricing the Products

Validate willingness to pay with design partners before fixing public prices. A workable structure is:

- Platform fee for tenant, support, and core integrations.
- Per-user fee for dispatchers and administrators.
- Per-active-vehicle fee for fleet operations.
- Usage fee for quotes, optimized stops, communications, and high-cost AI calls.
- Enterprise minimum commitment for custom integrations and service levels.

Expose usage transparently. Avoid charging customers for retries or provider failures that Benji causes internally.

## Product Metrics

### Customer value

- Dispatcher hours per completed load.
- Time to assign and time to carrier acceptance.
- Empty-mile reduction.
- Capacity utilization.
- On-time pickup and delivery.
- Gross margin improvement.
- Quote and offer conversion.
- Exceptions prevented or resolved before service failure.

### Product health

- Recommendation adoption and override rate.
- Assignment conflict rate.
- API and provider availability.
- Decision latency.
- Model and rule calibration.
- Tenant retention and module expansion.
- Support requests per active shipment.
- Gross margin after model, map, messaging, and support costs.

## Implementation Roadmap

### Phase 0: Internal trust

- Fix assignment, eligibility, location, acceptance, and status-transition defects.
- Correct product language around scores and estimated savings.
- Persist dispatch decisions and outcomes.
- Secure commercial APIs.

### Phase 1: Domain consolidation

- Build readiness, eligibility, offer, assignment, and incident services.
- Route all UIs, APIs, and Benji tools through them.
- Add event/outbox architecture and idempotency.
- Define versioned canonical contracts.

### Phase 2: Tenant foundation

- Add organizations, membership, tenant context, and tenant-owned records.
- Backfill DriveDrop as the initial tenant.
- Enforce tenant isolation in database and services.
- Add tenant policy, branding, provider, and entitlement configuration.

### Phase 3: Product APIs and metering

- Release internal versioned Pricing, Route, Candidate, Offer, and Assignment APIs.
- Add scoped credentials, quotas, usage events, billing, and signed webhooks.
- Create sandbox and conformance tests.

### Phase 4: Managed design-partner pilots

- Deploy Dispatch Copilot with manual approvals.
- Integrate partner TMS/load data.
- Measure operational and financial outcomes.
- Refine configuration boundaries and onboarding.

### Phase 5: General availability

- Pricing and Route APIs first.
- Dispatch Copilot second.
- Full Dispatch OS after operational and tenant maturity.
- Add domain packs only with explicit schemas, policies, tests, and market evidence.

## Readiness Gates

### Pricing or Route API

- Tenant-safe authentication and metering.
- Stable versioned contract.
- Reproducible output and source labeling.
- Idempotency and failure semantics.
- Quotas, monitoring, and support runbooks.
- No misleading live-data claims.

### Dispatch Copilot

- Verified eligibility and capacity.
- Fresh or explicitly unknown driver location.
- Atomic offers and assignments.
- Complete decision and override audit.
- Tenant isolation.
- Human approval and rollback.
- Measured internal performance.

### Autonomous dispatch

- Reliable live operations data.
- Calibrated outcome predictions.
- Constraint-safe optimizer.
- Exception detection and recovery.
- Contractual authority to bind assignments.
- Demonstrated performance in shadow and controlled production cohorts.
- Financial, safety, and compliance guardrails independent of the model.

## Final Recommendation

Benji should remain one system internally and become multiple products commercially through capability boundaries, tenant configuration, and entitlements.

The near-term business should be a **managed, human-approved Dispatch Copilot for vehicle logistics**, supported by separately metered Pricing and Route services. This uses DriveDrop's strongest domain knowledge, generates proprietary operational feedback, and avoids prematurely taking responsibility for autonomous dispatch decisions.

Build the full Dispatch OS as the platform destination, not the first external SKU.
