#!/bin/bash
# Test script for payment status updates

echo "Testing Payment Status Updates"

# Set environment variables
export API_URL=${API_URL:-http://localhost:3000}
export TEST_USER_EMAIL=${TEST_USER_EMAIL:-client@example.com}
export TEST_USER_PASSWORD=${TEST_USER_PASSWORD:-password123}

# Check if we're in the right directory (should be in scripts/)
if [ ! -f "test-payment-status.js" ]; then
  echo "Error: test-payment-status.js not found in current directory."
  echo "Please run this script from the scripts directory."
  exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
  echo "Warning: .env file not found. Looking for .env in parent directory..."
  if [ -f "../.env" ]; then
    echo "Found .env in parent directory, copying it..."
    cp ../.env .env
  else
    echo "No .env file found. Make sure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are set."
  fi
fi

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' .env | xargs)
fi

# Check for required dependencies
echo "Checking for required npm packages..."
if ! npm list node-fetch dotenv @supabase/supabase-js --depth=0 > /dev/null 2>&1; then
  echo "Installing required packages..."
  npm install node-fetch dotenv @supabase/supabase-js --no-save > /dev/null
fi

# Execute test
echo "Running payment status update test..."
node test-payment-status.js

if [ $? -ne 0 ]; then
  echo "Test failed with error code $?"
  exit $?
else
  echo "Test completed successfully!"
fi

echo "Test complete"