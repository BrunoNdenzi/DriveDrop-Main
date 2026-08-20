# Product Readiness Gap Register

**Purpose:** Record incomplete, inconsistent, hardcoded, misleading, or missing behavior discovered while building Pricing Intelligence and Route Intelligence.

**Primary release gate:** Pricing Intelligence and Route Intelligence ready for controlled external pilots.

This register prevents discoveries from being forgotten without allowing every adjacent issue to interrupt the active implementation phase.

## Triage Rule

Fix a discovered gap immediately only when it compromises:

- Authentication, authorization, tenant isolation, or sensitive data.
- Customer price, payment, payout, margin, or other financial truth.
- Data integrity, lifecycle correctness, or irreversible operations.
- The validity of the pricing or route feature currently being implemented.
- A claim presented to users as live, verified, measured, or production-ready.

Otherwise, record the gap here and continue the active roadmap. Review all open entries before external pilots and again before general availability.

## Status And Severity

**Status:** `discovered`, `confirmed`, `planned`, `in_progress`, `blocked`, `resolved`, `accepted_risk`.

**Severity:**

- `P0`: Security, financial, legal, or destructive data risk. Blocks current work or release.
- `P1`: Core workflow can produce incorrect or misleading operational behavior. Blocks external pilots.
- `P2`: Important completeness, consistency, reliability, or maintainability gap. Blocks general availability when relevant.
- `P3`: Improvement that can safely follow product readiness.

## Entry Requirements

Every entry must include:

- A stable ID and concise title.
- Evidence from a concrete code path, schema, runtime result, or user workflow.
- Current behavior and intended behavior.
- User, operational, financial, or commercial impact.
- Temporary handling while the gap remains open.
- Dependencies and the release gate it blocks.
- Resolution criteria that can be tested.

Do not log speculation as fact. Mark uncertain findings `discovered` until evidence confirms them.

## Open Gaps

### GAP-001: Driver Verification Is Not An Enforced Access Policy

- **Status:** confirmed
- **Severity:** P1
- **Area:** Identity, driver onboarding, dispatch, marketplace
- **Evidence:**
  - `backend/src/middlewares/auth.middleware.ts` loads `is_verified`, but universal enforcement is commented out.
  - `backend/src/services/BenjiDispatcherService.ts` labels its query as verified drivers but filters only `role = driver`.
  - `backend/src/services/BenjiLoadRecommendationService.ts` reads `is_verified` but does not reject an unverified driver before returning loads.
  - Driver verification, document review, DOT checks, phone verification, and pickup verification exist as separate concepts without one access policy.
- **Current behavior:** Verification state is displayed and updated in several places, but it does not consistently determine which screens, loads, recommendations, applications, assignments, status changes, or payment actions a driver may access.
- **Intended behavior:** One server-owned driver eligibility policy defines capabilities for each verification state and is enforced by every API, UI, Benji tool, and dispatch service.
- **Impact:** Unverified or incompletely verified drivers may see or attempt operational actions that should require approval. Dispatch supply counts and recommendations may overstate usable capacity.
- **Temporary handling:** Do not treat all driver profiles as available supply. Label current counts narrowly and require manual dispatcher approval for binding assignments.
- **Dependencies:** Canonical verification states, document requirements, compliance expiry rules, driver availability model, centralized authorization.
- **Blocks:** Dispatch Copilot external pilot and any autonomous assignment.
- **Resolution criteria:**
  - Documented state-to-capability matrix.
  - Shared backend authorization guard for driver capabilities.
  - Dispatch and recommendation queries enforce verified eligibility.
  - UI hides or disables unavailable capabilities while the server independently rejects them.
  - Tests cover every verification state and privileged action.

### GAP-002: Driver Availability And Supply Are Not Operationally Authoritative

- **Status:** confirmed
- **Severity:** P1
- **Area:** Dispatch, pricing supply evidence, route planning
- **Evidence:** Dispatch services primarily query profiles by driver role; reliable duty state, current capacity, equipment, compliance, available-from location, and freshness are not consistently required.
- **Current behavior:** Profile counts can be mistaken for available network capacity.
- **Intended behavior:** Supply is derived from verified, compliant, active drivers or carriers with fresh availability, equipment, capacity, location, and tenant/network eligibility.
- **Impact:** Misleading supply signals can distort matching, route planning, pricing observations, and sales claims.
- **Temporary handling:** Store broad counts only as `network_wide` observations and never label them available capacity or use them to change customer prices.
- **Dependencies:** GAP-001, driver availability model, equipment/capacity model, location freshness policy.
- **Blocks:** Supply-aware pricing recommendations and Dispatch Copilot external pilot.
- **Resolution criteria:** Versioned availability projection with freshness, source, eligibility, and capacity; all consumers use the same projection.

### GAP-003: Actual Carrier Cost And Payout Are Not Yet Canonical

- **Status:** confirmed
- **Severity:** P0
- **Area:** Pricing outcomes, payments, dispatch economics
- **Evidence:** Several UI and email paths calculate driver earnings using conflicting hardcoded percentages, while `shipment_costs` is the intended actual-cost ledger and requires finalized financial input.
- **Current behavior:** Estimated payout percentages can be presented as earnings, but they are not proof of an accepted carrier rate or settled payout.
- **Intended behavior:** Accepted carrier offer, accessorials, refunds, claims, processing fees, and settled payout feed one authoritative shipment financial ledger.
- **Impact:** Incorrect margin labels would poison pricing training data and create financial or contractual risk.
- **Temporary handling:** Shadow pricing consumes actual cost and margin only from finalized `shipment_costs`. Never infer actual cost from a percentage of customer price.
- **Dependencies:** Offer/bid lifecycle, payout settlement events, payment reconciliation.
- **Blocks:** Automated margin learning, carrier-cost models, and bounded price automation.
- **Resolution criteria:** Reconciled shipment ledger with immutable source references and idempotent pricing outcome events.

### GAP-004: OPIS Fuel Evidence Is Not Contracted Or Integrated

- **Status:** blocked
- **Severity:** P2
- **Area:** Pricing and route live evidence
- **Evidence:** Shadow source health reports OPIS as `PROVIDER_NOT_ENABLED`; no licensed OPIS product/feed contract or response schema is configured.
- **Current behavior:** Pricing uses configured fuel priors while clearly labeling the source; no live OPIS value affects prices.
- **Intended behavior:** A licensed OPIS adapter supplies appropriately scoped, fresh fuel evidence with provenance and fallback behavior.
- **Impact:** Fuel-sensitive recommendations remain less precise, but customer pricing remains safe in shadow mode.
- **Temporary handling:** Keep configured priors and expose fuel source as unavailable. Do not market fuel pricing as live.
- **Dependencies:** OPIS commercial agreement, product/feed selection, credentials, geographic scope, refresh terms.
- **Blocks:** Live-fuel readiness claim and fuel-informed recommendation mode.
- **Resolution criteria:** Contracted adapter, freshness tests, outage fallback tests, and observed-versus-prior evaluation.

### GAP-005: Route Intelligence Contains Estimated Data Presented Near Live Workflows

- **Status:** confirmed
- **Severity:** P1
- **Area:** Route optimization
- **Evidence:** `BENJI_DISPATCH_AND_PRODUCTIZATION_STRATEGY.md` documents hardcoded regional fuel prices, seasonal weather text, rule-based traffic warnings, and options that are accepted but not fully applied.
- **Current behavior:** Useful route optimization is mixed with estimated or partially implemented context.
- **Intended behavior:** Every route feature is either implemented from a named source with freshness or explicitly labeled unavailable/estimated; accepted options must affect computation.
- **Impact:** Operators may over-trust route feasibility, traffic, weather, savings, or option behavior.
- **Temporary handling:** Keep live provider evidence observational and avoid claims of live route conditions until route outputs consume and label those sources correctly.
- **Dependencies:** Pricing live-evidence source contracts, route service consolidation, option conformance tests.
- **Blocks:** Route Intelligence external API release.
- **Resolution criteria:** Contract tests for every request option, source/freshness metadata, failure semantics, and measured route outcomes.

### GAP-006: Assignment And Shipment Status Ownership Is Fragmented

- **Status:** confirmed
- **Severity:** P1
- **Area:** Dispatch lifecycle
- **Evidence:** `BENJI_DISPATCH_AND_PRODUCTIZATION_STRATEGY.md` identifies multiple assignment and status mutation paths without one atomic assignment service or complete transition graph.
- **Current behavior:** Controllers, procedures, Benji tools, payment handlers, and verification flows can mutate overlapping operational state.
- **Intended behavior:** One domain service owns eligibility, offers, assignment, transitions, idempotency, events, and authorization.
- **Impact:** Conflicting assignments, invalid transitions, incomplete audit trails, and unreliable outcome labels.
- **Temporary handling:** Keep binding dispatch decisions human-approved and do not market autonomous dispatch.
- **Dependencies:** Driver eligibility, offer model, transactional outbox, canonical lifecycle.
- **Blocks:** Dispatch Copilot external pilot and trusted dispatch training data.
- **Resolution criteria:** Atomic command handlers, transition matrix, conflict tests, idempotency, and complete event audit.

## Review Gates

### Before Pricing Intelligence Recommendation Mode

- Close or explicitly gate every open pricing `P0` and `P1` entry.
- Confirm live sources, freshness, fallback, and financial outcomes are trustworthy.
- Confirm recommendations cannot bypass the economic floor or approval policy.

### Before Route Intelligence External Pilot

- Close route-option conformance and misleading live-data gaps.
- Verify ownership, authentication, quotas, idempotency, and source labeling.
- Demonstrate measured route quality against real completed operations.

### Before Dispatch Copilot External Pilot

- Close driver verification, availability, assignment atomicity, and lifecycle ownership gaps.
- Enforce tenant/network eligibility and human approval.

### After Pricing And Route Product Readiness

Run a focused remediation phase:

1. Re-rank all open entries using current evidence.
2. Convert release-blocking entries into implementation plans with owners and tests.
3. Resolve cross-cutting foundations before expanding to Dispatch OS or multi-tenant commercialization.
4. Retain accepted risks with an owner, expiration date, and explicit rationale.

## New Entry Template

```markdown
### GAP-NNN: Short Title

- **Status:** discovered
- **Severity:** P0 | P1 | P2 | P3
- **Area:**
- **Evidence:**
- **Current behavior:**
- **Intended behavior:**
- **Impact:**
- **Temporary handling:**
- **Dependencies:**
- **Blocks:**
- **Resolution criteria:**
```