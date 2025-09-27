@echo off
echo Testing Payment Status Updates

REM Set environment variables
set API_URL=http://localhost:3000
set TEST_USER_EMAIL=client@example.com
set TEST_USER_PASSWORD=password123

REM Get Supabase environment variables from .env file if it exists
if exist .env (
  for /F "tokens=*" %%i in (.env) do set %%i
)

REM Execute test
echo Running payment status update test...
node test-payment-status.js

echo Test complete