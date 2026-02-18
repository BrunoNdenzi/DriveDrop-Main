// Test the updated distance calculation
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  // Apply road distance multiplier
  const roadMultiplier = 1.3;
  return Math.round(distance * roadMultiplier * 100) / 100;
}

function extractZip(address) {
  const zipRegex = /\b(\d{5})(?:-\d{4})?\b/;
  const match = address.match(zipRegex);
  return match ? match[1] : null;
}

const zipCoords = {
  '75202': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '92116': { lat: 32.7157, lng: -117.1611 }, // San Diego
};

// Test 1: Extract ZIP codes
const pickup = "Dallas, Carolina 75202";
const delivery = "San Diego, California 92116";

const pickupZip = extractZip(pickup);
const deliveryZip = extractZip(delivery);

console.log('\n=== ZIP CODE EXTRACTION TEST ===\n');
console.log('Pickup address:', pickup);
console.log('Extracted ZIP:', pickupZip);
console.log('Delivery address:', delivery);
console.log('Extracted ZIP:', deliveryZip);

// Test 2: Lookup coordinates
console.log('\n=== COORDINATE LOOKUP TEST ===\n');
const pickupCoords = zipCoords[pickupZip];
const deliveryCoords = zipCoords[deliveryZip];

console.log(`${pickupZip} coordinates:`, pickupCoords);
console.log(`${deliveryZip} coordinates:`, deliveryCoords);

// Test 3: Calculate distance
console.log('\n=== DISTANCE CALCULATION TEST ===\n');
const distance = haversine(
  pickupCoords.lat, pickupCoords.lng,
  deliveryCoords.lat, deliveryCoords.lng
);

console.log(`Straight line: ~1,182 miles`);
console.log(`With road multiplier (1.3x): ${distance} miles`);
console.log(`Google Maps actual: 1,358 miles`);
console.log(`\nDifference: ${Math.abs(distance - 1358).toFixed(2)} miles (${((Math.abs(distance - 1358) / 1358) * 100).toFixed(1)}% error)`);

// Test 4: Calculate pricing
const BASE_RATE = 0.95; // mid tier for 1,536 miles
const FLEXIBLE_MULTIPLIER = 0.95;
const rawPrice = distance * BASE_RATE;
const finalPrice = rawPrice * FLEXIBLE_MULTIPLIER;

console.log('\n=== PRICING CALCULATION TEST ===\n');
console.log(`Distance: ${distance} miles`);
console.log(`Base rate: $${BASE_RATE}/mile`);
console.log(`Raw price: ${distance} × $${BASE_RATE} = $${rawPrice.toFixed(2)}`);
console.log(`Flexible (0.95x): $${rawPrice.toFixed(2)} × 0.95 = $${finalPrice.toFixed(2)}`);

console.log('\n=== COMPARISON ===');
console.log('Mobile OLD (500 miles): $855.00 ❌');
console.log(`Mobile NEW (${distance} miles): $${finalPrice.toFixed(2)} ✅`);
console.log('Should be (1,358 miles): $1,225.59');
console.log(`Difference: $${Math.abs(finalPrice - 1225.59).toFixed(2)}`);

// Calculate correct road multiplier
console.log('\n=== ROAD MULTIPLIER ANALYSIS ===');
const straightLineDist = 1181.59;
const actualGoogleDist = 1358;
const correctMultiplier = actualGoogleDist / straightLineDist;
console.log(`Straight line distance: ${straightLineDist.toFixed(2)} miles`);
console.log(`Google Maps distance: ${actualGoogleDist} miles`);
console.log(`Correct multiplier: ${correctMultiplier.toFixed(2)}x`);
console.log(`Current multiplier: 1.30x`);
console.log(`\nRecommendation: Change roadMultiplier from 1.30 to ${correctMultiplier.toFixed(2)}`);
