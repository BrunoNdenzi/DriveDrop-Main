/**
 * Environment Variables Verification Script
 *
 * This script checks if all required environment variables are set.
 * It also verifies that environment variables follow Expo's naming conventions.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Check if .env file exists
if (!fs.existsSync(path.join(__dirname, '..', '.env'))) {
  console.error(`${colors.red}ERROR: .env file not found!${colors.reset}`);
  console.log(
    `${colors.yellow}Please copy .env.example to .env and fill in your values.${colors.reset}`
  );
  process.exit(1);
}

// Read .env.example to get required variables
const envExamplePath = path.join(__dirname, '..', '.env.example');
const envExample = fs.readFileSync(envExamplePath, 'utf8');

// Parse .env.example to get required variables
const requiredVars = [];
const commentedVars = [];

envExample.split('\n').forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || line.trim() === '') {
    return;
  }

  // Check if this is a variable definition (not a commented variable)
  if (line.includes('=')) {
    const varName = line.split('=')[0].trim();

    // Check if the line is commented out
    const isCommented = envExample.includes(`# ${varName}=`);

    if (!isCommented) {
      requiredVars.push(varName);
    } else {
      commentedVars.push(varName);
    }
  }
});

// Read actual .env file
const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');

// Check if all required variables are defined
const missingVars = [];

requiredVars.forEach(varName => {
  const regex = new RegExp(`${varName}=.+`);
  if (!regex.test(env)) {
    missingVars.push(varName);
  }
});

// Check for Expo variable naming convention
const nonExpoVars = [];

env.split('\n').forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || line.trim() === '') {
    return;
  }

  // Check variable naming convention
  if (line.includes('=')) {
    const varName = line.split('=')[0].trim();

    if (!varName.startsWith('EXPO_PUBLIC_')) {
      nonExpoVars.push(varName);
    }
  }
});

// Report results
console.log(`${colors.blue}Environment Variable Verification${colors.reset}`);
console.log('-----------------------------------');

if (missingVars.length === 0) {
  console.log(
    `${colors.green}✅ All required environment variables are defined.${colors.reset}`
  );
} else {
  console.error(
    `${colors.red}❌ Missing required environment variables:${colors.reset}`
  );
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log(
    `\n${colors.yellow}Please add these variables to your .env file.${colors.reset}`
  );
}

if (nonExpoVars.length > 0) {
  console.warn(
    `\n${colors.yellow}⚠️  Warning: Non-standard variable naming detected:${colors.reset}`
  );
  console.warn(
    `${colors.yellow}   In Expo, client-side variables should start with EXPO_PUBLIC_${colors.reset}`
  );
  nonExpoVars.forEach(v => console.log(`   - ${v}`));
}

// Optional variables note
if (commentedVars.length > 0) {
  console.log(
    `\n${colors.cyan}ℹ️  Optional variables available:${colors.reset}`
  );
  console.log(
    `${colors.cyan}   The following variables are optional and commented out in .env.example:${colors.reset}`
  );
  commentedVars.forEach(v => console.log(`   - ${v}`));
}

// Exit with appropriate code
if (missingVars.length > 0) {
  process.exit(1);
}

console.log(`\n${colors.green}Environment validation complete!${colors.reset}`);
