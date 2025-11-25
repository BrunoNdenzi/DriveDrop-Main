// Test script for geocoding API endpoint
// Run this in browser console on your website or use Postman

// Test 1: Geocode San Diego address
fetch('/api/geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: 'San Diego, CA 92116, USA' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Test 1 - San Diego:', data);
  // Expected: { lat: ~32.7631, lng: ~-117.1245, formatted_address: "..." }
});

// Test 2: Geocode Los Angeles address
fetch('/api/geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: '11000 Wilshire Blvd, Los Angeles, CA 90024, USA' })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Test 2 - Los Angeles:', data);
  // Expected: { lat: ~34.0592, lng: ~-118.4441, formatted_address: "..." }
});

// Test 3: Invalid address
fetch('/api/geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: 'xyzabc123invalid' })
})
.then(r => r.json())
.then(data => {
  console.log('⚠️ Test 3 - Invalid address:', data);
  // Expected: { error: "Address not found" }
});

// Test 4: Missing address
fetch('/api/geocode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(data => {
  console.log('⚠️ Test 4 - Missing address:', data);
  // Expected: { error: "Address is required" }
});

console.log('🧪 Running geocoding API tests...');
console.log('Check console output above for results');
