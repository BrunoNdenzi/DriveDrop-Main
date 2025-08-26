/**
 * Environment Variables Verification Script
 *
 * This script checks if all required environment variables are set.
 * It also verifies the security of certain key variables.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Check for security concerns
const securityChecks = {
  JWT_SECRET: {
    min_length: 32,
    value: null,
    secure: false,
    message: 'should be at least 32 characters and cryptographically secure',
  },
};

// Extract values for security checks
Object.keys(securityChecks).forEach(varName => {
  const regex = new RegExp(`${varName}=(.+)`);
  const match = env.match(regex);

  if (match && match[1]) {
    securityChecks[varName].value = match[1];

    // Check JWT_SECRET
    if (varName === 'JWT_SECRET') {
      if (
        match[1].length >= securityChecks[varName].min_length &&
        match[1] !== 'your-super-secret-jwt-key-here' &&
        match[1] !== 'secret' &&
        match[1] !== 'jwt_secret'
      ) {
        securityChecks[varName].secure = true;
      }
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

// Security check results
console.log(`\n${colors.blue}Security Checks${colors.reset}`);
console.log('-----------------------------------');

Object.keys(securityChecks).forEach(varName => {
  if (securityChecks[varName].value === null) {
    console.warn(`${colors.yellow}⚠️  ${varName}: Not defined${colors.reset}`);
  } else if (!securityChecks[varName].secure) {
    console.error(
      `${colors.red}❌ ${varName}: Insecure - ${securityChecks[varName].message}${colors.reset}`
    );
  } else {
    console.log(`${colors.green}✅ ${varName}: Secure${colors.reset}`);
  }
});

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

// Security recommendations
console.log(`\n${colors.magenta}Security Recommendations${colors.reset}`);
console.log('-----------------------------------');
console.log(
  `${colors.magenta}1. Generate secure random values for secrets:${colors.reset}`
);
console.log(
  `   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"${colors.reset}`
);
console.log(
  `${colors.magenta}2. Rotate secrets regularly, especially in production${colors.reset}`
);
console.log(
  `${colors.magenta}3. Use different values across environments${colors.reset}`
);
console.log(
  `${colors.magenta}4. Consider using a secrets manager for production${colors.reset}`
);

// Exit with appropriate code
if (
  missingVars.length > 0 ||
  Object.keys(securityChecks).some(
    k => securityChecks[k].value && !securityChecks[k].secure
  )
) {
  process.exit(1);
}

console.log(`\n${colors.green}Environment validation complete!${colors.reset}`);
