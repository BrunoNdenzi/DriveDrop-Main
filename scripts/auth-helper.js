// auth-helper.js
// Script to help generate and test authentication tokens for the DriveDrop API

const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function createTestUser() {
  console.log('Creating test driver user...');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
    return null;
  }

  try {
    // Create a test user via Supabase Auth
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: 'test-driver@drivedrop.com',
        password: 'TestDriver123!',
        options: {
          data: {
            first_name: 'Test',
            last_name: 'Driver',
            role: 'driver'
          }
        }
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Test user signup completed');
      
      // If we got an access token directly (email confirmation disabled)
      if (result.access_token) {
        console.log('✅ Got access token from signup');
        return result.access_token;
      }
      
      // If email confirmation is required, user exists but needs confirmation
      console.log('🔄 User created but may need confirmation, trying login...');
      return await loginTestUser();
    } else {
      console.log('⚠️ Signup failed, user might already exist. Trying login...');
      return await loginTestUser();
    }
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    return null;
  }
}

async function loginTestUser() {
  console.log('Logging in test driver user...');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: 'test-driver@drivedrop.com',
        password: 'TestDriver123!',
      }),
    });

    const result = await response.json();
    
    if (response.ok && result.access_token) {
      console.log('✅ Login successful');
      console.log('Access Token:', result.access_token);
      return result.access_token;
    } else {
      console.log('❌ Login failed:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Error during login:', error.message);
    return null;
  }
}

async function testAuthenticatedEndpoint(token) {
  console.log('\nTesting authenticated endpoint...');
  
  try {
    const response = await fetch(`${API_URL}/api/v1/drivers/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Authentication test successful!');
      return true;
    } else {
      console.log('❌ Authentication test failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    return false;
  }
}

async function main() {
  console.log('DriveDrop Authentication Helper');
  console.log('===============================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL || 'Not set'}`);
  console.log('');

  // First try to login with existing user
  let token = await loginTestUser();
  
  // If login fails, try to create a new user
  if (!token) {
    console.log('\nLogin failed, trying to create new user...');
    token = await createTestUser();
  }
  
  if (token) {
    console.log('\n📋 Token for testing:');
    console.log(`TEST_TOKEN=${token}`);
    console.log('\n💡 Add this to your .env file in the scripts directory');
    
    // Test the token with our API
    await testAuthenticatedEndpoint(token);
  } else {
    console.log('\n❌ Failed to obtain authentication token');
    console.log('Please check your Supabase configuration and try again');
  }
}

// Allow the script to be run directly or imported
if (require.main === module) {
  main();
} else {
  module.exports = { createTestUser, loginTestUser, testAuthenticatedEndpoint };
}
