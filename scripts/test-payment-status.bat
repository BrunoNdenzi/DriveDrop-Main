@echo off
echo Testing Payment Status Updates

REM Set environment variables
set API_URL=http://localhost:3000
set TEST_USER_EMAIL=client@example.com
set TEST_USER_PASSWORD=password123

REM Check if we're in the right directory (should be in scripts/)
if not exist test-payment-status.js (
  echo Error: test-payment-status.js not found in current directory.
  echo Please run this script from the scripts directory.
  exit /b 1
)

REM Check for .env file
if not exist .env (
  echo Warning: .env file not found. Looking for .env in parent directory...
  if exist ..\.env (
    echo Found .env in parent directory, copying it...
    copy ..\.env .env > nul
  ) else (
    echo No .env file found. Make sure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY are set.
  )
)

REM Get Supabase environment variables from .env file if it exists
if exist .env (
  echo Loading environment variables from .env file...
  for /F "tokens=*" %%i in (.env) do set %%i
)

REM Check for required dependencies
echo Checking for required npm packages...
call npm list node-fetch dotenv @supabase/supabase-js --depth=0 > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Installing required packages...
  call npm install node-fetch dotenv @supabase/supabase-js --no-save > nul
)

REM Execute test
echo Running payment status update test...
node test-payment-status.js

if %ERRORLEVEL% neq 0 (
  echo Test failed with error code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
) else (
  echo Test completed successfully!
)

echo Test complete