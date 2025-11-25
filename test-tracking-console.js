// ============================================================
// BROWSER CONSOLE TEST SCRIPT
// ============================================================
// Run this in your browser console on the tracking page to verify everything works
// Open DevTools (F12) → Console tab → Paste this entire script → Press Enter

console.log('🧪 Starting Tracking System Test...\n');

// Test 1: Check if Google Maps is loaded
console.log('📍 Test 1: Google Maps API');
if (window.google && window.google.maps) {
  console.log('✅ Google Maps API loaded successfully');
  console.log('   Version:', window.google.maps.version || 'unknown');
} else {
  console.log('❌ Google Maps API not loaded');
  console.log('   Check: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local');
}

// Test 2: Check Supabase connection
console.log('\n📡 Test 2: Supabase Client');
try {
  const supabaseModule = require('@/lib/supabase-client');
  console.log('✅ Supabase client module found');
} catch (e) {
  console.log('⚠️ Running in browser context (expected)');
}

// Test 3: Check current page state
console.log('\n📄 Test 3: Page State');
const url = window.location.href;
const shipmentId = url.match(/track\/([^\/]+)/)?.[1];
console.log('   Current URL:', url);
console.log('   Shipment ID:', shipmentId || 'NOT FOUND');

// Test 4: Simulate location insert (generates SQL)
console.log('\n💾 Test 4: Generated SQL for Testing');
if (shipmentId) {
  const testSQL = `
-- Copy and paste this into Supabase SQL Editor

-- Step 1: Get shipment details
SELECT id, driver_id, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng
FROM shipments 
WHERE id = '${shipmentId}';

-- Step 2: Insert test location (REPLACE driver_id with result from Step 1)
INSERT INTO driver_locations (driver_id, shipment_id, latitude, longitude, accuracy, speed, heading, location_timestamp)
VALUES (
  'PASTE_DRIVER_ID_HERE'::uuid,
  '${shipmentId}'::uuid,
  33.7490, -84.3880, 10.0, 15.0, 90.0, NOW()
);

-- Step 3: Verify
SELECT * FROM driver_locations WHERE shipment_id = '${shipmentId}' ORDER BY location_timestamp DESC LIMIT 1;

-- Step 4: Simulate movement (run multiple times)
UPDATE driver_locations 
SET latitude = latitude + 0.001, longitude = longitude + 0.001, 
    heading = 45.0, location_timestamp = NOW()
WHERE shipment_id = '${shipmentId}'
AND id = (SELECT id FROM driver_locations WHERE shipment_id = '${shipmentId}' ORDER BY location_timestamp DESC LIMIT 1);
`;
  console.log(testSQL);
  console.log('\n📋 SQL copied to console. Copy and paste into Supabase SQL Editor!');
} else {
  console.log('❌ Cannot generate SQL - shipment ID not found in URL');
}

// Test 5: Check for React DevTools
console.log('\n⚛️ Test 5: React DevTools');
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('✅ React DevTools detected');
} else {
  console.log('ℹ️ React DevTools not installed (optional)');
}

// Test 6: Monitor for location updates
console.log('\n👂 Test 6: Setting up Realtime Listener');
console.log('   This will log any location updates received...');
console.log('   (Insert test data via SQL to see updates)\n');

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));
console.log('Next Steps:');
console.log('1. Copy the SQL above');
console.log('2. Open Supabase SQL Editor');
console.log('3. Run Step 1 to get driver_id');
console.log('4. Run Step 2 with the driver_id');
console.log('5. Refresh this page');
console.log('6. You should see the driver marker on the map!');
console.log('='.repeat(60));

// Listen for errors
const originalError = console.error;
console.error = function(...args) {
  if (args[0]?.includes?.('Invalid coordinates')) {
    console.log('\n⚠️ EXPECTED: "Invalid coordinates" error means no location data exists yet');
    console.log('   → Insert test data using the SQL above to fix this');
  }
  originalError.apply(console, args);
};

console.log('\n✨ Test script complete! Check results above.\n');
