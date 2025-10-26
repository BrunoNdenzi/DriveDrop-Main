# Admin Pricing Configuration Guide

## Table of Contents
1. [Overview](#overview)
2. [Accessing the Pricing Dashboard](#accessing-the-pricing-dashboard)
3. [Configuration Sections](#configuration-sections)
4. [Pricing Model Deep Dive](#pricing-model-deep-dive)
5. [Best Practices](#best-practices)
6. [Common Scenarios](#common-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The Dynamic Pricing Configuration system allows administrators to fine-tune pricing calculations in real-time. Every change you make is tracked with a reason and timestamp, ensuring full audit compliance.

### Key Principles
- **Real-time Updates**: Changes take effect immediately for new quotes
- **Cached Results**: Previous quotes remain valid until expiration
- **Audit Trail**: Every modification is logged with who changed it and why
- **Safety Net**: Minimum quotes ensure profitability on all jobs

---

## Accessing the Pricing Dashboard

### Mobile App (Recommended)
1. Log in with admin credentials
2. Navigate to **Admin Dashboard**
3. Select **Pricing Configuration**
4. View/Edit settings in organized sections

### API Access (Advanced)
```bash
# Get current configuration
GET /api/v1/admin/pricing/config

# Update configuration
PUT /api/v1/admin/pricing/config/{id}
```

---

## Configuration Sections

### 1. Minimum Quotes

These settings establish the floor price for any shipment, ensuring profitability on short-distance or small jobs.

#### **Minimum Quote** (`min_quote`)
- **Default**: $150
- **Purpose**: Base minimum price for standard shipments
- **Applies When**: Distance < Minimum Miles Threshold
- **Impact**: High - Affects all short-distance quotes
- **Example**: 
  - Distance: 50 miles
  - Calculated price: $120
  - **Final price: $150** (minimum applied)

**When to Adjust:**
- ✅ Increase if short jobs are unprofitable
- ✅ Decrease to compete in short-haul market
- ❌ Don't set below operating costs ($100-125 typical)

---

#### **Accident Recovery Minimum** (`accident_min_quote`)
- **Default**: $80
- **Purpose**: Special minimum for accident/emergency recovery jobs
- **Why Lower?**: Competitive edge for towing market
- **Applies When**: Job marked as `is_accident_recovery = true`
- **Impact**: Medium - Only affects emergency jobs
- **Example**:
  - Standard minimum: $150
  - Accident recovery: **$80**
  - Allows competitive pricing for 20-40 mile tows

**When to Adjust:**
- ✅ Increase during high-demand periods
- ✅ Decrease to gain market share in towing
- ❌ Don't undercut local tow companies too aggressively

---

#### **Minimum Miles Threshold** (`min_miles`)
- **Default**: 100 miles
- **Purpose**: Distance below which minimum quote applies
- **Impact**: High - Defines boundary between minimum and calculated pricing
- **Example**:
  - Set to 100 miles
  - 90-mile job → Minimum quote ($150) applied
  - 110-mile job → Calculated dynamically based on rate bands

**When to Adjust:**
- ✅ Increase if too many short jobs hit minimum
- ✅ Decrease if medium-distance jobs need minimums
- ⚠️ Consider fuel costs when lowering

---

### 2. Fuel Pricing

Dynamic fuel adjustments ensure pricing stays profitable as gas prices fluctuate.

#### **Base Fuel Price** (`base_fuel_price`)
- **Default**: $3.70/gallon
- **Purpose**: Baseline fuel cost baked into standard rates
- **Impact**: Reference point - doesn't directly affect pricing
- **When Set**: During initial configuration
- **Rarely Changed**: Only update if restructuring entire pricing model

**Formula Context:**
```
Standard Rate = Based on $3.70/gal fuel
Adjustment = (Current Fuel - Base Fuel) × Adjustment Factor
```

---

#### **Current Fuel Price** (`current_fuel_price`)
- **Default**: $3.70/gallon
- **Purpose**: Today's actual fuel market price
- **Impact**: **CRITICAL** - Directly adjusts all quotes
- **Update Frequency**: Weekly or when prices change >$0.25
- **Example**:
  ```
  Base: $3.70/gal
  Current: $4.50/gal
  Difference: +$0.80
  
  With adjustment factor 10%:
  Price increase = $0.80 × 10% = 8% surcharge
  ```

**How to Update:**
1. Check regional fuel prices (AAA, GasBuddy)
2. Average your local market
3. Round to nearest $0.05
4. Update in dashboard
5. Provide reason: "Weekly fuel update - AAA average $4.52"

**When to Adjust:**
- ✅ **Weekly**: Standard maintenance
- ✅ **Immediately**: When gas jumps >$0.30
- ✅ **Seasonally**: Adjust for summer/winter blends
- ❌ Don't: Change multiple times per day

---

#### **Fuel Adjustment Factor** (`fuel_adjustment_per_dollar`)
- **Default**: 10% (0.10)
- **Purpose**: How aggressively pricing responds to fuel changes
- **Impact**: High - Magnifies fuel price effects
- **Formula**: 
  ```
  Adjustment = (Current Fuel - Base Fuel) × This Factor
  Final Multiplier = 1 + Adjustment
  ```

**Examples:**
| Base | Current | Factor | Calculation | Result |
|------|---------|--------|-------------|--------|
| $3.70 | $4.20 | 10% | ($4.20-$3.70)×0.10 = 0.05 | +5% price increase |
| $3.70 | $4.70 | 10% | ($4.70-$3.70)×0.10 = 0.10 | +10% price increase |
| $3.70 | $3.20 | 10% | ($3.20-$3.70)×0.10 = -0.05 | -5% price decrease |

**When to Adjust:**
- ✅ Increase (12-15%) if fuel costs eating margins
- ✅ Decrease (5-8%) for more stable pricing
- ⚠️ Don't exceed 20% - creates customer confusion
- ⚠️ Don't go below 5% - won't cover cost changes

---

### 3. Surge Pricing

Surge pricing allows dynamic price increases during high-demand periods.

#### **Enable Surge Pricing** (`surge_enabled`)
- **Default**: Disabled (false)
- **Purpose**: Turn demand-based pricing on/off globally
- **Impact**: When enabled, multiplies all quotes by surge multiplier
- **Use Cases**:
  - Holiday weekends (July 4th, Memorial Day)
  - Major weather events
  - Local events causing demand spikes
  - Driver shortage periods

**When to Enable:**
- ✅ Friday before holiday weekend
- ✅ Storm/snow incoming (24 hrs before)
- ✅ When accepting <50% of quote requests
- ✅ When driver availability drops below 30%

**When to Disable:**
- ✅ Normal operations resume
- ✅ Demand returns to baseline
- ✅ After event/holiday ends
- ❌ Don't leave on permanently - customer backlash

---

#### **Surge Multiplier** (`surge_multiplier`)
- **Default**: 1.0× (no surge)
- **Range**: 1.0× to 3.0×
- **Purpose**: How much to increase prices during surge
- **Impact**: **EXTREME** - Directly multiplies final price
- **Only Active When**: `surge_enabled = true`

**Recommended Levels:**
| Multiplier | Scenario | Customer Impact |
|------------|----------|-----------------|
| 1.0× | Normal (surge disabled) | No change |
| 1.15× | Moderate demand | +15% - Noticeable but acceptable |
| 1.25× | High demand | +25% - Significant, use sparingly |
| 1.5× | Critical shortage | +50% - Major events only |
| 2.0× | Emergency only | +100% - Extreme circumstances |

**Example:**
```
Base quote: $500
Surge enabled: Yes
Surge multiplier: 1.25×

Final price: $500 × 1.25 = $625
Customer sees: +$125 surge charge
```

**Best Practices:**
- Start conservative (1.15×) and adjust up
- Communicate surge to customers in quotes
- Monitor cancellation rates
- Disable surge within 24 hrs of activation
- Document reason: "July 4th weekend - high demand"

---

### 4. Delivery Type Pricing

These multipliers adjust prices based on delivery speed and flexibility.

#### **Expedited Multiplier** (`expedited_multiplier`)
- **Default**: 1.25× (+25%)
- **Purpose**: Premium for rush/same-day delivery
- **Customer Benefit**: Fastest service, priority scheduling
- **Driver Benefit**: Higher pay, motivated acceptance
- **Impact**: High value jobs, premium customers

**When to Adjust:**
- ✅ Increase (1.30-1.50×) if expedited bookings overwhelming
- ✅ Decrease (1.15-1.20×) to encourage more expedited bookings
- ⚠️ Don't go below 1.15× - drivers won't prioritize
- ⚠️ Don't exceed 1.75× - customers will choose standard

**Example:**
```
Standard quote: $400
Expedited multiplier: 1.25×
Final: $400 × 1.25 = $500 (+$100 premium)
```

---

#### **Standard Multiplier** (`standard_multiplier`)
- **Default**: 1.0× (baseline)
- **Purpose**: Base rate for standard 2-7 day delivery
- **Impact**: Most common delivery type - affects 60-70% of jobs
- **Rarely Changed**: This is your baseline pricing

**When to Adjust:**
- ✅ Increase (1.05×) for across-the-board price increase
- ✅ Decrease (0.95×) if losing market share
- ⚠️ Changes here affect most customers
- ⚠️ Consider fuel/surge instead of changing this

---

#### **Flexible Multiplier** (`flexible_multiplier`)
- **Default**: 0.95× (-5% discount)
- **Purpose**: Discount for customers with flexible timing (7-14 days)
- **Business Benefit**: Better route optimization, fill empty trucks
- **Customer Benefit**: Lower price for no-rush shipments
- **Impact**: Encourages advanced booking

**When to Adjust:**
- ✅ Increase discount (0.85-0.90×) to shift demand to flexible
- ✅ Decrease discount (0.95-0.98×) if too many flexible bookings
- ✅ Use to balance capacity - more discount = more flexible bookings
- ❌ Don't go below 0.80× - erodes standard revenue

**Example - Load Balancing:**
```
Current: 80% expedited, 20% flexible
Problem: Can't meet expedited demand
Solution: Change flexible from 0.95× to 0.85× (-15%)

Result: More customers choose flexible, better scheduling
```

---

### 5. Distance Bands

Distance bands apply different per-mile rates based on trip length. Longer trips = lower per-mile cost (economies of scale).

#### **Short Distance Max** (`short_distance_max`)
- **Default**: 250 miles
- **Purpose**: Upper limit for "short distance" pricing tier
- **Rate**: Highest per-mile rate (compensates for fixed costs)
- **Example**: 0-250 miles = $2.80/mile

**Pricing Logic:**
```
Miles 0-250: Short distance rate (highest $/mile)
Miles 251-500: Mid distance rate (medium $/mile)
Miles 501+: Long distance rate (lowest $/mile)
```

**When to Adjust:**
- ✅ Increase (300 mi) if short jobs dominate and unprofitable
- ✅ Decrease (200 mi) to transition more jobs to mid-tier pricing
- ⚠️ Coordinate with Mid Distance Max to avoid gaps

---

#### **Mid Distance Max** (`mid_distance_max`)
- **Default**: 500 miles
- **Purpose**: Upper limit for "mid distance" pricing tier
- **Rate**: Medium per-mile rate (balanced profitability)
- **Example**: 251-500 miles = $2.40/mile

**When to Adjust:**
- ✅ Increase (600 mi) to extend favorable mid-tier pricing
- ✅ Decrease (400 mi) to push more jobs into long-distance category
- ⚠️ Must be > Short Distance Max

**Example Scenario:**
```
Job: 450 miles
Short max: 250 mi
Mid max: 500 mi

Classification: MID DISTANCE
Rate: $2.40/mile
Total: 450 × $2.40 = $1,080

If you change mid max to 400:
Classification: LONG DISTANCE
Rate: $2.10/mile  
Total: 450 × $2.10 = $945 (-$135)
```

---

### 6. Service Availability

These toggles enable/disable entire service types.

#### **Expedited Service Enabled** (`expedited_service_enabled`)
- **Default**: Enabled (true)
- **Purpose**: Allow customers to book rush delivery
- **Impact**: Removes expedited option from booking flow if disabled
- **Revenue Impact**: High - premium service generates extra margin

**When to Disable:**
- ✅ Driver shortage - can't meet expedited timelines
- ✅ Holiday overload - focus on standard deliveries
- ✅ Maintenance period - system updates
- ❌ Don't disable permanently - losing premium revenue

---

#### **Flexible Service Enabled** (`flexible_service_enabled`)
- **Default**: Enabled (true)
- **Purpose**: Allow customers to book flexible delivery
- **Impact**: Removes flexible option if disabled
- **Use Case**: Capacity management tool

**When to Disable:**
- ✅ High demand periods - need all capacity for standard/expedited
- ✅ Driver surplus - push customers to higher-margin services
- ⚠️ Rare - usually want to encourage flexible for route optimization

---

#### **Bulk Discount Enabled** (`bulk_discount_enabled`)
- **Default**: Enabled (true)
- **Purpose**: Automatic discounts for customers shipping multiple vehicles
- **Impact**: Applies tiered discounts (2+ vehicles = 5%, 3+ = 10%, 5+ = 15%)
- **Business Case**: Multi-vehicle bookings = efficient route use

**When to Disable:**
- ✅ High demand - don't need to incentivize bulk
- ✅ Testing baseline pricing without discounts
- ❌ Don't disable long-term - bulk customers are valuable

---

## Pricing Model Deep Dive

### Complete Calculation Flow

Here's how a quote is calculated from start to finish:

```
1. BASE RATE CALCULATION
   ├─ Distance < min_miles? 
   │  ├─ Yes → Use minimum quote ($150)
   │  └─ No → Calculate per-mile
   │           ├─ 0-250 mi: $2.80/mile
   │           ├─ 251-500 mi: $2.40/mile
   │           └─ 501+ mi: $2.10/mile

2. APPLY FUEL ADJUSTMENT
   Price × (1 + fuel_adjustment)
   fuel_adjustment = (current_fuel - base_fuel) × adjustment_factor

3. APPLY DELIVERY TYPE MULTIPLIER
   ├─ Expedited: × 1.25
   ├─ Standard: × 1.00
   └─ Flexible: × 0.95

4. APPLY BULK DISCOUNT (if enabled)
   ├─ 2 vehicles: -5%
   ├─ 3-4 vehicles: -10%
   └─ 5+ vehicles: -15%

5. APPLY SURGE (if enabled)
   Price × surge_multiplier

6. FINAL CHECK
   Result < minimum_quote? → Use minimum_quote
   Otherwise → Return calculated price
```

### Real Example Walkthrough

**Scenario:** 
- Distance: 350 miles
- Vehicles: 1
- Delivery: Expedited
- Is accident recovery: No

**Configuration:**
- Min quote: $150
- Min miles: 100
- Accident min: $80
- Base fuel: $3.70
- Current fuel: $4.20
- Fuel adjustment: 10%
- Surge enabled: Yes
- Surge multiplier: 1.15
- Expedited multiplier: 1.25

**Calculation:**

```
Step 1: Base Rate
├─ 350 miles > 100 (min_miles) → Calculate dynamically
├─ 350 miles is between 251-500 → MID DISTANCE
└─ Rate: $2.40/mile
    Base = 350 × $2.40 = $840

Step 2: Fuel Adjustment
├─ Difference: $4.20 - $3.70 = $0.50
├─ Adjustment: $0.50 × 10% = 0.05 (5%)
└─ Price: $840 × 1.05 = $882

Step 3: Delivery Type
├─ Expedited selected
└─ Price: $882 × 1.25 = $1,102.50

Step 4: Bulk Discount
├─ Only 1 vehicle
└─ No discount applied
    Price: $1,102.50

Step 5: Surge Pricing
├─ Surge enabled: Yes
├─ Multiplier: 1.15
└─ Price: $1,102.50 × 1.15 = $1,267.88

Step 6: Minimum Check
├─ $1,267.88 > $150 (minimum)
└─ FINAL PRICE: $1,267.88
```

**Price Breakdown for Customer:**
```
Base transport fee:        $840.00
Fuel surcharge (+5%):      $42.00
Expedited service (+25%):  $220.50
High demand surge (+15%):  $165.38
─────────────────────────────────
TOTAL:                     $1,267.88
```

---

## Best Practices

### Daily Operations

**Every Morning:**
1. Check fuel prices (5 minutes)
2. Review pending quotes
3. Assess driver availability
4. Adjust surge if needed

**Weekly:**
1. Update fuel price (Monday mornings)
2. Review configuration change history
3. Analyze quote acceptance rates
4. Adjust multipliers if needed

**Monthly:**
1. Full pricing audit
2. Compare to competitors
3. Review distance band performance
4. Optimize delivery type ratios

---

### Making Changes Safely

**Before Updating:**
1. ✅ Know WHY you're making the change
2. ✅ Predict the impact (use test calculator)
3. ✅ Prepare a descriptive change reason
4. ✅ Note the old value (easy rollback)

**After Updating:**
1. ✅ Generate test quote immediately
2. ✅ Verify calculation looks correct
3. ✅ Monitor first 10 quotes closely
4. ✅ Check acceptance rate vs. baseline
5. ✅ Be ready to revert if issues arise

**Change Reason Examples:**
- ❌ Bad: "update"
- ❌ Bad: "change price"
- ✅ Good: "Weekly fuel update - AAA average $4.52"
- ✅ Good: "Disable surge after July 4th weekend - demand normalized"
- ✅ Good: "Increase expedited to 1.30× - too many rush bookings"

---

### A/B Testing Strategy

**Want to test a price change? Use this approach:**

1. **Baseline Period (1 week)**
   - Record: Quote acceptance rate, revenue per job, customer feedback
   
2. **Test Change (1 week)**
   - Make ONE change at a time
   - Document reason: "A/B test - expedited 1.30× vs 1.25×"
   - Monitor same metrics

3. **Analysis**
   - Compare metrics
   - Did acceptance rate drop >10%? → Revert
   - Did revenue increase? → Keep
   - Customer complaints? → Adjust

4. **Decision**
   - Keep, revert, or try different value
   - Document findings in change reason

---

## Common Scenarios

### Scenario 1: Fuel Price Spike

**Situation:** Gas jumps from $3.70 to $4.50 overnight (+$0.80)

**Impact with current settings:**
```
Adjustment: $0.80 × 10% = 8% price increase
$500 quote → $540
```

**Options:**

**Option A - Full Pass-Through (Aggressive)**
- Increase adjustment factor to 15%
- New impact: $0.80 × 15% = 12% increase
- $500 → $560
- Risk: Customer shock

**Option B - Partial Absorption (Conservative)**
- Keep adjustment at 10%
- Eat 2% margin loss
- Gradual increases over 2 weeks
- Risk: Temporary margin hit

**Option C - Hybrid**
- Increase adjustment to 12%
- Also increase expedited multiplier 1.25 → 1.30
- Spreads increase across premium customers
- Risk: Balanced

**Best Practice:** Option C - gradual adjustment with premium focus

---

### Scenario 2: Holiday Weekend Surge

**Situation:** July 4th weekend, driver availability at 40%, bookings up 200%

**Friday Before (3 days out):**
```
1. Enable surge: ON
2. Set multiplier: 1.15× (conservative start)
3. Reason: "July 4th weekend surge - high demand expected"
4. Monitor: Watch acceptance rate
```

**Saturday (if still overwhelmed):**
```
1. Increase multiplier: 1.15 → 1.25
2. Reason: "July 4th surge increase - driver capacity at 40%"
3. Consider: Disable flexible service (focus on standard/expedited)
```

**Tuesday After:**
```
1. Disable surge: OFF
2. Re-enable flexible: ON
3. Reason: "Post-July 4th - demand normalized"
4. Thank drivers for holiday work
```

---

### Scenario 3: Losing Market Share

**Situation:** Quote acceptance rate dropped from 65% to 45% over 2 months

**Diagnosis Steps:**
1. Check competitors' pricing
2. Review fuel adjustment - too aggressive?
3. Analyze by delivery type - is expedited too expensive?
4. Check distance bands - are short trips overpriced?

**Potential Fixes:**

**If expedited is the issue:**
```
Old: 1.25×
New: 1.20× (-4% on expedited)
Impact: $500 expedited job → $480 (-$20)
```

**If fuel adjustment is too aggressive:**
```
Old: 10% factor
New: 8% factor
Impact: When gas is +$1 over base:
  Old: +10% surcharge
  New: +8% surcharge
  On $500: $550 → $540 (-$10)
```

**If short distance is too high:**
```
Old: Min quote $150, min miles 100
New: Min quote $135, min miles 100
Impact: All sub-100-mile jobs get $15 discount
```

---

### Scenario 4: Driver Shortage

**Situation:** Only 10 active drivers, 50+ pending shipments

**Immediate Actions:**
1. **Enable surge** - Increase driver motivation
   ```
   Surge: ON
   Multiplier: 1.25×
   Reason: "Driver shortage - incentivizing acceptance"
   ```

2. **Disable flexible service** - Focus capacity
   ```
   Flexible enabled: OFF
   Reason: "Temporary - driver capacity issue"
   ```

3. **Increase expedited premium** - Prioritize high-value jobs
   ```
   Old: 1.25×
   New: 1.40×
   Reason: "Premium increase to manage expedited demand during shortage"
   ```

**Within 24 hours:**
- Communicate to customers about delays
- Recruit additional drivers
- Consider temporary partnerships

**Recovery:**
- Gradually reduce surge over 3-5 days
- Re-enable flexible
- Return expedited to normal
- Document lessons learned

---

### Scenario 5: New Market Entry

**Situation:** Launching service in new city, need to gain market share quickly

**Aggressive Pricing Strategy:**
```
1. Reduce minimum quote
   $150 → $120 (competitive with local tow companies)

2. Lower fuel adjustment
   10% → 7% (absorb some fuel cost)

3. Reduce expedited premium
   1.25× → 1.18× (make premium service accessible)

4. Increase flexible discount
   0.95× → 0.88× (-12% for advance bookings)

5. Enable bulk discounts
   ON (reward multi-vehicle customers)

6. Distance bands
   Keep standard - adjust after 30 days of data

Change Reason: "New market entry - Dallas launch pricing Q4 2025"
```

**Timeline:**
- Month 1-2: Aggressive pricing, gain customers
- Month 3: Analyze profitability, adjust minimums
- Month 4: Normalize to standard pricing gradually
- Month 6: Full standard pricing achieved

---

## Troubleshooting

### Issue: Quotes Seem Too Low

**Check:**
1. Is surge disabled when it should be on?
2. Is flexible multiplier too aggressive (below 0.90)?
3. Are distance bands too low?
4. Is minimum quote below operating costs?

**Fix:**
- Enable surge temporarily
- Review last 50 accepted quotes for profitability
- Increase minimum quote by $10-15
- Adjust fuel factor up 1-2%

---

### Issue: Quote Acceptance Rate Dropping

**Check:**
1. Recent changes to configuration
2. Competitor pricing
3. Fuel adjustment - is it too high?
4. Surge accidentally left on?

**Fix:**
- Review change history (last 30 days)
- Revert recent changes one at a time
- A/B test lower multipliers
- Check if surge is enabled incorrectly

---

### Issue: Configuration Won't Save

**Possible Causes:**
1. Not logged in as admin
2. Invalid values (negative numbers, NaN)
3. Missing change reason
4. Network connectivity

**Fix:**
- Verify admin role in profile
- Check all fields for valid numbers
- Ensure change reason is filled out
- Refresh page and try again

---

### Issue: History Not Showing

**Possible Causes:**
1. No changes made yet (fresh config)
2. Database connection issue
3. Permissions problem

**Fix:**
- Make a test change to generate history
- Check backend logs for errors
- Verify admin API access

---

## Configuration Cheat Sheet

### Quick Reference Table

| Setting | Default | Safe Range | High Impact | Update Frequency |
|---------|---------|------------|-------------|------------------|
| Min Quote | $150 | $120-200 | ⚠️ High | Quarterly |
| Accident Min | $80 | $60-120 | ⚠️ Medium | Quarterly |
| Min Miles | 100 | 75-150 | ⚠️ High | Rarely |
| Base Fuel | $3.70 | - | ℹ️ Reference | Rarely |
| Current Fuel | $3.70 | $2.50-6.00 | 🔥 Critical | Weekly |
| Fuel Adjustment | 10% | 5-20% | 🔥 Critical | Monthly |
| Surge Enabled | OFF | ON/OFF | 🔥 Extreme | As needed |
| Surge Multiplier | 1.0× | 1.0-2.0× | 🔥 Extreme | With surge |
| Expedited | 1.25× | 1.15-1.50× | ⚠️ High | Monthly |
| Standard | 1.0× | 0.95-1.05× | 🔥 Critical | Rarely |
| Flexible | 0.95× | 0.80-0.98× | ⚠️ Medium | Monthly |
| Short Distance | 250 mi | 200-350 | ⚠️ High | Rarely |
| Mid Distance | 500 mi | 400-700 | ⚠️ High | Rarely |

### Symbol Legend:
- 🔥 **Critical**: Changes have immediate, large impact
- ⚠️ **High**: Significant impact on subset of quotes
- ℹ️ **Reference**: Informational, indirect impact

---

## Advanced Tips

### Seasonal Adjustments

**Summer (May-August):**
- Higher fuel prices → Update current fuel weekly
- Vacation season → Slight surge on weekends
- Heat impacts drivers → Consider +2% fuel adjustment

**Winter (November-February):**
- Holiday surge → Plan ahead for Thanksgiving, Christmas
- Weather delays → Increase expedited multiplier
- Snow/ice → Enable surge during storms

**Spring/Fall:**
- Stable periods → Test pricing changes
- Moderate demand → A/B test delivery type multipliers
- Good time for distance band optimization

---

### Competitive Intelligence

**Monthly Audit:**
1. Get 5 quotes from competitors (same routes)
2. Compare to your pricing
3. Are you within 10%? ✅ Competitive
4. More than 15% higher? ⚠️ Losing quotes
5. More than 15% lower? ⚠️ Leaving money on table

**Adjustment Strategy:**
- Don't match exactly (race to bottom)
- Differentiate on service quality
- Target 5-10% premium for superior service
- Use flexible pricing for price-sensitive customers

---

### Performance Metrics to Track

**Weekly:**
- Average quote value
- Quote acceptance rate
- Revenue per mile
- Fuel cost as % of revenue

**Monthly:**
- Profit margin by delivery type
- Distance band distribution
- Bulk discount impact
- Configuration change frequency

**Quarterly:**
- Seasonal trend analysis
- Competitive position
- Pricing model effectiveness
- Customer satisfaction vs. price

---

## Summary

Dynamic pricing configuration is a powerful tool that requires:
- ✅ Regular monitoring (daily fuel, weekly adjustments)
- ✅ Thoughtful changes (one at a time, with reasons)
- ✅ Data-driven decisions (track metrics, analyze impact)
- ✅ Customer focus (fair pricing, transparent surcharges)
- ✅ Flexibility (respond to market conditions quickly)

**Remember:** The goal is sustainable profitability, not maximum revenue. Fair pricing builds long-term customer relationships while ensuring drivers are fairly compensated.

---

## Support & Questions

**For Technical Issues:**
- Check backend logs: Railway deployment logs
- API errors: Review `/admin/pricing/config` endpoint responses
- Mobile app issues: Check console logs in React Native debugger

**For Business Questions:**
- Review historical performance data
- Consult with operations team on driver feedback
- Analyze customer surveys for pricing sentiment
- Compare to industry benchmarks

**For Training:**
- Practice in test environment first
- Use the test script to validate changes
- Shadow experienced admin for 1 week
- Make small changes initially, build confidence

---

**Version:** 1.0  
**Last Updated:** October 26, 2025  
**Author:** DriveDrop Development Team  
**Next Review:** January 2026
