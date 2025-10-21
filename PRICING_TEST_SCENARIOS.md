# Pricing Test Scenarios - Verification Guide

## ✅ Already Tested (from your console logs)
1. **Dallas → New York** (1577 mi, long, flexible) = $899.24 ✅
2. **Dallas → San Diego** (1359 mi, mid, flexible) = $1,226.41 ✅
3. **Dallas → ?** (500 mi, short, flexible) = $855 ✅

All using 10-day delivery window (flexible pricing at 0.95x)

---

## 🧪 Additional Test Scenarios to Verify

### Scenario Group 1: Delivery Type Multipliers

#### Test A: Expedited Delivery (<7 days)
**Route**: Dallas (75202) → San Diego (92116)
**Setup**:
- Pickup Date: October 21, 2025
- Delivery Date: October 25, 2025 (4 days)
**Expected**:
- Distance: ~1359 miles (mid band)
- Base rate: $0.95/mile = $1,290.95
- Delivery type: **Expedited** (1.25x multiplier)
- **Expected Total**: ~$1,613.69 (25% higher than flexible)

#### Test B: Standard Delivery (no dates)
**Route**: Dallas (75202) → San Diego (92116)
**Setup**:
- Leave both pickup and delivery dates EMPTY
**Expected**:
- Distance: ~1359 miles (mid band)
- Base rate: $0.95/mile = $1,290.95
- Delivery type: **Standard** (1.0x multiplier)
- **Expected Total**: ~$1,290.95 (base price, no adjustment)

#### Test C: No Delivery Date (ASAP/Expedited)
**Route**: Dallas (75202) → San Diego (92116)
**Setup**:
- Pickup Date: October 21, 2025
- Delivery Date: EMPTY (leave blank)
**Expected**:
- Distance: ~1359 miles (mid band)
- Delivery type: **Expedited** (1.25x multiplier)
- **Expected Total**: ~$1,613.69 (same as Test A)

---

### Scenario Group 2: Distance Bands

#### Test D: Short Distance (<500 miles)
**Route**: Dallas (75202) → Houston (77001)
**Setup**:
- Any delivery type (use flexible for consistency)
- Pickup: Oct 21, Delivery: Oct 31
**Expected**:
- Distance: ~250 miles (short band)
- Base rate: $1.80/mile = $450
- Delivery type: Flexible (0.95x)
- **Expected Total**: ~$427.50

#### Test E: Mid Distance (500-1500 miles)
**Already tested**: Dallas → San Diego = $1,226.41 ✅

#### Test F: Long Distance (>1500 miles)
**Already tested**: Dallas → New York = $899.24 ✅

---

### Scenario Group 3: Minimum Quote Logic

#### Test G: Very Short Trip (<100 miles)
**Route**: Use two nearby ZIP codes (e.g., Dallas area)
**Setup**:
- Distance: <100 miles (should trigger $150 minimum)
- Standard delivery (1.0x multiplier)
**Expected**:
- Even if calculated price is $90, should show **$150 minimum**
- Breakdown should show `minimumApplied: true`

#### Test H: Accident Recovery Minimum
**Route**: Short distance
**Setup**:
- Check "Accident Recovery" option (if available in form)
- Distance: <100 miles
**Expected**:
- Should apply **$80 minimum** (lower than standard)
- Breakdown should show `minimumApplied: true`

---

### Scenario Group 4: Fuel Price Adjustment

#### Test I: High Fuel Price
**Route**: Dallas → San Diego
**Setup**:
- If app allows fuel price input, set to $4.70 (+$1 from base)
- Standard delivery
**Expected**:
- Base calculation: $1,290.95
- Fuel adjustment: +5% (1.05x multiplier)
- **Expected Total**: ~$1,355.50

#### Test J: Low Fuel Price
**Route**: Dallas → San Diego
**Setup**:
- If app allows, set fuel to $2.70 (-$1 from base)
- Standard delivery
**Expected**:
- Base calculation: $1,290.95
- Fuel adjustment: -5% (0.95x multiplier)
- **Expected Total**: ~$1,226.40

---

### Scenario Group 5: Multiple Vehicles (Bulk Discount)

#### Test K: 3-5 Vehicles (10% discount)
**Route**: Dallas → San Diego
**Setup**:
- Add 3 vehicles (if form supports)
- Standard delivery
**Expected**:
- Base for 1 vehicle: $1,290.95
- Bulk discount: -10% = -$129.10
- Subtotal: $1,161.85 per vehicle
- **Total for 3**: ~$3,485.55

#### Test L: 6-9 Vehicles (15% discount)
**Setup**: 6 vehicles
**Expected**: 15% bulk discount applied

#### Test M: 10+ Vehicles (20% discount)
**Setup**: 10 vehicles
**Expected**: 20% bulk discount applied

---

## 📊 Quick Reference: Expected Prices for Dallas → San Diego (1359 mi, Sedan)

| Delivery Type | Multiplier | Days | Price |
|---------------|------------|------|-------|
| Expedited | 1.25x | <7 days | $1,613.69 |
| Standard | 1.0x | No dates | $1,290.95 |
| Flexible | 0.95x | ≥7 days | $1,226.41 ✅ |

*All assume base fuel ($3.70), no bulk discount, no surge*

---

## 🎯 Priority Tests

If you only have time for a few tests, do these:

1. **Test A**: Expedited delivery (should be +25% higher)
2. **Test B**: Standard delivery (no dates = base price)
3. **Test G**: Very short trip (verify $150 minimum)

These will confirm all three major components:
- ✅ Delivery type multiplier working
- ✅ Standard pricing working  
- ✅ Minimum quote logic working

---

## 📝 How to Report Results

For each test, note:
```
Route: [Origin] → [Destination]
Distance: [miles]
Dates: Pickup [date], Delivery [date]
Days Difference: [X days]
Expected Type: [expedited/standard/flexible]
Expected Price: $[amount]
Actual Price: $[amount]
Status: ✅ Match / ❌ Mismatch
```

---

## Current Status

✅ **Flexible delivery pricing** - VERIFIED WORKING
⏳ **Expedited delivery pricing** - NEEDS TESTING
⏳ **Standard delivery pricing** - NEEDS TESTING
⏳ **Minimum quote logic** - NEEDS TESTING
⏳ **Fuel price adjustment** - NEEDS TESTING (if accessible in UI)
