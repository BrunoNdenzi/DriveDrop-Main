# Benji Pricing Intelligence Implementation Strategy

**Status:** Architecture assessment and implementation roadmap
**Date:** August 18, 2026
**Scope:** Benji pricing, live-data intelligence, governance, feedback, and training

## Executive Summary

DriveDrop's intended architecture is for Benji Pricing Intelligence to be the primary pricing coordinator, with administrators governing limits and approving exceptional decisions. The current runtime does not yet implement that operating model.

Today, primary quote paths use a deterministic baseline calculator and explicitly disable the existing pricing intelligence layer. The intelligence layer is rules-based rather than machine-learned, depends heavily on internal quote history, and is designed to reject low-history decisions. That is unsuitable for a startup with limited historical data.

The target architecture should make Benji the orchestrator of:

1. A deterministic economic floor.
2. A live-data feature and market intelligence engine.
3. A versioned pricing decision service.
4. An approval, audit, and rollback layer.

GPT should gather inputs and explain decisions. It should not freely invent numeric prices or bypass financial controls.

## Verified Current State

### Live quote paths

- Benji V3 calculates route distance using Google Maps and then calls `calculateQuoteWithDynamicConfig` directly.
- Benji V2 routes through `pricingDecisionService`, but explicitly sets `enableIntelligence: false`.
- Website pricing explicitly sets `enableIntelligence: false`.
- Natural-language shipment pricing and voice pricing also disable intelligence.
- Only the authenticated mobile pricing endpoint can request intelligence by passing `enable_intelligence: true`.

### Baseline calculation

The baseline pricing engine uses:

- Hardcoded per-mile rates by vehicle type and distance band.
- Database-configured minimum prices and distance thresholds.
- Fuel, surge, delivery-speed, and bulk-discount configuration.
- A Benji V3-only enclosed transport premium.

The service calculates operating cost and a 30% profit amount for its breakdown, but neither value participates in the final quoted total. The effective formula remains based on hardcoded rate-per-mile values and multipliers.

### Existing pricing intelligence

The optional intelligence service can inspect:

- Ninety days of matching internal quotes.
- Quoted-price average, minimum, and maximum.
- Booking conversion rate.
- Seven-day quote and booking activity.
- Time to booking.
- Customer quote and booking behavior.
- A basic active-shipment demand heuristic.

It then applies deterministic policy rules for historical alignment, demand, loyalty, conversion, and momentum. This is operational analytics, not machine learning.

### Feedback and analytics infrastructure

The repository contains services for:

- Quote and shipment outcome events.
- Quote history.
- Pricing performance comparisons.
- Confidence calibration summaries.
- Route analytics.
- Read-only policy recommendations.

However, the intelligence REST router is not registered in the central route index. Actual shipment cost and revenue recording has no verified production caller outside that unmounted router. The feedback loop is therefore largely dormant.

## Critical Gaps Before Autonomous Pricing

1. Intelligence is disabled in every primary quote path.
2. Benji V3 bypasses `pricingDecisionService` entirely.
3. The intelligence router is not mounted.
4. Feedback endpoints need authentication, authorization, validation, and idempotency before mounting.
5. Current demand likely always falls back to `medium` because the Supabase count result is read incorrectly.
6. Exact origin and destination strings are used as route identity, creating fragmented lane history.
7. No-history confidence is intentionally too low for intelligence-led pricing.
8. Confidence is a hand-built data-quality score, not a calibrated probability.
9. Operating costs and target profit are not enforced in the quoted total.
10. Base rates and cost components remain hardcoded.
11. Enclosed transport pricing is outside the central pricing engine.
12. Quote rejection, expiration, negotiation, and abandonment are not reliably distinguished.
13. Actual carrier cost, revenue, and margin are not automatically captured.
14. The admin UI writes directly to Supabase, bypassing backend validation and cache invalidation.
15. Intelligence policy fields exist in the database but are not exposed in the admin UI.

## Target Architecture

### 1. Economic floor engine

The floor must be deterministic, inspectable, and impossible for an LLM or adaptive model to bypass. It should include:

- Expected carrier compensation.
- Origin deadhead and destination imbalance.
- Fuel and tolls.
- Loading, unloading, and waiting time.
- Insurance, maintenance, payment processing, and claims reserve.
- Service-specific costs for inoperable, oversized, expedited, enclosed, auction, port, and accident-recovery moves.
- Minimum required contribution margin.

### 2. Live intelligence engine

For every quote, create a versioned feature snapshot containing:

- Traffic-aware route duration, distance, and tolls.
- Regional and local fuel prices with source freshness.
- Weather, severe-weather alerts, and road disruptions.
- Pickup urgency and delivery flexibility.
- Vehicle type, dimensions, operability, count, and transport mode.
- Active driver supply near origin.
- Compatible capacity and route direction.
- Current shipment demand by geographic lane.
- Carrier bids, quote responses, and acceptance signals.
- Auction, port, holiday, seasonal, and major-event effects.
- Licensed external market benchmarks when available.
- Source reliability, timestamp, and confidence for every feature.

### 3. Decision engine

A safe initial formulation is:

```text
customer_price = max(economic_floor, market_cost_estimate + target_margin)
                 * live_condition_adjustments
```

The decision service should return:

- Customer price and valid-until time.
- Expected carrier cost.
- Expected gross profit and contribution margin.
- Confidence interval rather than only a point estimate.
- Applied factors and their individual effects.
- Data sources and freshness.
- Rule, feature, and model versions.
- Approval status and reason.

### 4. Governance layer

Administrators should control boundaries rather than daily tactical values:

- Pricing mode: `shadow`, `recommend`, `auto_within_limits`, or `manual`.
- Minimum carrier pay and contribution margin.
- Maximum movement from baseline or previous published price.
- Approval thresholds by price, confidence, margin, customer, lane, or service type.
- Allowed and blocked data sources.
- Data freshness requirements.
- Emergency overrides with reason and automatic expiration.
- Kill switch and one-click rollback.
- Model/rule promotion and version history.

## Cold-Start Strategy

Limited history should reduce certainty, not disable intelligence.

### Initial evidence hierarchy

1. Deterministic economic floor.
2. Direct carrier bids and available capacity.
3. Licensed external market benchmarks.
4. Live traffic, weather, fuel, toll, urgency, and supply-demand data.
5. Similar geographic lanes and vehicle/service classes.
6. DriveDrop's own exact-lane history as it accumulates.

### Cold-start behavior

- Use geographic lane clusters rather than exact address strings.
- Produce wider confidence intervals when evidence is sparse.
- Require carrier bids or admin approval for high-value, unusual, or low-confidence moves.
- Never label an open or expired quote as rejected without an explicit outcome state.
- Learn hierarchically: national, regional, lane cluster, exact lane, customer.
- Use conservative priors that can be updated as outcomes arrive.

The strongest startup-owned market signal should be a structured carrier bid and capacity network. It creates proprietary data while improving immediate quoting accuracy.

## Recommended Live Data Sources

### Immediate

- Google Routes for traffic-aware duration, road distance, and toll information.
- NOAA/NWS for severe weather and alerts.
- EIA for regional fuel baselines.
- Internal driver GPS, availability, equipment, and route direction.
- Internal active shipment demand and capacity.
- Direct carrier bid requests and responses.

### Commercial or contract-dependent

- Localized retail/commercial diesel feeds.
- Auction and port schedules.
- Major-event feeds.
- Central Dispatch, Super Dispatch, Ship.Cars, or similar market sources where API or export use is contractually licensed.

All external observations should be normalized and stored with timestamp, source, region, and retrieval status so decisions remain reproducible.

## Admin Console Redesign

### Retain as protected governance controls

- Minimum prices and required margins.
- Maximum adjustment percentage.
- Confidence and approval thresholds.
- Service eligibility.
- Emergency overrides.
- Feature-source controls.
- Model/rule deployment mode and rollback.

### Automate and display as observations

- Current fuel price.
- Surge or capacity pressure.
- Lane adjustment.
- Weather and traffic effects.
- Seasonal/event adjustment.
- Carrier-cost estimate.

### Add operational views

- Current decision mode and deployed version.
- Source-health and freshness dashboard.
- Quote explanation and feature snapshot.
- Pending approvals.
- Shadow-versus-production comparison.
- Margin, booking, cancellation, and carrier-acceptance performance.
- Recommendation approval/rejection history.

All writes should go through authenticated backend endpoints. The browser should not update pricing tables directly.

## Feedback and Training Data Contract

Every quote should capture:

- Quote, session, user, and tenant identifiers.
- Normalized origin and destination lane.
- Complete feature snapshot.
- Baseline, recommended, approved, and customer prices.
- Expected carrier cost and expected margin.
- Decision mode, confidence, explanation, and versions.
- Whether the quote was viewed, accepted, rejected, negotiated, abandoned, or expired.
- Rejection or negotiation reason where available.
- Shipment and carrier assignment identifiers.
- Accepted carrier price.
- Actual carrier cost, revenue, accessorials, refund, claim, and margin.
- Pickup and delivery timing outcomes.

Outcome updates must be server-generated from shipment, carrier, payment, and status transitions. Public callers must not be able to submit authoritative financial labels.

## Training Strategy

### Pricing

Do not fine-tune GPT to generate prices. Use structured models appropriate to each prediction:

- Carrier-cost regression with uncertainty.
- Booking-probability model.
- Carrier-acceptance probability model.
- Time-to-booking or survival model.
- Demand and capacity forecast.
- Contextual bandit or controlled experiment layer only after safe offline and shadow validation.

The final decision remains constrained by deterministic policy and approval rules.

### Other Benji capabilities

- **Shipment extraction:** Evaluate and eventually fine-tune using corrected `ai_shipment_prompts` examples.
- **Document extraction:** Train from reviewer field corrections after assembling clean ground truth.
- **Tool selection:** Build conversation evaluation sets first; fine-tune only after prompt and tool-schema improvements plateau.
- **Support knowledge:** Use retrieval-augmented generation for changing policies, procedures, and account-specific facts.
- **Driver-load matching:** Train a ranking model from offers, applications, acceptance, deadhead, delivery quality, and margin.
- **ETA prediction:** Train on actual route and tracking outcomes.
- **Voice and outreach:** Optimize qualification, objection handling, signup, and conversion from labeled call outcomes.
- **Fraud and risk:** Begin with deterministic rules; train only after enough confirmed positive and negative labels exist.

## Phased Implementation

### Phase 0: Correctness and security

- Centralize all quote channels through `pricingDecisionService`.
- Repair demand counting.
- Incorporate economic costs and required margin into the enforced floor.
- Move enclosed and service-specific adjustments into the central engine.
- Replace direct admin Supabase writes with authenticated APIs.
- Secure and mount intelligence endpoints only after authorization and validation are added.
- Implement reliable outcome state transitions and automatic financial feedback.

### Phase 1: Shadow intelligence

- Run intelligence for every quote without changing customer prices.
- Store feature snapshots and recommendations.
- Integrate initial weather, fuel, traffic, toll, supply, demand, and carrier-bid data.
- Compare baseline and intelligent recommendations against actual outcomes.

### Phase 2: Recommendation mode

- Show Benji's recommended price, range, explanation, and expected margin to admins.
- Require approval for all price changes.
- Record approval, rejection, and override reasons.

### Phase 3: Bounded automation

- Auto-apply low-risk decisions within strict price, margin, confidence, freshness, and service limits.
- Keep exceptional, sparse, high-value, and regulated cases under approval.
- Maintain a control cohort for measurement.

### Phase 4: Adaptive optimization

- Deploy validated predictive models with versioning and drift monitoring.
- Promote models through offline, shadow, canary, and production stages.
- Add controlled experimentation and automated rollback.
- Never permit adaptive learning to alter financial guardrails without versioned approval.

## Success Metrics

- Quote-to-booking conversion.
- Carrier acceptance rate and time to acceptance.
- Gross profit and contribution margin.
- Margin forecast error.
- Carrier-cost prediction error.
- Quote response latency and external-source availability.
- Percentage of quotes requiring manual approval.
- Override rate and override reason distribution.
- Cancellation, claim, refund, and late-delivery rates.
- Calibration of predicted confidence intervals.
- Performance by lane, vehicle, service, channel, and customer segment.

## Definition of Ready for Primary Use

Benji Pricing Intelligence is ready to become primary only when:

- Every quote channel uses one versioned decision path.
- The economic floor is enforced and tested.
- Feature snapshots and outcomes are complete and trustworthy.
- External source failure degrades safely.
- Shadow results demonstrate acceptable cost, margin, and booking behavior.
- Admin approval, rollback, and kill-switch controls work.
- Security prevents unauthorized policy changes or feedback poisoning.
- Model/rule decisions are reproducible from stored inputs and versions.
