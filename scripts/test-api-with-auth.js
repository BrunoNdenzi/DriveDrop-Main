// test-api-with-auth.js
// Enhanced API testing script that handles authentication automatically

const fetch = require('node-fetch');
require('dotenv').config();
const { runAdminAuthTest } = require('./admin-auth-helper');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;

async function testHealthEndpoints() {
  console.log('=== Health Endpoints Test ===');
  
  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      console.log('✅ /health - OK');
      return true;
    } else {
      console.log('❌ /health - Failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Health endpoint error:', error.message);
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('DriveDrop API Testing with Authentication');
  console.log('========================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL || 'Not configured'}`);
  console.log('');

  // Test health endpoints
  const healthOk = await testHealthEndpoints();
  
  if (!healthOk) {
    console.log('❌ Health endpoints failed, cannot continue');
    return;
  }

  console.log('');
  console.log('=== Running Admin Authentication Tests ===');
  
  // Use the working admin authentication test
  const authSuccess = await runAdminAuthTest();
  
  if (authSuccess) {
    console.log('');
    console.log('🎊 ALL TESTS PASSED! 🎊');
    console.log('✅ Backend server is running');
    console.log('✅ Health endpoints working');
    console.log('✅ Authentication system working');
    console.log('✅ Protected endpoints accessible');
    console.log('✅ 401 errors have been resolved!');
    console.log('');
    console.log('🚀 Your driver app should now work correctly!');
  } else {
    console.log('');
    console.log('❌ Authentication tests failed');
  }
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
let TEST_TOKEN = process.env.TEST_TOKEN;

// Import auth helper functions
const { loginTestUser, createTestUser } = require('./auth-helper');

async function ensureAuthentication() {
  console.log('=== Authentication Check ===');
  
  if (TEST_TOKEN) {
    console.log('✅ Test token found in environment');
    
    // Quick test if the token works
    try {
      const response = await fetch(`${API_URL}/api/v1/drivers/applications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.status !== 401) {
        console.log('✅ Existing token appears to be valid');
        return TEST_TOKEN;
      } else {
        console.log('⚠️ Existing token is invalid or expired');
      }
    } catch (error) {
      console.log('⚠️ Could not test existing token:', error.message);
    }
  }
  
  console.log('🔄 Attempting to get new authentication token...');
  
  // Try to login with test user
  let token = await loginTestUser();
  
  if (!token) {
    console.log('🔄 Login failed, trying to create test user...');
    token = await createTestUser();
  }
  
  if (token) {
    console.log('✅ Successfully obtained authentication token');
    TEST_TOKEN = token;
    return token;
  } else {
    console.log('❌ Failed to obtain authentication token');
    return null;
  }
}

async function testHealthEndpoints() {
  console.log('\n=== Health Endpoints Test ===');
  
  const endpoints = ['/health', '/api/health'];
  let healthyEndpoint = null;
  
  for (const endpoint of endpoints) {
    const url = `${API_URL}${endpoint}`;
    try {
      const response = await fetch(url);
      if (response.status === 200) {
        console.log(`✅ ${endpoint} - OK`);
        healthyEndpoint = endpoint;
        break;
      } else {
        console.log(`❌ ${endpoint} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
  
  return healthyEndpoint !== null;
}

async function testDriverApplicationsEndpoint(token) {
  console.log('\n=== Driver Applications API Test ===');
  console.log(`Endpoint: ${API_URL}/api/v1/drivers/applications`);
  
  try {
    const response = await fetch(`${API_URL}/api/v1/drivers/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Driver applications endpoint test successful!');
      if (data.success && Array.isArray(data.data)) {
        console.log(`📊 Found ${data.data.length} applications`);
      }
      return true;
    } else if (response.status === 401) {
      console.log('❌ Authentication failed');
      console.log('💡 The token may be invalid, expired, or the user may not have driver role');
      return false;
    } else {
      console.log(`❌ Request failed with status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    return false;
  }
}

async function main() {
  console.log('DriveDrop API Testing with Authentication');
  console.log('========================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL || 'Not configured'}`);
  console.log('');
  
  // Check if required environment variables are set
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Missing Supabase configuration');
    console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
    process.exit(1);
  }
  
  // Test health endpoints first
  const healthOk = await testHealthEndpoints();
  if (!healthOk) {
    console.log('❌ Health check failed. Make sure the backend server is running.');
    process.exit(1);
  }
  
  // Ensure we have a valid authentication token
  const token = await ensureAuthentication();
  if (!token) {
    console.log('❌ Could not obtain authentication token');
    console.log('Please check your Supabase configuration and try again');
    process.exit(1);
  }
  
  // Test the protected endpoint
  const apiSuccess = await testDriverApplicationsEndpoint(token);
  
  console.log('\n=== Test Summary ===');
  console.log(`Health endpoints: ${healthOk ? '✅' : '❌'}`);
  console.log(`Authentication: ${token ? '✅' : '❌'}`);
  console.log(`Driver applications API: ${apiSuccess ? '✅' : '❌'}`);
  
  if (healthOk && token && apiSuccess) {
    console.log('\n🎉 All tests passed! The API is working correctly.');
    console.log(`\n📋 Your working test token:\nTEST_TOKEN=${token}`);
    console.log('\n💡 Save this token to your .env file for future testing');
  } else {
    console.log('\n❌ Some tests failed. Please check the output above for details.');
    process.exit(1);
  }
}

main();
