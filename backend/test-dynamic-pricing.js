/**
 * Dynamic Pricing Configuration - Quick Test Script
 * 
 * This script tests the dynamic pricing system to ensure everything works correctly.
 * Run this after deploying the backend changes.
 */

// Test Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1'; // Change to your API URL
const ADMIN_TOKEN = 'YOUR_ADMIN_JWT_TOKEN'; // Replace with actual admin token

// Test 1: Get Active Configuration
async function testGetActiveConfig() {
  console.log('\n🧪 Test 1: Get Active Pricing Configuration');
  console.log('━'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/pricing/config`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Active configuration retrieved');
      console.log('Current Fuel Price:', data.data.current_fuel_price);
      console.log('Min Quote:', data.data.min_quote);
      console.log('Surge Enabled:', data.data.surge_enabled);
      console.log('Surge Multiplier:', data.data.surge_multiplier);
      return data.data;
    } else {
      console.error('❌ FAILED:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return null;
  }
}

// Test 2: Update Configuration
async function testUpdateConfig(configId) {
  console.log('\n🧪 Test 2: Update Pricing Configuration');
  console.log('━'.repeat(60));
  
  const updateData = {
    change_reason: 'Testing dynamic pricing system',
    current_fuel_price: 4.25,
    surge_enabled: true,
    surge_multiplier: 1.15
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/pricing/config/${configId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Configuration updated');
      console.log('New Fuel Price:', data.data.current_fuel_price);
      console.log('Surge Enabled:', data.data.surge_enabled);
      console.log('Surge Multiplier:', data.data.surge_multiplier);
      return true;
    } else {
      console.error('❌ FAILED:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

// Test 3: Get Quote with Dynamic Pricing
async function testQuoteWithDynamicPricing(userToken) {
  console.log('\n🧪 Test 3: Calculate Quote with Dynamic Pricing');
  console.log('━'.repeat(60));
  
  const quoteRequest = {
    vehicle_type: 'sedan',
    distance_miles: 250,
    pickup_date: '2025-02-01',
    delivery_date: '2025-02-05',
    is_accident_recovery: false,
    vehicle_count: 1,
    use_dynamic_config: true
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/pricing/quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken || ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quoteRequest)
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Quote calculated with dynamic pricing');
      console.log('Total Price:', `$${data.data.total}`);
      console.log('Fuel Price Used:', `$${data.data.breakdown.fuelPricePerGallon}/gal`);
      console.log('Surge Multiplier:', data.data.breakdown.surgeMultiplier);
      console.log('Delivery Type:', data.data.breakdown.deliveryType);
      console.log('Delivery Multiplier:', data.data.breakdown.deliveryTypeMultiplier);
      return data.data;
    } else {
      console.error('❌ FAILED:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return null;
  }
}

// Test 4: Get Change History
async function testGetHistory(configId) {
  console.log('\n🧪 Test 4: Get Configuration Change History');
  console.log('━'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/pricing/config/${configId}/history?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS: History retrieved');
      console.log('Number of history entries:', data.data.length);
      
      if (data.data.length > 0) {
        const latest = data.data[0];
        console.log('\nMost Recent Change:');
        console.log('  Reason:', latest.change_reason);
        console.log('  Changed Fields:', latest.changed_fields.join(', '));
        console.log('  Changed At:', latest.changed_at);
      }
      return true;
    } else {
      console.error('❌ FAILED:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

// Test 5: Clear Cache
async function testClearCache() {
  console.log('\n🧪 Test 5: Clear Pricing Cache');
  console.log('━'.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/admin/pricing/cache/clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Cache cleared');
      console.log('Timestamp:', data.data.timestamp);
      return true;
    } else {
      console.error('❌ FAILED:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

// Test 6: Compare Static vs Dynamic Pricing
async function testPricingComparison(userToken) {
  console.log('\n🧪 Test 6: Compare Static vs Dynamic Pricing');
  console.log('━'.repeat(60));
  
  const quoteRequest = {
    vehicle_type: 'suv',
    distance_miles: 150,
    is_accident_recovery: false,
    vehicle_count: 1
  };
  
  try {
    // Static pricing
    const staticResponse = await fetch(`${API_BASE_URL}/pricing/quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken || ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...quoteRequest, use_dynamic_config: false })
    });

    // Dynamic pricing
    const dynamicResponse = await fetch(`${API_BASE_URL}/pricing/quote`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken || ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...quoteRequest, use_dynamic_config: true })
    });

    const staticData = await staticResponse.json();
    const dynamicData = await dynamicResponse.json();
    
    if (staticResponse.ok && dynamicResponse.ok) {
      console.log('✅ SUCCESS: Both calculations completed');
      console.log('\nStatic Pricing (Hardcoded):');
      console.log('  Total:', `$${staticData.data.total}`);
      console.log('  Fuel Price:', `$${staticData.data.breakdown.fuelPricePerGallon}/gal`);
      
      console.log('\nDynamic Pricing (Database Config):');
      console.log('  Total:', `$${dynamicData.data.total}`);
      console.log('  Fuel Price:', `$${dynamicData.data.breakdown.fuelPricePerGallon}/gal`);
      
      const difference = dynamicData.data.total - staticData.data.total;
      const percentDiff = ((difference / staticData.data.total) * 100).toFixed(2);
      
      console.log('\nDifference:', `$${difference.toFixed(2)} (${percentDiff}%)`);
      return true;
    } else {
      console.error('❌ FAILED');
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
}

// Run All Tests
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Dynamic Pricing Configuration - Comprehensive Test Suite  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n⚠️  Before running:');
  console.log('1. Update API_BASE_URL with your API endpoint');
  console.log('2. Replace ADMIN_TOKEN with a valid admin JWT token');
  console.log('3. Ensure the database migration has been run');
  console.log('4. Start your backend server\n');
  
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  let passedTests = 0;
  let totalTests = 6;
  
  // Test 1: Get active config
  const activeConfig = await testGetActiveConfig();
  if (activeConfig) passedTests++;
  
  if (activeConfig) {
    // Test 2: Update config
    const updateSuccess = await testUpdateConfig(activeConfig.id);
    if (updateSuccess) passedTests++;
    
    // Test 3: Get quote with dynamic pricing
    const quote = await testQuoteWithDynamicPricing();
    if (quote) passedTests++;
    
    // Test 4: Get history
    const historySuccess = await testGetHistory(activeConfig.id);
    if (historySuccess) passedTests++;
    
    // Test 5: Clear cache
    const cacheSuccess = await testClearCache();
    if (cacheSuccess) passedTests++;
    
    // Test 6: Compare pricing methods
    const comparisonSuccess = await testPricingComparison();
    if (comparisonSuccess) passedTests++;
  } else {
    console.log('\n⚠️  Skipping remaining tests due to initial failure');
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                       TEST SUMMARY                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`Tests Failed: ${totalTests - passedTests}/${totalTests}\n`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Dynamic pricing system is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
  }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testGetActiveConfig,
    testUpdateConfig,
    testQuoteWithDynamicPricing,
    testGetHistory,
    testClearCache,
    testPricingComparison,
    runAllTests
  };
}

// Auto-run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}
