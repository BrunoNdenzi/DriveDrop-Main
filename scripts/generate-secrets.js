#!/usr/bin/env node

/**
 * Secure Secrets Generator
 * This script helps developers generate secure random values for secrets.
 * 
 * Usage: node generate-secrets.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string to generate
 * @param {string} encoding - Encoding to use ('hex', 'base64', etc.)
 * @returns {string} Random string
 */
function generateSecureString(length = 32, encoding = 'hex') {
  // For hex encoding, we need half the bytes (2 hex chars per byte)
  const byteLength = encoding === 'hex' ? Math.ceil(length / 2) : length;
  return crypto.randomBytes(byteLength).toString(encoding);
}

/**
 * Print menu and get user selection
 */
function showMenu() {
  console.log(`\n${colors.blue}====== DriveDrop Secure Secrets Generator ======${colors.reset}`);
  console.log(`\n${colors.yellow}Generate secure random values for your environment variables:${colors.reset}`);
  console.log(`${colors.cyan}1. Generate JWT Secret${colors.reset}`);
  console.log(`${colors.cyan}2. Generate API Key${colors.reset}`);
  console.log(`${colors.cyan}3. Generate Database Password${colors.reset}`);
  console.log(`${colors.cyan}4. Generate Multiple Values (for .env file)${colors.reset}`);
  console.log(`${colors.cyan}5. Exit${colors.reset}`);
  
  rl.question(`\n${colors.yellow}Select an option (1-5): ${colors.reset}`, handleMenuSelection);
}

/**
 * Handle user's menu selection
 * @param {string} choice - User's choice
 */
function handleMenuSelection(choice) {
  switch (choice) {
    case '1':
      generateJwtSecret();
      break;
    case '2':
      generateApiKey();
      break;
    case '3':
      generateDatabasePassword();
      break;
    case '4':
      generateMultipleValues();
      break;
    case '5':
      console.log(`\n${colors.green}Thank you for using the DriveDrop Secure Secrets Generator!${colors.reset}`);
      rl.close();
      break;
    default:
      console.log(`\n${colors.red}Invalid selection. Please try again.${colors.reset}`);
      showMenu();
      break;
  }
}

/**
 * Generate a JWT secret
 */
function generateJwtSecret() {
  const jwtSecret = generateSecureString(64, 'hex');
  
  console.log(`\n${colors.green}Generated JWT Secret:${colors.reset}`);
  console.log(`\n${jwtSecret}`);
  
  console.log(`\n${colors.yellow}Copy this value to your .env file:${colors.reset}`);
  console.log(`\nJWT_SECRET=${jwtSecret}`);
  
  console.log(`\n${colors.cyan}This secret is cryptographically secure and suitable for production use.${colors.reset}`);
  
  returnToMenu();
}

/**
 * Generate an API key
 */
function generateApiKey() {
  rl.question(`\n${colors.yellow}What is this API key for? (e.g., 'stripe', 'sendgrid'): ${colors.reset}`, (service) => {
    // Generate a key with a prefix for easier identification
    const prefix = service.toUpperCase().substring(0, 3);
    const apiKey = `${prefix}_${generateSecureString(32, 'base64').replace(/[+/=]/g, '')}`;
    
    console.log(`\n${colors.green}Generated API Key for ${service}:${colors.reset}`);
    console.log(`\n${apiKey}`);
    
    console.log(`\n${colors.yellow}Copy this value to your .env file:${colors.reset}`);
    console.log(`\n${service.toUpperCase()}_API_KEY=${apiKey}`);
    
    returnToMenu();
  });
}

/**
 * Generate a secure database password
 */
function generateDatabasePassword() {
  // Create a strong password with special characters, numbers, and mixed case
  const password = generateSecureString(16, 'base64')
    .replace(/[+/=]/g, '') // Remove URL-unsafe characters
    + '@' + Math.floor(Math.random() * 100) 
    + '!';
  
  console.log(`\n${colors.green}Generated Database Password:${colors.reset}`);
  console.log(`\n${password}`);
  
  console.log(`\n${colors.yellow}Copy this value to your .env file or database configuration:${colors.reset}`);
  console.log(`\nDB_PASSWORD=${password}`);
  
  returnToMenu();
}

/**
 * Generate multiple values for a complete .env file
 */
function generateMultipleValues() {
  const values = {
    JWT_SECRET: generateSecureString(64, 'hex'),
    JWT_REFRESH_SECRET: generateSecureString(64, 'hex'),
    DB_PASSWORD: generateSecureString(16, 'base64').replace(/[+/=]/g, '') + '@' + Math.floor(Math.random() * 100) + '!',
    STRIPE_SECRET_KEY: `sk_test_${generateSecureString(24, 'base64').replace(/[+/=]/g, '')}`,
    SENDGRID_API_KEY: `SG.${generateSecureString(32, 'base64').replace(/[+/=]/g, '')}`,
    AWS_SECRET_ACCESS_KEY: generateSecureString(40, 'base64').replace(/[+/=]/g, ''),
  };
  
  console.log(`\n${colors.green}Generated Secret Values:${colors.reset}\n`);
  
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
  
  rl.question(`\n${colors.yellow}Do you want to save these to a file? (y/n): ${colors.reset}`, (answer) => {
    if (answer.toLowerCase() === 'y') {
      saveToFile(values);
    } else {
      console.log(`\n${colors.cyan}Values not saved. Make sure to copy them manually if needed.${colors.reset}`);
      returnToMenu();
    }
  });
}

/**
 * Save generated values to a file
 * @param {Object} values - Key-value pairs to save
 */
function saveToFile(values) {
  rl.question(`\n${colors.yellow}Save to which file? (.env.generated): ${colors.reset}`, (filePath) => {
    filePath = filePath || '.env.generated';
    
    // Create content with comments
    let content = '# DriveDrop Generated Secrets\n';
    content += '# IMPORTANT: These are automatically generated secure values.\n';
    content += '# You should review and transfer them to your actual .env file.\n';
    content += '# Generated on: ' + new Date().toISOString() + '\n\n';
    
    for (const [key, value] of Object.entries(values)) {
      content += `${key}=${value}\n`;
    }
    
    // Resolve path relative to current directory
    const fullPath = path.resolve(process.cwd(), filePath);
    
    // Write to file
    fs.writeFileSync(fullPath, content);
    
    console.log(`\n${colors.green}Values saved to ${fullPath}${colors.reset}`);
    console.log(`\n${colors.yellow}IMPORTANT: This file contains sensitive information. Do not commit it to version control.${colors.reset}`);
    
    returnToMenu();
  });
}

/**
 * Return to main menu
 */
function returnToMenu() {
  rl.question(`\n${colors.blue}Press Enter to return to the menu...${colors.reset}`, () => {
    showMenu();
  });
}

// Start the application
showMenu();

// Handle CTRL+C
rl.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Exiting Secure Secrets Generator.${colors.reset}`);
  rl.close();
});

// Handle process exit
process.on('exit', () => {
  console.log(`\n${colors.green}Remember to keep your secrets secure and never commit them to version control.${colors.reset}`);
});
