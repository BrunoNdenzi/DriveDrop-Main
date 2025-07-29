@echo off
REM test-api.bat - Script to install dependencies and run the API tests

echo DriveDrop API Testing Script
echo ===========================
echo.

echo Step 1: Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Please install Node.js from https://nodejs.org/
  exit /b 1
)

echo Node.js is installed. Version:
node --version
echo.

echo Step 2: Installing dependencies...
cd /d %~dp0
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Failed to install dependencies.
  exit /b 1
)
echo Dependencies installed successfully.
echo.

echo Step 3: Creating .env file if it doesn't exist...
if not exist .env (
  echo Creating default .env file...
  echo API_URL=http://localhost:3000 > .env
  echo TEST_TOKEN=YOUR_TEST_TOKEN_HERE >> .env
  echo Created .env file with default settings. Please edit it with your values.
) else (
  echo .env file already exists. Using existing configuration.
)
echo.

echo Step 4: Running robust API test...
echo.
call node test-api-robust.js
echo.

echo Test completed.
echo If you encountered any errors, check:
echo 1. Is the backend server running?
echo 2. Is your .env file configured correctly?
echo 3. Have you updated the node-fetch version to v2?
echo.

pause
