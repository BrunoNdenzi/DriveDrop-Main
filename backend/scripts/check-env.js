/**
 * Script to verify Node.js and npm versions
 */
const { execSync } = require('child_process');

const requiredNodeVersion = 18;
const requiredNpmVersion = 8;

try {
  // Check Node.js version
  const nodeVersionOutput = execSync('node -v').toString().trim();
  const nodeVersion = parseInt(nodeVersionOutput.match(/v(\d+)\./)[1], 10);
  
  // Check npm version
  const npmVersionOutput = execSync('npm -v').toString().trim();
  const npmVersion = parseInt(npmVersionOutput.split('.')[0], 10);
  
  console.log(`Node.js version: ${nodeVersionOutput} (required: v${requiredNodeVersion} or higher)`);
  console.log(`npm version: ${npmVersionOutput} (required: v${requiredNpmVersion} or higher)`);
  
  if (nodeVersion < requiredNodeVersion) {
    console.error('\x1b[31m%s\x1b[0m', `Error: Node.js v${requiredNodeVersion} or higher is required.`);
    process.exit(1);
  }
  
  if (npmVersion < requiredNpmVersion) {
    console.error('\x1b[31m%s\x1b[0m', `Error: npm v${requiredNpmVersion} or higher is required.`);
    process.exit(1);
  }
  
  console.log('\x1b[32m%s\x1b[0m', 'Environment check passed! ✅');
} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', 'Error checking environment:', error.message);
  process.exit(1);
}
