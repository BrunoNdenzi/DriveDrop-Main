// test-applications-endpoint.js
// Script to test the applications endpoint for network errors

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.error('Error: TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env file for testing auth endpoints');
  console.log('Continuing without auth testing...');
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testApplicationsEndpoint() {
  try {
    console.log('Testing driver applications endpoint...');
    
    // Sign in as test user if credentials are available
    if (TEST_USER_EMAIL && TEST_USER_PASSWORD) {
      console.log(`Signing in as ${TEST_USER_EMAIL}...`);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      });
      
      if (authError) {
        console.error('Authentication failed:', authError);
        return;
      }
      
      console.log('Authentication successful');
      console.log('User ID:', authData.user.id);
      console.log('User Role:', authData.user.user_metadata.role);
    } else {
      console.log('Skipping authentication (no test credentials provided)');
    }
    
    // Test driver_applications endpoint
    console.log('\nFetching driver applications...');
    const { data: applications, error: applicationsError } = await supabase
      .from('driver_applications')
      .select('*')
      .limit(10);
    
    if (applicationsError) {
      console.error('Error fetching applications:', applicationsError);
    } else {
      console.log(`Successfully fetched ${applications?.length || 0} applications`);
      if (applications && applications.length > 0) {
        console.log('First application:', JSON.stringify(applications[0], null, 2));
      }
    }
    
    // Check network connectivity to Supabase
    console.log('\nChecking Supabase connectivity...');
    const startTime = Date.now();
    const { data: healthData, error: healthError } = await supabase.rpc('ping');
    const endTime = Date.now();
    
    if (healthError) {
      console.error('Health check failed:', healthError);
    } else {
      console.log(`Health check successful - response time: ${endTime - startTime}ms`);
      console.log('Response:', healthData);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function main() {
  await testApplicationsEndpoint();
}

// Create a ping function if it doesn't exist
async function createPingFunction() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.log('Skipping ping function creation (no service key provided)');
    return;
  }
  
  const adminClient = createClient(SUPABASE_URL, serviceKey);
  
  const { error } = await adminClient.rpc('create_ping_function');
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating ping function:', error);
  }
}

// Create helper ping function
async function setupHelperFunctions() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.log('Skipping helper function setup (no service key provided)');
    return;
  }
  
  const adminClient = createClient(SUPABASE_URL, serviceKey);
  
  // Create ping function
  const createPingSQL = `
    CREATE OR REPLACE FUNCTION ping()
    RETURNS text AS $$
    BEGIN
      RETURN 'pong';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  const { error } = await adminClient.rpc('exec_sql', { sql: createPingSQL });
  if (error) {
    console.error('Error setting up helper functions:', error);
  } else {
    console.log('Helper functions created successfully');
  }
}

// Setup and run
(async function() {
  try {
    await setupHelperFunctions();
    await main();
  } catch (err) {
    console.error('Setup error:', err);
  }
})();
