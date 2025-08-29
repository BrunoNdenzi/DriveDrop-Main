// verify-mobile-env.js
// Script to verify environment variables in the mobile app

require('dotenv').config();

// List of required environment variables for the mobile app
const requiredVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
];

// List of optional environment variables that should be checked
const optionalVars = [
  'EXPO_PUBLIC_ENV',
  'EXPO_PUBLIC_ENABLE_ANALYTICS',
  'EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS',
  'EXPO_PUBLIC_ENABLE_CRASH_REPORTING',
];

function checkEnvironmentVariables() {
  console.log('Checking mobile app environment variables...\n');

  let missingRequired = false;
  let missingOptional = false;

  // Check required variables
  console.log('Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName}: MISSING`);
      missingRequired = true;
    } else {
      // Show partial value for security
      const displayValue =
        value.length > 8
          ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
          : '****';
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  });

  console.log('\nOptional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`⚠️ ${varName}: MISSING`);
      missingOptional = true;
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  });

  console.log('\nSummary:');
  if (missingRequired) {
    console.log(
      '❌ Some required variables are missing. The app may not function correctly.'
    );
    console.log(
      '   Please create or update the .env file in the mobile directory.'
    );
  } else if (missingOptional) {
    console.log(
      '⚠️ All required variables are set, but some optional variables are missing.'
    );
    console.log('   The app will work, but some features might be disabled.');
  } else {
    console.log('✅ All environment variables are correctly set!');
  }

  // Special check for API URL format
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    if (apiUrl.startsWith('http://localhost')) {
      console.log(
        '\n⚠️ WARNING: Your API_URL is set to localhost, which may not work on physical devices.'
      );
      console.log(
        "   Consider using your computer's LAN IP address instead (e.g., http://192.168.1.x:3000)"
      );
    } else if (
      !apiUrl.startsWith('http://') &&
      !apiUrl.startsWith('https://')
    ) {
      console.log(
        "\n⚠️ WARNING: Your API_URL doesn't start with http:// or https://"
      );
    }
  }
}

checkEnvironmentVariables();
