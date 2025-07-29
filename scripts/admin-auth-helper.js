// admin-auth-helper.js
// Create confirmed users using Supabase service role key (admin access)

const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use a unique test email
const TEST_EMAIL = `test-driver-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestDriver123!';

async function createConfirmedTestUser() {
  console.log('Creating confirmed test driver user with admin privileges...');
  console.log(`Email: ${TEST_EMAIL}`);
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
    return null;
  }

  try {
    // Create user with service role key (bypasses email confirmation)
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true, // This confirms the email immediately
        user_metadata: {
          first_name: 'Test',
          last_name: 'Driver',
          role: 'driver'
        }
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Test user created with confirmed email');
      console.log('User ID:', result.id);
      
      // Create the profile in the profiles table
      const profileCreated = await createUserProfile(result.id);
      
      if (profileCreated) {
        // Now get an access token for this user
        return await loginConfirmedUser();
      } else {
        console.log('❌ Failed to create user profile');
        return null;
      }
    } else {
      console.log('❌ Failed to create user:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Error creating confirmed user:', error.message);
    return null;
  }
}

async function createUserProfile(userId) {
  console.log('Creating user profile in profiles table...');
  
  try {
    // Use service role key to insert into profiles table
    const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: userId,
        email: TEST_EMAIL,
        first_name: 'Test',
        last_name: 'Driver',
        role: 'driver',
        is_verified: true,
        rating: 5.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
    });

    if (response.ok || response.status === 201) {
      console.log('✅ User profile created successfully');
      return true;
    } else {
      const error = await response.text();
      console.log('❌ Failed to create profile:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error creating profile:', error.message);
    return false;
  }
}

async function loginConfirmedUser() {
  console.log('Logging in confirmed test user...');
  
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
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

    const result = await response.json();
    
    if (response.ok && result.access_token) {
      console.log('✅ Login successful');
      console.log('Access Token length:', result.access_token.length);
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
  console.log('\n=== Testing Protected Endpoints ===');
  
  try {
    const response = await fetch(`${API_URL}/api/v1/drivers/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ /api/v1/drivers/applications - SUCCESS');
      console.log('Response:', JSON.stringify(data, null, 2));
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ /api/v1/drivers/applications - FAILED (${response.status})`);
      console.log('Error:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    return false;
  }
}

async function runAdminAuthTest() {
  console.log('🔐 DriveDrop Admin Authentication Test');
  console.log('=====================================');
  console.log('');

  // Step 1: Create confirmed user
  const token = await createConfirmedTestUser();
  
  if (!token) {
    console.log('\n❌ Could not obtain authentication token');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env');
    console.log('2. Check Supabase project settings');
    console.log('3. Verify service role key has admin permissions');
    return false;
  }

  // Step 2: Test protected endpoint
  const success = await testAuthenticatedEndpoint(token);
  
  if (success) {
    console.log('\n🎉 All authentication tests passed!');
    console.log('✅ User creation with email confirmation working');
    console.log('✅ Login with confirmed user working');
    console.log('✅ Protected endpoints accessible');
    console.log('\n💡 Your 401 authentication errors should now be resolved!');
    return true;
  } else {
    console.log('\n❌ Some tests failed');
    return false;
  }
}

// Export functions for use in other scripts
module.exports = {
  createConfirmedTestUser,
  loginConfirmedUser,
  testAuthenticatedEndpoint,
  runAdminAuthTest,
  TEST_EMAIL,
  TEST_PASSWORD
};

// Run the test if this script is executed directly
if (require.main === module) {
  runAdminAuthTest().catch(console.error);
}
