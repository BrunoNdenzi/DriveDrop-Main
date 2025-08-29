/**
 * Manual API endpoint verification script
 * This script tests the driver application endpoints without full integration tests
 */

const BASE_URL = 'http://localhost:3000/api/v1';

// Test configuration
const testConfig = {
  // These would need to be actual tokens from your auth system
  driverToken: 'your_driver_jwt_token_here',
  adminToken: 'your_admin_jwt_token_here',
  testShipmentId: 'your_test_shipment_id_here',
  testApplicationId: 'your_test_application_id_here',
};

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(
  endpoint: string,
  method: string,
  token: string,
  body?: Record<string, unknown>
) {
  const url = `${BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    console.log(`\n${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    return { response, data };
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Test driver application endpoints
 */
async function testDriverApplicationEndpoints() {
  console.log('=== Testing Driver Application Endpoints ===');

  try {
    // 1. Test applying for a shipment
    console.log('\n1. Testing POST /shipments/:id/apply');
    await makeRequest(
      `/shipments/${testConfig.testShipmentId}/apply`,
      'POST',
      testConfig.driverToken,
      {
        notes: 'I am available and have experience with similar deliveries',
      }
    );

    // 2. Test getting driver applications
    console.log('\n2. Testing GET /drivers/applications');
    await makeRequest('/drivers/applications', 'GET', testConfig.driverToken);

    // 3. Test getting driver applications with status filter
    console.log('\n3. Testing GET /drivers/applications?status=pending');
    await makeRequest(
      '/drivers/applications?status=pending',
      'GET',
      testConfig.driverToken
    );

    // 4. Test updating application status (admin)
    console.log('\n4. Testing PUT /applications/:id/status (admin)');
    await makeRequest(
      `/applications/${testConfig.testApplicationId}/status`,
      'PUT',
      testConfig.adminToken,
      {
        status: 'accepted',
        notes: 'Driver has excellent ratings',
      }
    );

    // 5. Test cancelling own application (driver)
    console.log('\n5. Testing PUT /applications/:id/status (driver cancel)');
    await makeRequest(
      `/applications/${testConfig.testApplicationId}/status`,
      'PUT',
      testConfig.driverToken,
      {
        status: 'cancelled',
        notes: 'No longer available',
      }
    );

    console.log('\n=== All endpoint tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

/**
 * Test error scenarios
 */
async function testErrorScenarios() {
  console.log('\n=== Testing Error Scenarios ===');

  try {
    // Test invalid shipment ID
    console.log('\n1. Testing invalid shipment ID');
    await makeRequest(
      '/shipments/invalid-uuid/apply',
      'POST',
      testConfig.driverToken,
      { notes: 'Test' }
    );

    // Test unauthorized access
    console.log('\n2. Testing unauthorized access');
    await makeRequest('/drivers/applications', 'GET', 'invalid_token');

    // Test invalid status
    console.log('\n3. Testing invalid status');
    await makeRequest(
      `/applications/${testConfig.testApplicationId}/status`,
      'PUT',
      testConfig.adminToken,
      { status: 'invalid_status' }
    );
  } catch (_error) {
    // TODO: Handle specific error types if needed
    console.log('Expected error scenarios completed');
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('Driver Application API Test Suite');
  console.log('=====================================');

  // Check if we have the required configuration
  if (
    !testConfig.driverToken.startsWith('your_') &&
    !testConfig.adminToken.startsWith('your_') &&
    !testConfig.testShipmentId.startsWith('your_')
  ) {
    await testDriverApplicationEndpoints();
    await testErrorScenarios();
  } else {
    console.log('\n⚠️  Test configuration incomplete!');
    console.log('Please update the testConfig object with actual values:');
    console.log('- driverToken: JWT token for a driver user');
    console.log('- adminToken: JWT token for an admin user');
    console.log('- testShipmentId: ID of a test shipment');
    console.log('- testApplicationId: ID of a test application');
    console.log('\nTo get these values:');
    console.log('1. Start the backend server');
    console.log('2. Use the auth endpoints to get tokens');
    console.log('3. Create test data in your database');
    console.log('4. Update this script and run again');
  }
}

// Export for potential use in other test files
export { testConfig, makeRequest, testDriverApplicationEndpoints };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
