@echo off
echo Starting DriveDrop application...

echo.
echo [1/3] Starting backend server...
cd backend
start cmd /k "npm run setup"

echo.
echo [2/3] Waiting for backend to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [3/3] Starting mobile app...
cd ../mobile
start cmd /k "npm start"

echo.
echo DriveDrop is now running!
echo - Backend: http://localhost:3000
echo - Mobile: Expo DevTools
echo.
echo Admin user credentials:
echo - Email: brunondenzi80@gmail.com
echo - Password: admin123
echo.
