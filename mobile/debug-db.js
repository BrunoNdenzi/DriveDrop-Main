const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tgdewxxmfmbvvcelngeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZGV3eHhtZm1idnZjZWxuZ2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMzg2MjYsImV4cCI6MjA2NzgxNDYyNn0.El2Fz_mOaKEbILsSz3nIzkHHqjS1UANDgjl82Pf83_M';

const client = createClient(supabaseUrl, supabaseKey);

async function debugDatabase() {
  console.log('🔍 Debugging Supabase Database...\n');
  
  // Test 1: Check profiles table structure
  console.log('1. Testing profiles table access...');
  try {
    const { data, error } = await client.from('profiles').select('*').limit(1);
    if (error) {
      console.log('❌ Profiles table error:', error.message);
    } else {
      console.log('✅ Profiles table accessible');
      if (data && data.length > 0) {
        console.log('📋 Sample profile columns:', Object.keys(data[0]));
      }
    }
  } catch (err) {
    console.log('❌ Profiles table connection error:', err.message);
  }

  // Test 2: Check if phone column exists
  console.log('\n2. Checking if phone column exists...');
  try {
    const { data, error } = await client.from('profiles').select('phone').limit(1);
    if (error) {
      console.log('❌ Phone column error:', error.message);
    } else {
      console.log('✅ Phone column exists and accessible');
    }
  } catch (err) {
    console.log('❌ Phone column check error:', err.message);
  }

  // Test 3: Try to create a test user (this will trigger the handle_new_user function)
  console.log('\n3. Testing user creation (this will test the trigger)...');
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'test123456';
  
  try {
    const { data, error } = await client.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'Test',
          last_name: 'User',
          role: 'client',
          phone: '1234567890'
        }
      }
    });

    if (error) {
      console.log('❌ User creation failed:', error.message);
      console.log('🔍 Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ User creation successful!');
      console.log('👤 User ID:', data.user?.id);
      
      // Check if profile was created
      if (data.user?.id) {
        const { data: profile, error: profileError } = await client
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        if (profileError) {
          console.log('❌ Profile creation failed:', profileError.message);
        } else {
          console.log('✅ Profile created successfully!');
          console.log('📋 Profile data:', profile);
        }
      }
    }
  } catch (err) {
    console.log('❌ User creation error:', err.message);
  }

  console.log('\n🔍 Database debugging complete!');
}

debugDatabase().catch(console.error);