// Test with CORRECTED road multiplier (1.15x)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // CORRECTED: Use 1.15x multiplier
  const roadMultiplier = 1.15;
  return Math.round(distance * roadMultiplier * 100) / 100;
}

// Dallas to San Diego
const dallas = { lat: 32.7767, lng: -96.7970 };
const sanDiego = { lat: 32.7157, lng: -117.1611 };

const distance = haversine(dallas.lat, dallas.lng, sanDiego.lat, sanDiego.lng);

console.log('\n=== CORRECTED DISTANCE CALCULATION ===\n');
console.log('Route: Dallas 75202 → San Diego 92116');
console.log(`Calculated distance: ${distance} miles`);
console.log(`Google Maps actual: 1,358 miles`);
console.log(`Error: ${Math.abs(distance - 1358).toFixed(2)} miles (${((Math.abs(distance - 1358) / 1358) * 100).toFixed(1)}%)`);

// Calculate pricing
console.log('\n=== PRICING WITH CORRECTED DISTANCE ===\n');

const BASE_RATE = 0.95; // mid tier
const FLEXIBLE_MULTIPLIER = 0.95;

const rawPrice = distance * BASE_RATE;
const flexiblePrice = rawPrice * FLEXIBLE_MULTIPLIER;
const standardPrice = rawPrice * 1.0;
const expeditedPrice = rawPrice * 1.25;

console.log(`Distance: ${distance} miles`);
console.log(`Base rate: $${BASE_RATE}/mile (mid tier)`);
console.log(`Raw price: ${distance} × $${BASE_RATE} = $${rawPrice.toFixed(2)}`);
console.log('');
console.log(`Flexible (0.95x): $${flexiblePrice.toFixed(2)}`);
console.log(`Standard (1.00x): $${standardPrice.toFixed(2)}`);
console.log(`Expedited (1.25x): $${expeditedPrice.toFixed(2)}`);

console.log('\n=== COMPARISON WITH TARGET ===');
console.log('');
console.log('EXPECTED (1,358 miles):');
console.log('  Flexible: $1,225.59');
console.log('  Standard: $1,290.10');
console.log('  Expedited: $1,612.63');
console.log('');
console.log(`CALCULATED (${distance} miles):`);
console.log(`  Flexible: $${flexiblePrice.toFixed(2)} (${flexiblePrice > 1225.59 ? '+' : ''}${(flexiblePrice - 1225.59).toFixed(2)})`);
console.log(`  Standard: $${standardPrice.toFixed(2)} (${standardPrice > 1290.10 ? '+' : ''}${(standardPrice - 1290.10).toFixed(2)})`);
console.log(`  Expedited: $${expeditedPrice.toFixed(2)} (${expeditedPrice > 1612.63 ? '+' : ''}${(expeditedPrice - 1612.63).toFixed(2)})`);

const percentDiff = ((flexiblePrice - 1225.59) / 1225.59 * 100).toFixed(1);
console.log('');
console.log(`Price accuracy: ${Math.abs(percentDiff)}% ${percentDiff > 0 ? 'higher' : 'lower'} than target`);

if (Math.abs(parseFloat(percentDiff)) < 5) {
  console.log('\n✅ EXCELLENT! Within ±5% accuracy target');
} else if (Math.abs(parseFloat(percentDiff)) < 10) {
  console.log('\n✅ GOOD! Within ±10% acceptable range');
} else {
  console.log('\n⚠️ Needs improvement - over 10% difference');
}

console.log('\n=== OLD VS NEW ===');
console.log('Mobile OLD: 500 miles → $855.00 (❌ 43% undercharge!)');
console.log(`Mobile NEW: ${distance} miles → $${flexiblePrice.toFixed(2)} (✅ ${Math.abs(percentDiff)}% difference)`);
