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
