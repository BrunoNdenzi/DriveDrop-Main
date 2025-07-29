/**
 * Supabase Token Validation Utility
 * 
 * This script helps validate Supabase tokens and extract information from them
 * for debugging purposes.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Make sure SUPABASE_URL and SUPABASE_KEY are in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Validates a Supabase token and returns user information
 */
async function validateToken(token) {
  try {
    // Check if token is valid and get user data
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('\nToken validation error:', error.message);
      return null;
    }
    
    if (!user) {
      console.error('\nNo user found for this token');
      return null;
    }
    
    // Get additional profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      console.warn('\nCould not fetch profile:', profileError.message);
    }
    
    return {
      user,
      profile: profile || null,
      token: {
        valid: true,
        expires: getUserExpiration(token),
      }
    };
  } catch (error) {
    console.error('\nUnexpected error validating token:', error.message);
    return null;
  }
}

/**
 * Extract expiration time from token
 */
function getUserExpiration(token) {
  try {
    // Supabase tokens are JWTs - the structure is header.payload.signature
    const payload = token.split('.')[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    if (decoded.exp) {
      const expirationDate = new Date(decoded.exp * 1000);
      return {
        timestamp: decoded.exp,
        date: expirationDate,
        expired: Date.now() > expirationDate,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing token:', error.message);
    return null;
  }
}

// Main function
async function main() {
  // Check if a token was provided
  const token = process.argv[2];
  
  if (!token) {
    console.log('Please provide a token to validate');
    console.log('Usage: node validate-token.js <YOUR_TOKEN>');
    return;
  }
  
  console.log('\nValidating Supabase token...');
  
  const result = await validateToken(token);
  
  if (!result) {
    console.log('\n❌ Invalid token');
    return;
  }
  
  console.log('\n✅ Token is valid');
  console.log('\nUser Information:');
  console.log('- ID:', result.user.id);
  console.log('- Email:', result.user.email);
  
  if (result.token.expires) {
    console.log('\nToken Expiration:');
    console.log('- Expires:', result.token.expires.date.toLocaleString());
    console.log('- Status:', result.token.expires.expired ? '❌ EXPIRED' : '✅ ACTIVE');
  }
  
  if (result.profile) {
    console.log('\nUser Profile:');
    console.log('- Name:', `${result.profile.first_name} ${result.profile.last_name}`);
    console.log('- Role:', result.profile.role);
    console.log('- Verified:', result.profile.is_verified ? '✅ Yes' : '❌ No');
  }
}

// Run the main function
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
