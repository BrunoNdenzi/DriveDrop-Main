# DriveDrop Testing Scripts

This directory contains scripts for testing and debugging the DriveDrop application.

## Prerequisites

- Node.js (v14 or later recommended)
- npm (Node package manager)
- Running backend server for API tests

## Available Scripts

## Payment Testing

1. **test-payment-status.js**
   - Comprehensive test for payment status update functionality
   - Tests both RLS policy and backend controller
   - Verifies client API and service role updates
   - Run with: `npm run test-payment-status` or `./test-payment-status.sh` or `test-payment-status.bat`

2. **test-payment-status-update.js**
   - Tests the service role's ability to update payment_status
   - Useful for verifying RLS policy fixes
   - Run with: `npm run test-payment-status-update` or `node test-payment-status-update.js [shipment_id]`

3. **test-payment-webhook-handler.js**
   - Tests the Stripe webhook handler functionality
   - Simulates payment success and failure events
   - Run with: `npm run test-payment-webhook`

## Authentication Testing

1. **auth-helper.js**
   - Helper script to create test users and obtain authentication tokens
   - Automatically creates a test driver user if needed
   - Provides tokens for testing protected endpoints

2. **test-api-with-auth.js**
   - Comprehensive testing script that handles authentication automatically
   - Tests health endpoints, obtains auth tokens, and tests protected endpoints
   - Provides detailed error messages and troubleshooting tips

3. **test-api-auth.bat** (Windows)
   - One-click solution for complete API testing with authentication
   - Handles environment setup, dependency installation, and server startup
   - Comprehensive error handling and user guidance

4. **test-api-auth.ps1** (PowerShell)
   - Advanced PowerShell version with better error handling
   - Interactive prompts for server startup
   - Detailed status reporting

## Authentication Requirements

The DriveDrop API uses Supabase authentication with the following requirements:

- **Bearer Token**: All protected endpoints require a valid JWT token from Supabase
- **User Role**: The `/api/v1/drivers/applications` endpoint requires a user with 'driver' role
- **Token Format**: `Authorization: Bearer <jwt_token>`

### Quick Start (Windows - Recommended)

**Option 1: Batch file (easiest)**
```batch
test-api-auth.bat
```

**Option 2: PowerShell (more detailed)**
```powershell
powershell -ExecutionPolicy Bypass -File test-api-auth.ps1
```

**Option 3: Node.js directly**
```bash
node test-api-with-auth.js
```

### Manual Authentication Setup

1. **Set up environment variables** in `.env`:
```env
API_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TEST_TOKEN=your-jwt-token-here
```

2. **Get a test token**:
```bash
node auth-helper.js
```

3. **Test with authentication**:
```bash
node test-api-with-auth.js
```

### API Testing

1. **test-api-endpoint.js**
   - Tests the driver applications API endpoint
   - Basic version for Node.js 18+ or with node-fetch v2

2. **test-api-robust.js**
   - Enhanced version that works across different Node.js versions
   - Fallbacks to different HTTP clients based on availability

3. **check-driver-api.js** (in backend/scripts)
   - Checks the configuration of the driver API endpoints

## Health Endpoints

The backend now provides health endpoints at:
- `GET /health` - Basic health check
- `GET /api/health` - Same as above, but under the API path (for consistency with testing scripts)
- `GET /health/db` - Database connectivity check

All health endpoints return JSON responses with status information.

## Setup and Running

### Quick Start (Windows)

**Option 1: Batch file (easiest)**
```
test-health.bat
```

**Option 2: PowerShell (recommended)**
```
powershell -ExecutionPolicy Bypass -File test-health.ps1
```

**Option 3: Simple curl test**
```
powershell -ExecutionPolicy Bypass -File test-health-curl.ps1
```

### Manual Setup

1. Install dependencies:
```
npm install
```

2. Create a `.env` file with:
```
API_URL=http://localhost:3000
TEST_TOKEN=your_jwt_token_here
```

3. Run a test:
```
node test-health-only.js
node test-api-robust.js
```

## Troubleshooting

### "fetch is not a function" Error

This occurs on older Node.js versions (pre-18) with node-fetch v3. Fix by:

1. Installing node-fetch v2:
```
npm install node-fetch@2
```

2. Use the robust version of the script:
```
node test-api-robust.js
```

### Connection Refused

If you see a "Connection refused" error:
1. Make sure your backend server is running
2. Check that API_URL in the .env file is correct
3. Verify that the server is listening on the expected port

### Authentication Errors

If you see 401/403 errors:
1. Make sure TEST_TOKEN in .env is valid and not expired
2. Verify that the token has the correct permissions
3. Check that your authentication middleware is working correctly

## Fixing the Driver Applications API

If the tests are failing:

1. Ensure SQL migrations have been applied, especially `08_add_picked_up_status.sql`
2. Check that backend environment variables are correctly set
3. Verify that the database function `get_driver_applications` exists
4. Ensure the API route is properly defined in `driver.routes.ts`
5. Check that the controller function in `application.controller.ts` is working

## Running Payment Status Tests

The payment status tests verify that both the RLS policies and the backend controller allow proper updating of shipment payment statuses.

### Setup for Payment Status Tests

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   TEST_USER_EMAIL=client@example.com
   TEST_USER_PASSWORD=password123
   ```

3. Install the required dependencies:
   ```bash
   npm install
   ```

### Running the Comprehensive Test

This test verifies both client API updates and service role updates:

**On Windows:**
```bash
test-payment-status.bat
```

**On Linux/macOS:**
```bash
./test-payment-status.sh
```

**Using npm:**
```bash
npm run test-payment-status
```

### Running the Service Role Test

This test verifies that the service role can update payment_status (for webhooks):

```bash
node test-payment-status-update.js [optional-shipment-id]
```

### Troubleshooting Payment Tests

If you encounter issues:

1. **API Connection Errors**:
   - Ensure your backend API is running on the correct port
   - Check the API_URL value in your .env file

2. **Authentication Errors**:
   - Verify that TEST_USER_EMAIL and TEST_USER_PASSWORD are correct
   - Check that the user exists in your database

3. **Service Role Permission Errors**:
   - Verify that the RLS policy for service role has been applied
   - Make sure SUPABASE_SERVICE_ROLE_KEY is correct

4. **Client Update Errors**:
   - Check that payment_status is included in allowedFields in shipment.controller.ts
   - Verify client authentication is working properly

```
