@echo off
REM test-api-auth.bat - Comprehensive API testing with authentication

echo DriveDrop API Testing with Authentication
echo ==========================================
echo.

echo Step 1: Checking environment...
if not exist ".env" (
  echo ⚠️  No .env file found. Creating from example...
  if exist ".env.example" (
    copy ".env.example" ".env"
    echo ✅ Created .env file from example
    echo ⚠️  Please edit .env file with your Supabase credentials and re-run this script
    echo.
    echo Required variables:
    echo - SUPABASE_URL
    echo - SUPABASE_ANON_KEY
    echo.
    pause
    exit /b 1
  ) else (
    echo ❌ No .env.example found either!
    pause
    exit /b 1
  )
)

echo ✅ Environment file exists
echo.

echo Step 2: Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo ❌ Failed to install dependencies
  pause
  exit /b 1
)
echo ✅ Dependencies installed
echo.

echo Step 3: Checking if backend is running...
echo.
call node test-health-only.js > temp_health.log 2>&1

findstr /C:"✅ Success!" temp_health.log >nul
if %ERRORLEVEL% EQ 0 (
  echo ✅ Backend server is running
) else (
  echo ❌ Backend server is not responding
  echo.
  echo Would you like to start the backend server? (y/n)
  set /p start_backend=
  if /i "%start_backend%"=="y" (
    echo Starting backend server...
    cd /d %~dp0..\backend
    start "DriveDrop Backend" /MIN cmd /c "npm run dev"
    cd /d %~dp0
    echo Waiting for server to start (15 seconds)...
    timeout /t 15 /nobreak
  ) else (
    echo Please start the backend server manually and re-run this script
    del temp_health.log
    pause
    exit /b 1
  )
)

del temp_health.log 2>nul
echo.

echo Step 4: Running comprehensive API tests with authentication...
echo.
call node test-api-with-auth.js

if %ERRORLEVEL% EQ 0 (
  echo.
  echo 🎉 All tests completed successfully!
  echo.
  echo Next steps:
  echo 1. Your API endpoints are working correctly
  echo 2. Authentication is properly configured
  echo 3. You can now test the mobile app with confidence
) else (
  echo.
  echo ❌ Some tests failed. Please check the output above.
  echo.
  echo Common issues:
  echo - Missing or incorrect Supabase configuration
  echo - Backend server not running
  echo - Database connection issues
  echo - User permissions not set correctly
)

echo.
pause
