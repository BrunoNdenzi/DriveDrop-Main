@echo off
REM test-health.bat - Script to start backend and test health endpoints

echo DriveDrop Health Endpoint Test
echo ===============================
echo.

echo Step 1: Checking if backend server is running...
echo Testing existing connection...
cd /d %~dp0
call node test-health-only.js > temp_health_test.log 2>&1

REM Check if health endpoint responded
findstr /C:"✅ Success!" temp_health_test.log >nul
if %ERRORLEVEL% EQ 0 (
  echo ✅ Backend server is already running and responding!
  type temp_health_test.log
  del temp_health_test.log
  goto :end
)

echo ❌ Backend server is not responding. Starting it now...
echo.

echo Step 2: Starting backend server...
echo Checking if backend directory exists...
if not exist "..\backend" (
  echo ERROR: Backend directory not found!
  echo Make sure you're running this script from the scripts directory.
  goto :error
)

echo Installing backend dependencies if needed...
cd /d %~dp0..\backend
if not exist "node_modules" (
  echo Installing backend dependencies...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install backend dependencies.
    goto :error
  )
)

echo.
echo Creating .env file if it doesn't exist...
if not exist ".env" (
  echo Creating default .env file...
  if exist ".env.example" (
    copy ".env.example" ".env"
    echo ⚠️  Created .env file from .env.example. Please edit it with your values.
  ) else (
    echo PORT=3000 > .env
    echo NODE_ENV=development >> .env
    echo ⚠️  Created basic .env file. You may need to add Supabase configuration.
  )
)

echo.
echo Starting backend server in background...
start "DriveDrop Backend" /MIN cmd /c "npm run dev"

echo Waiting for server to start (15 seconds)...
timeout /t 15 /nobreak

echo.
echo Step 3: Testing health endpoints...
cd /d %~dp0
call node test-health-only.js

echo.
echo Step 4: Testing full API...
call node test-api-endpoint.js

goto :end

:error
echo.
echo ❌ An error occurred. Please check the above messages.
echo.
goto :end

:end
if exist temp_health_test.log del temp_health_test.log
echo.
echo Test completed.
echo.
echo To stop the backend server, look for the "DriveDrop Backend" window and close it.
echo Or use Task Manager to end the Node.js process.
echo.
pause
