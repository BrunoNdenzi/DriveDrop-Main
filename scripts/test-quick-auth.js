// Quick authentication test - simplified approach
require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Use a different test email to avoid confirmation issues
const TEST_EMAIL = `brunoapplication80@gmail.com`;
const TEST_PASSWORD = 'aaaaaa';

async function quickAuthTest() {
  console.log('🚀 Quick Authentication Test');
  console.log('============================');
  console.log(`Testing with: ${TEST_EMAIL}`);
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase configuration in .env file');
    return;
  }

  let token = null;

  // Step 1: Try to create a new user
  console.log('Step 1: Creating test user...');
  try {
    const signupResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        options: {
          data: {
            first_name: 'Test',
            last_name: 'Driver',
            role: 'driver'
          }
        }
      }),
    });

    const signupResult = await signupResponse.json();
    
    if (signupResponse.ok && signupResult.access_token) {
      console.log('✅ User created and got token immediately');
      token = signupResult.access_token;
    } else {
      console.log('⚠️ Signup result:', signupResult);
      console.log('🔄 User may need confirmation or already exists');
    }
  } catch (error) {
    console.error('❌ Signup error:', error.message);
  }

  // Step 2: If no token from signup, try login
  if (!token) {
    console.log('\nStep 2: Attempting login...');
    try {
      const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      });

      const loginResult = await loginResponse.json();
      
      if (loginResponse.ok && loginResult.access_token) {
        console.log('✅ Login successful');
        token = loginResult.access_token;
      } else {
        console.log('❌ Login failed:', loginResult);
      }
    } catch (error) {
      console.error('❌ Login error:', error.message);
    }
  }

  // Step 3: Test the protected endpoint
  if (token) {
    console.log('\nStep 3: Testing protected endpoint...');
    try {
      const testResponse = await fetch(`${API_URL}/api/v1/drivers/applications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (testResponse.ok) {
        const data = await testResponse.json();
        console.log('✅ SUCCESS! Protected endpoint working');
        console.log('Response:', data);
        console.log('');
        console.log('🎉 Authentication is working correctly!');
        console.log('💡 The 401 errors should now be resolved');
      } else {
        const error = await testResponse.text();
        console.log(`❌ Protected endpoint failed with status ${testResponse.status}`);
        console.log('Error:', error);
      }
    } catch (error) {
      console.error('❌ Error testing endpoint:', error.message);
    }
  } else {
    console.log('\n❌ Could not obtain authentication token');
    console.log('');
    console.log('🔧 Troubleshooting tips:');
    console.log('1. Check if email confirmation is disabled in Supabase Auth settings');
    console.log('2. Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
    console.log('3. Check Supabase dashboard for user creation');
    console.log('4. Consider manually confirming the user email in Supabase dashboard');
  }
}

// Run the test
quickAuthTest().catch(console.error);
