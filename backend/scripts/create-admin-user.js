/**
 * Script to create a default admin user
 * 
 * This script creates a default admin user in Supabase
 * with email 'brunondenzi80@gmail.com' and password 'admin123'
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Exit if we're missing required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\x1b[31mError: Missing Supabase environment variables.\x1b[0m');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  process.exit(1);
}

// Create Supabase admin client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const EMAIL = 'drivedrop.us.com';
const PASSWORD = 'admin123';

async function createAdminUser() {
  try {
    console.log('🔑 Creating default admin user...');
    
    // First, check if user already exists by querying the profiles table
    const { data: existingProfiles, error: profileQueryError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', EMAIL)
      .limit(1);
    
    if (profileQueryError) {
      console.warn('Could not check profiles table:', profileQueryError.message);
    }
    
    if (existingProfiles && existingProfiles.length > 0) {
      console.log(`\x1b[33mUser ${EMAIL} already exists. Updating to admin role...\x1b[0m`);
      
      // Update profile table to ensure role is set
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('email', EMAIL);
      
      if (profileError) throw profileError;
      
      console.log(`\x1b[32mUser ${EMAIL} has been updated to admin role.\x1b[0m`);
      return;
    }
    
    // Create new user with admin role
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'admin' },
    });
    
    if (authError) {
      // If "admin.createUser" doesn't exist, try the regular signup method
      if (authError.message.includes('not a function')) {
        console.log('Falling back to regular signup method...');
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: EMAIL,
          password: PASSWORD,
          options: {
            data: { role: 'admin' }
          }
        });
        
        if (signupError) throw signupError;
        
        if (!signupData?.user) {
          throw new Error('User signup succeeded but no user was returned');
        }
        
        console.log(`\x1b[32mAdmin user created successfully: ${EMAIL}\x1b[0m`);
        console.log('User ID:', signupData.user.id);
        
        // Ensure profile has admin role set
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: signupData.user.id,
            role: 'admin',
            first_name: 'Admin',
            last_name: 'User',
            email: EMAIL,
            updated_at: new Date().toISOString(),
          });
        
        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      } else {
        throw authError;
      }
    } else if (authData?.user) {
      console.log(`\x1b[32mAdmin user created successfully: ${EMAIL}\x1b[0m`);
      console.log('User ID:', authData.user.id);
      
      // Ensure profile has admin role set
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          role: 'admin',
          first_name: 'Admin',
          last_name: 'User',
          email: EMAIL,
          updated_at: new Date().toISOString(),
        });
      
      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }
    
    console.log('\x1b[32mDefault admin account is ready to use!\x1b[0m');
    console.log(`Email: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    
  } catch (err) {
    console.error('\x1b[31mError creating admin user:\x1b[0m', err);
    process.exit(1);
  }
}

createAdminUser();
