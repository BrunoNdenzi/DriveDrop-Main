// test-api-endpoint.js
// Script to test the backend API endpoint for driver applications

// Use node-fetch v2 which works in CommonJS modules
// To install it: npm install node-fetch@2
const fetch = require('node-fetch');
require('dotenv').config();

// Configuration - replace these with your actual values if needed
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN; // Add a valid token to your .env file

// First check if the API health endpoint is working
async function checkHealthEndpoint() {
  console.log(`\n=== Checking API Health ===`);
  console.log(`=========================\n`);
  
  // Test both possible health endpoints
  const endpoints = [
    `${API_URL}/api/health`,
    `${API_URL}/health`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint}`);
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
      });
      
      if (response.status === 200) {
        const data = await response.json();
        console.log(`✅ Health check successful at ${endpoint}`);
        console.log(`   Response:`, JSON.stringify(data, null, 2));
        return true;
      } else {
        console.log(`❌ Health check failed at ${endpoint} with status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Health check error at ${endpoint}:`, error.message);
    }
    console.log('');
  }
  
  return false;
}

async function testDriverApplicationsEndpoint() {
  console.log(`\n=== Testing Driver Applications API ===`);
  console.log(`Endpoint: ${API_URL}/api/v1/drivers/applications`);
  console.log(`Authentication: ${TEST_TOKEN ? 'Token provided' : 'No token provided'}`);
  console.log(`======================================\n`);
  
  if (!TEST_TOKEN) {
    console.log('❌ No authentication token provided');
    console.log('💡 To get a test token:');
    console.log('   1. Run: node auth-helper.js');
    console.log('   2. Copy the TEST_TOKEN to your .env file');
    console.log('   3. Re-run this test');
    console.log('');
    return;
  }
  
  try {
    // Make request to applications endpoint
    console.log('Sending authenticated request...');
    const response = await fetch(`${API_URL}/api/v1/drivers/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('\nResponse received:');
    console.log('- Status:', response.status);
    console.log('- Status text:', response.statusText);
    
    // Try to parse response as JSON
    const contentType = response.headers.get('content-type');
    console.log('- Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('\nResponse data:');
      console.log(JSON.stringify(data, null, 2));
      
      // Check if the response includes applications data
      if (data.success && Array.isArray(data.data)) {
        console.log(`\n✅ Success! Found ${data.data.length} applications.`);
      } else if (data.error) {
        console.log(`\n❌ API returned an error: ${data.error.message || 'Unknown error'}`);
        if (data.error.code === 'UNAUTHORIZED') {
          console.log('💡 This usually means:');
          console.log('   - Invalid or expired authentication token');
          console.log('   - User does not have driver role');
          console.log('   - Token format is incorrect');
          console.log('   Run: node auth-helper.js to get a new token');
        }
      }
    } else {
      const text = await response.text();
      console.log('\nResponse text (non-JSON):');
      console.log(text);
    }
  } catch (error) {
    console.error('\n❌ Error testing endpoint:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\nThe server appears to be down or not running at the specified address.');
      console.log('Make sure your backend server is running and the API_URL is correct.');
    }
  }
}

// Main execution function
async function runTests() {
  console.log('DriveDrop API Testing Tool');
  console.log('========================');
  console.log('Node.js version:', process.version);
  console.log('Testing API at:', API_URL);
  
  // First check API health
  const healthOk = await checkHealthEndpoint();
  
  if (healthOk) {
    // If health check passes, test the applications endpoint
    await testDriverApplicationsEndpoint();
  } else {
    console.log('\n❌ Health check failed. Skipping applications endpoint test.');
    console.log('Please ensure the backend server is running correctly.');
  }
  
  console.log('\nTesting complete.');
}

// Run the tests
runTests();
