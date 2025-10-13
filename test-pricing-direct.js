// Direct pricing service test (no API call needed)
const testPricingDirect = () => {
  console.log('\n=== DIRECT PRICING SERVICE TEST ===\n');
  
  // Simulate the pricing calculation
  const distanceMiles = 1358; // Dallas to San Diego
  const vehicleType = 'sedan';
  const deliveryDays = 7; // 2025-10-13 to 2025-10-20
  const fuelPrice = 3.70; // Base fuel price
  
  // Constants
  const MIN_MILES = 100;
  const MIN_QUOTE = 150;
  const BASE_FUEL_PRICE = 3.70;
  
  // Distance band
  let tier, rate;
  if (distanceMiles < 500) {
    tier = 'short';
    rate = 1.80;
  } else if (distanceMiles <= 1500) {
    tier = 'mid';
    rate = 0.95;
  } else {
    tier = 'long';
    rate = 0.60;
  }
  
  // Base price
  const rawBasePrice = distanceMiles * rate;
  
  // Delivery type multiplier
  let deliveryType, deliveryMultiplier;
  if (deliveryDays < 7) {
    deliveryType = 'expedited';
    deliveryMultiplier = 1.25;
  } else if (deliveryDays >= 7) {
    deliveryType = 'flexible';
    deliveryMultiplier = 0.95;
  } else {
    deliveryType = 'standard';
    deliveryMultiplier = 1.0;
  }
  
  // Apply delivery multiplier
  let subtotal = rawBasePrice * deliveryMultiplier;
  
  // Fuel adjustment
  const fuelAdjustmentPercent = (fuelPrice - BASE_FUEL_PRICE) * 5; // 5% per $1
  const fuelMultiplier = 1 + (fuelAdjustmentPercent / 100);
  subtotal = subtotal * fuelMultiplier;
  
  // Apply minimum if needed
  let minimumApplied = false;
  if (distanceMiles < MIN_MILES && subtotal < MIN_QUOTE) {
    subtotal = MIN_QUOTE;
    minimumApplied = true;
  }
  
  const total = parseFloat(subtotal.toFixed(2));
  
  // Display results
  console.log('Route: Dallas (75202) → San Diego (92116)');
  console.log('Distance: ' + distanceMiles + ' miles');
  console.log('Vehicle: ' + vehicleType);
  console.log('Delivery: ' + deliveryDays + ' days (' + deliveryType + ')');
  console.log('Fuel Price: $' + fuelPrice + '/gallon\n');
  
  console.log('CALCULATION:');
  console.log('  1. Distance Band: ' + tier);
  console.log('  2. Base Rate: $' + rate + '/mile');
  console.log('  3. Raw Base Price: ' + distanceMiles + ' × $' + rate + ' = $' + rawBasePrice.toFixed(2));
  console.log('  4. Delivery Multiplier: ' + deliveryMultiplier + 'x (' + deliveryType + ')');
  console.log('  5. After Delivery: $' + rawBasePrice.toFixed(2) + ' × ' + deliveryMultiplier + ' = $' + (rawBasePrice * deliveryMultiplier).toFixed(2));
  console.log('  6. Fuel Adjustment: ' + fuelAdjustmentPercent + '% (fuel at $' + fuelPrice + ')');
  console.log('  7. Fuel Multiplier: ' + fuelMultiplier + 'x');
  console.log('  8. After Fuel: $' + (rawBasePrice * deliveryMultiplier).toFixed(2) + ' × ' + fuelMultiplier + ' = $' + (rawBasePrice * deliveryMultiplier * fuelMultiplier).toFixed(2));
  console.log('  9. Minimum Applied: ' + minimumApplied);
  console.log('\n✅ FINAL TOTAL: $' + total);
  
  console.log('\n=== COMPARISON ===');
  console.log('Website shows: $1,063.74 (using ~1,120 miles - WRONG!)');
  console.log('Mobile shows: $855.00 (using 500 miles - VERY WRONG!)');
  console.log('Correct calculation: $' + total + ' (using 1,358 miles)');
  
  console.log('\n=== TEST OTHER SCENARIOS ===\n');
  
  // Expedited (< 7 days)
  const expeditedSubtotal = rawBasePrice * 1.25 * fuelMultiplier;
  console.log('Expedited (< 7 days): $' + expeditedSubtotal.toFixed(2));
  
  // Standard (no dates)
  const standardSubtotal = rawBasePrice * 1.0 * fuelMultiplier;
  console.log('Standard (no dates): $' + standardSubtotal.toFixed(2));
  
  console.log('\n✅ All calculations complete!');
};

testPricingDirect();
