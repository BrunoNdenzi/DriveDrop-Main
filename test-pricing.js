// Quick test script for pricing API
const testPricing = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/pricing/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vehicle_type: 'sedan',
        distance_miles: 1358, // Correct Dallas to San Diego distance
        pickup_date: '2025-10-13',
        delivery_date: '2025-10-20', // 7 days = flexible
        is_accident_recovery: false,
        vehicle_count: 1,
        surge_multiplier: 1,
        fuel_price_per_gallon: 3.70, // Base fuel price
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', error);
      return;
    }

    const data = await response.json();
    console.log('\n=== PRICING TEST RESULTS ===\n');
    console.log('Route: Dallas (75202) → San Diego (92116)');
    console.log('Distance: 1,358 miles');
    console.log('Vehicle: Sedan');
    console.log('Delivery Type: Flexible (7 days)');
    console.log('Fuel Price: $3.70/gallon\n');
    
    if (data.data) {
      console.log('Total: $' + data.data.total);
      console.log('\nBreakdown:');
      console.log('  Base Rate: $' + data.data.breakdown.baseRatePerMile + '/mile');
      console.log('  Distance Band:', data.data.breakdown.distanceBand);
      console.log('  Raw Base Price: $' + data.data.breakdown.rawBasePrice);
      console.log('  Delivery Type:', data.data.breakdown.deliveryType);
      console.log('  Delivery Multiplier:', data.data.breakdown.deliveryTypeMultiplier + 'x');
      console.log('  Fuel Price: $' + data.data.breakdown.fuelPricePerGallon + '/gallon');
      console.log('  Fuel Adjustment:', data.data.breakdown.fuelAdjustmentPercent + '%');
      console.log('  Minimum Applied:', data.data.breakdown.minimumApplied);
      console.log('\n✅ Expected: ~$1,225 (flexible) to $1,290 (standard)');
    } else {
      console.log('Full Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Make sure backend server is running on port 3000');
  }
};

testPricing();
