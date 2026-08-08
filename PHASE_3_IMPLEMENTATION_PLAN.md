# Phase 3 Implementation Plan: Operational Memory Infrastructure

**Date:** 2026-07-23  
**Status:** APPROVED - INFRASTRUCTURE ONLY  
**Prerequisites:** Phase 2 Complete ✅

---

## Executive Summary

**Objective:** Build operational memory infrastructure for observing, recording, aggregating, and exposing pricing performance data.

**Scope:** Read-only analytics, data aggregation, memory retrieval APIs, recommendation generation (output only)  
**Non-Scope:** Policy changes, rollout strategies, A/B testing, automated adjustments, business decisions, Phase 4+ features

**Timeline:** 3-4 days (infrastructure implementation)  
**Risk Level:** LOW (read-only operations, no pricing behavior changes)

---

## Phase 2 Foundation (What We Have)

✅ **Data Collection Infrastructure**
- `quote_history` — Every quote logged with full context
- `pricing_events` — Event sourcing for audit trail
- `shipment_costs` — Actual cost tracking (populated post-shipment)
- `route_analytics` — Pre-aggregated metrics (empty, needs population)

✅ **Intelligence Layer**
- Benji analyzes historical data and generates insights
- Intelligence OFF by default
- Operates on 90-day rolling window

✅ **Decision Layer**
- Orchestrates three-layer architecture
- Applies policies from Policy Provider
- Logs all decisions to events table

✅ **Policy Provider**
- Database-backed configuration
- 5-minute cache
- Static policies (hardcoded defaults)

❌ **What's Missing (Phase 3 Infrastructure)**
- No performance tracking (intelligent vs baseline)
- No feedback event recording
- `route_analytics` table empty (no aggregation job)
- No memory retrieval APIs for Benji
- No recommendation generation interface

---

## Phase 3 Components (Infrastructure Only)

### 1. Performance Tracker Service ⭐ CORE (READ-ONLY)
**Purpose:** Calculate and expose pricing performance metrics (observation only)  
**File:** `backend/src/benji/intelligence/pricing-performance.service.ts`

**Functionality:**
- Calculate conversion rates (intelligent vs baseline)
- Calculate revenue metrics (average, total, per-quote)
- Calculate confidence calibration accuracy
- Calculate policy effectiveness metrics
- **NO DECISIONS, NO POLICY CHANGES** - metrics output only

**Data Sources:**
- Read from `quote_history` (all decision_maker types)
- Read from `shipment_costs` (actual profitability)
- Aggregate by route, vehicle type, time period

**API:**
```typescript
interface PerformanceMetrics {
  timeWindowDays: number;
  totalQuotes: number;
  baselineQuotes: { total: number; booked: number; conversionRate: number; avgRevenue: number };
  intelligentQuotes: { total: number; booked: number; conversionRate: number; avgRevenue: number };
  confidenceCalibration: { high: number; medium: number; low: number };  // % booked per confidence level
  routeBreakdown: Array<{ routeKey: string; metrics: PerformanceMetrics }>;
}

getPerformanceMetrics(timeWindowDays: number): Promise<PerformanceMetrics>
getRoutePerformance(routeKey: string, timeWindowDays: number): Promise<PerformanceMetrics>
```

**Complexity:** MEDIUM (SQL aggregation queries)  
**Implementation Time:** 1 day

---

### 2. Route Analytics Aggregator ⭐ CORE
**Purpose:** Populate `route_analytics` table with pre-aggregated metrics  
**File:** `backend/src/benji/intelligence/pricing-analytics.service.ts`

**Functionality:**
- Aggregate `quote_history` by route + vehicle type + time period
- Calculate conversion rates, avg prices, volume trends
- Update `route_analytics` table (daily batch + incremental)
- Enable fast dashboard queries without full table scans

**Aggregation Logic:**
```typescript
// Group by: route_origin + route_destination + vehicle_type + month
// Calculate:
- total_quotes
- total_bookings
- conversion_rate
- avg_quoted_price
- avg_baseline_price
- avg_intelligent_price (if intelligence used)
- revenue_total
- revenue_per_quote
```

**Update Strategy:**
- **Initial Load:** Backfill from `quote_history` (one-time on deploy)
- **Incremental:** Update on `quote_generated` and `quote_accepted` events
- **Batch Reconciliation:** Daily job to ensure consistency

**API:**
```typescript
aggregateRoutePerformance(routeKey: string, period: string): Promise<void>
backfillRouteAnalytics(): Promise<void>
getRouteAnalytics(routeKey: string, period: string): Promise<RouteAnalytics>
```

**Complexity:** MEDIUM (batch aggregation + incremental updates)  
**Implementation Time:** 1.5 days

---

### 3. Feedback Recording Service ⭐ CORE (WRITE-ONLY)
**Purpose:** Record operational feedback events for future analysis  
**File:** `backend/src/benji/intelligence/pricing-feedback.service.ts`

**Functionality:**
- Record feedback events when quotes are accepted/rejected
- Record outcome events when shipments complete
- Record performance snapshots on schedule
- **NO ANALYSIS, NO DECISIONS** - recording only

**Event Types:**
```typescript
// Feedback Events (extend pricing_events table)
- quote_outcome_recorded: { quoteId, wasBooked, timeToBooking }
- shipment_outcome_recorded: { shipmentId, actualCost, actualRevenue, profitMargin }
- performance_snapshot_recorded: { snapshotDate, metrics }
```

**API:**
```typescript
recordQuoteOutcome(quoteId: string, wasBooked: boolean, timeToBooking?: number): Promise<void>
recordShipmentOutcome(shipmentId: string, costs: ShipmentCosts): Promise<void>
recordPerformanceSnapshot(metrics: PerformanceMetrics): Promise<void>
```

**Complexity:** LOW (event logging)  
**Implementation Time:** 0.5 days

---

### 4. Intelligence Activation Controller
**Purpose:** Manage intelligence rollout with A/B testing  
**File:** `backend/src/benji/intelligence/pricing-activation.service.ts`

**Functionality:**
- Control intelligence enablement percentage (0% → 10% → 50% → 100%)
- Assign users to cohorts (control vs treatment)
- Track cohort performance separately
- Automatic rollback if treatment underperforms

**Rollout Strategy:**
```typescript
// Week 1: Enable for 10% of quotes
enableIntelligenceForCohort('treatment_10', 0.1);

// Week 2: If treatment_10 conversion ≥ control - 2%, expand to 50%
if (treatmentPerformance.acceptable) {
  enableIntelligenceForCohort('treatment_50', 0.5);
}

// Week 3: If treatment_50 stable, expand to 100%
if (treatmentPerformance.stable) {
  enableIntelligenceGlobally();
}
```

**Cohort Assignment:**
```typescript
// Deterministic assignment based on user_id hash
function shouldEnableIntelligence(userId: string, rolloutPercent: number): boolean {
  const hash = hashUserId(userId);
  return (hash % 100) < rolloutPercent;
}
```
Policy Recommendation Service ⭐ CORE (OUTPUT-ONLY)
**Purpose:** Generate policy recommendations based on performance data (does not apply them)  
**File:** `backend/src/benji/intelligence/pricing-recommendations.service.ts`

**Functionality:**
- Analyze performance metrics
- Detect patterns and trends
- Generate recommendation objects with reasoning
- **NEVER APPLIES RECOMMENDATIONS** - output only

**Recommendation Types:**
```typescript
interface PolicyRecommendation {
  type: 'confidence_threshold' | 'demand_premium' | 'loyalty_discount' | 'conversion_boost';
  curreMemory Retrieval API (Read-Only)
**Purpose:** Expose operational memory to Benji for enhanced intelligence  
**File:** `backend/src/routes/intelligence.routes.ts`

**Endpoints (All Read-Only):**
```typescript
GET /api/v1/intelligence/performance
  → Returns PerformanceMetrics (system-wide)

GET /api/v1/intelligence/performance/route/:routeKey
  → Returns PerformanceMetrics (route-specific)

GET /api/v1/intelligence/analytics/route/:routeKey
  → Returns RouteAnalytics (pre-aggregated from route_analytics table)

GET /api/v1/intelligence/recommendations
  → Returns PolicyRecommendation[] (suggestions only, not applied)

POST /api/v1/intelligence/feedback/record
  → Records feedback event (quote outcome, shipment outcome)
```

**API:**
```typescript
generateRecommendations(timeWindowDays: number): Promise<PolicyRecommendation[]>
getRecommendation(type: string): Promise<PolicyRecommendation | null>
```

**Complexity:** MEDIUM (pattern detection logicon.sql`

**Schema Changes:**
```sql
-- Add rollout control to pricing_config
ALTER TABLE pricing_config
  ADD COLUMN IF NOT EXISTS intelligence_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS intelligence_rollout_percent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intelligence_cohort_strategy TEXT DEFAULT 'user_hash';

-- Add policy change audit log (extends pricing_events)
-- No schema change needed, uses existing pricing_events table

-- Add performance tracking table (optional, can use views)
CREATE TABLE IF NOT EXISTS pricing_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  cohort TEXT NOT NULL,  -- 'control' | 'treatment'
  total_quotes INTEGER,
  total_bookings INTEGER,
  conversion_rate NUMERIC(5,2),
  avg_revenue NUMERIC(10,2),
  avg_confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_performance_snapshots_date ON pricing_performance_snapshots(snapshot_date DESC);
CREATE INDEX idx_performance_snapshots_cohort ON pricing_performance_snapshots(cohort);
```

**Complexity:** LOW (additive migration, no breaking changes)  
**Implementation Time:** 0.5 days

---

## Execution Order (Infrastructure Only)

### Day 1: Analytics Foundation
1. ✅ Create `pricing-analytics.service.ts`
2. ✅ Implement route aggregation logic (read-only)
3. ✅ Write backfill script for `route_analytics`
4. ✅ Test aggregation with existing `quote_history` data

### Day 2: Performance Tracking
1. ✅ Create `pricing-performance.service.ts`
2. ✅ Implement metrics calculation (read-only)
3. ✅ Implement confidence calibration calculation
4. ✅ Write unit tests

### Day 3: Feedback Recording & Recommendations
1. ✅ Create `pricing-feedback.service.ts` (event recording only)
2. ✅ Create `pricing-recommendations.service.ts` (output-only)
3. ✅ Implement pattern detection (no policy application)
4. ✅ Write unit tests

### Day 4: API Layer & Migration
1. ✅ Create `intelligence.routes.ts` (read-only + feedback recording)
2. ✅ Apply migration (performance snapshots table)
3. ✅ Run backfill for `route_analytics`
4. ✅ Integration testing & documentation

---

## Dependencies

### Internal Dependencies
- ✅ Phase 2 Intelligence Layer (provides insights)
- ✅ Phase 2 Decision Layer (orchestrates pricing)
- ✅ Phase 2 Policy Provider (reads/writes policies)
- ✅ Phase 2 Event Service (logs policy changes)
- ✅ `quote_history` table (must have data, ideally 30+ days)

### External Dependencies
- ✅ Supabase (database queries for aggregation)
- ✅ Node.js `crypto` (for user hash-based cohort assignment)
- ❌ No new external packages required

### Data Dependencies
- ⚠️ **CRITICAL:** Requires 30+ days of `quote_history` data for meaningful analysis
- ⚠️ **CRITICAL:** Requires `was_booked` field to be updated when quotes convert to shipments
- ⚠️ Ideally have 100+ quotes across multiple routes for robust aggregation

---

## Integration Risks

### Risk 1: Insufficient Historical Data ⚠️ HIGH
**Problem:** Phase 3 learns from `quote_history`, but Phase 2 just started collecting data  
**Impact:** Feedback loop has no data to learn from  
**Mitigation:**
- Check data volume before enabling feedback loop
- Require minimum 30 days + 100 quotes before first feedback cycle
- Provide clear error messages if data insufficient

### Risk 2: Policy Thrashing 🔴 CRITICAL
**Problem:** Aggressive policy updates could cause oscillation (adjust → bad performance → revert → repeat)  
**Impact:** Unstable pricing, user confusion  
**Mitigation:**
- Limit adjustments to ±5% per cycle
- Require 7-day cooldown between adjustments
- Admin approval for changes > 10%
- Rollback mechanism if performance degrades > 10%
 (Infrastructure Only)

### Risk 1: Insufficient Historical Data ⚠️ MEDIUM
**Problem:** Analytics require historical data, but Phase 2 just started collecting  
**Impact:** Empty metrics, no aggregates  
**Mitigation:**
- Graceful handling of empty datasets (return zeros, not errors)
- Clear documentation that metrics need 7+ days to be meaningful
- Provide data availability indicators in API responses

### Risk 2: Performance Degradation from Analytics Queries ⚠️ LOW
**Problem:** Route analytics aggregation could slow down production queries  
**Impact:** API latency increases  
**Mitigation:**
- Run backfill during off-peak hours
- Use incremental updates (not full table scans)
- Add database indexes on `quote_history(route_origin, route_destination, created_at)`
- All analytics endpoints are read-only and non-critical

### Risk 3: Snapshot Table Growth ⚠️ LOW
**Problem:** Daily snapshots accumulate over time  
**Impact:** Storage growth  
**Mitigation:**
- Snapshots are small (< 1KB each)
- Can prune snapshots older than 1 year if needed
- Provides historical trend data value opportunities
- 🎯 At least 1 policy adjustment improves performance by ≥ 3%

### Operational Suc (Infrastructure Only)

### Technical Success
- ✅ `route_analytics` table populated with historical data
- ✅ Performance tracker calculates metrics correctly (read-only)
- ✅ Feedback recording logs events successfully
- ✅ Recommendation service generates suggestions (output-only, no application)
- ✅ Memory retrieval APIs return data correctly
- ✅ Zero impact on pricing behavior
- ✅ Zero production errors

### Data Quality Success
- ✅ Route analytics match manual SQL aggregation (within 1% variance)
- ✅ Performance metrics available for routes with 10+ quotes
- ✅ Snapshot table updates daily (automated or manual trigger)
- ✅ Recommendation confidence scores correlate with sample size

### API Success
- ✅ All endpoints respond < 500ms for typical queries
- ✅ Graceful handling of empty datasets (return structured empty responses)
- ✅ Proper error messages for invalid route keys
- ✅ Authentication required for all endpoints
### End-to-End Tests
- Simulate 30 days of quote data (seed `quote_history`)
- Run analytics aggregation
- Run feedback cycle
- Verify policy adjustments applied
- Verify Decision Layer uses updated policies
- Verify rollback mechanism

### Load Tests
- Analytics aggregation with 10K+ quotes
- Performance queries with 1M+ rows
- Concurrent policy reads during cache refresh

---

## Rollback Plan

### Rollback Trigger Conditions
- Intelligent pricing conversion rate < baseline - 10%
- Production errors > 5 per hour
- Admin manual rollback (emergency button)

### Rollback Steps
1. Set `intelligence_rollout_percent = 0` in `pricing_config`
2. Clear Policy Provider cache (force reload)
3. Log rollback event to `pricing_events`
4. Notify engineering team
5. Investigate root cause before re-enabling

### Rollback Time: < 5 minutes (config change only, no deployment)

---

## Phase 3 vs Phase 4+ Boundary
**Not Applicable:** Phase 3 is infrastructure-only with no pricing behavior changes.
 - Infrastructure Only)
- ✅ Performance tracking (read-only metrics)
- ✅ Route analytics aggregation (populate tables)
- ✅ Feedback event recording (log outcomes)
- ✅ Memory retrieval APIs (expose data to Benji)
- ✅ Recommendation generation (output-only, no application)
- ❌ NO policy changes, NO rollout strategies, NO business decisions

### Phase 4+ (Future - Adaptive Systems)
- ❌ Automated policy adjustments based on recommendations
- ❌ A/B testing with cohort assignment
- ❌ Rollout strategies (10% → 50% → 100%)
- ❌ Admin approval workflows for policy changes
- ❌ Machine learning models
- ❌ Real-time demand forecasting
- ❌ Automated optimization

**Rationale:** Phase 3 builds the memory layer. Phase 4+ builds the adaptation layer on top of it
2. ✅ API documentation for intelligence endpoints
3. ✅ Feedback loop operational runbook
4. ✅ Analytics aggregation maintenance guide
5. ✅ Policy adjustment approval workflow
6. ✅ Rollout playbook (10% → 50% → 100%)

---

## Final Recommendation

**Proceed with Phase 3 implementation** with the following conditions:

1. ✅ Verify Phase 2 has collected ≥ 30 days of `quote_history` data
2. ✅ Verify `was_booked`nfrastructure implementation:**

**What Will Be Built:**
1. ✅ Read-only performance tracking service
2. ✅ Route analytics aggregation (populate `route_analytics` table)
3. ✅ Feedback event recording (log outcomes to `pricing_events`)
4. ✅ Policy recommendation service (output-only, never applies)
5. ✅ Memory retrieval APIs (GET endpoints for Benji)
6. ✅ Performance snapshots table (daily aggregates)

**What Will NOT Be Built:**
- ❌ Policy modification logic
- ❌ Rollout strategies or A/B testing
- ❌ Automated adjustments
- ❌ Admin approval workflows
- ❌ Business decision logic
- ❌ Any code that changes pricing behavior

**Preconditions:**
- Phase 2 must have collected some `quote_history` data (can be < 30 days for infrastructure testing)
- Services will gracefully handle empty datasets

**Estimated Timeline:** 4 days implementation + 1 day testing = 5 days total  
**Risk Assessment:** LOW (read-only infrastructure, no pricing impact)

---

**Status:** APPROVED - Infrastructure Only ✅  
**Next Step:** Implementation following established workflow