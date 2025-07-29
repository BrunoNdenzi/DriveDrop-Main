@echo off
REM start-and-test-backend.bat
REM Script to start the backend server and test the connection

echo Starting the backend server...
start "DriveDrop Backend" /MIN cmd /c "cd /d %~dp0..\backend && npm run dev"

echo Waiting for the server to start (10 seconds)...
timeout /t 10 /nobreak

echo Testing the API connection...
node "%~dp0scripts\test-api-endpoint.js"

echo.
echo If the test was successful, you should see a valid JSON response above.
echo If you see a connection error, make sure the backend server is running correctly.
echo.
echo The backend server is still running in the background.
echo To stop it, close the "DriveDrop Backend" command window.

pause
