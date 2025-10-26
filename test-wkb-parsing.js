// Test WKB parsing to debug coordinate issue
// Run with: node test-wkb-parsing.js

function hexToDouble(hex, littleEndian = false) {
  if (hex.length !== 16) {
    console.error('Invalid hex length:', hex.length);
    return NaN;
  }

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  
  // Parse hex string as bytes
  for (let i = 0; i < 8; i++) {
    const byteHex = hex.substring(i * 2, i * 2 + 2);
    const byteValue = parseInt(byteHex, 16);
    view.setUint8(i, byteValue);
  }
  
  return view.getFloat64(0, littleEndian);
}

function parseWKB(wkbHex) {
  console.log('\n========================================');
  console.log('Parsing WKB:', wkbHex);
  console.log('Length:', wkbHex.length);
  
  // Extract parts
  const byteOrder = wkbHex.substring(0, 2);
  const geometryType = wkbHex.substring(2, 10);
  const srid = wkbHex.substring(10, 18);
  const lonHex = wkbHex.substring(18, 34);
  const latHex = wkbHex.substring(34, 50);
  
  console.log('Byte order:', byteOrder);
  console.log('Geometry type:', geometryType);
  console.log('SRID:', srid);
  console.log('Longitude hex:', lonHex);
  console.log('Latitude hex:', latHex);
  
  const longitude = hexToDouble(lonHex, true);
  const latitude = hexToDouble(latHex, true);
  
  console.log('\nResult:');
  console.log('Longitude:', longitude);
  console.log('Latitude:', latitude);
  console.log('========================================\n');
  
  return { latitude, longitude };
}

// Test cases from your logs
console.log('TEST 1: Pickup Location (Dallas - should be ~32.777, -96.804)');
const pickup = parseWKB('0101000020E6100000C2E33675793358C05D55511784634040');

console.log('TEST 2: Delivery Location (should also be near Dallas)');
const delivery = parseWKB('0101000020E6100000A11CBBFAE7475DC0EB02B91F4B624040');

// Verify
console.log('\n\n========== VERIFICATION ==========');
console.log('Pickup:', pickup);
console.log('Delivery:', delivery);
console.log('\nExpected pickup: ~32.777, -96.804');
console.log('Expected delivery: near Dallas (32.x, -96.x)');
console.log('==================================\n');
