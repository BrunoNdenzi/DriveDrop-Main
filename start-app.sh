#!/bin/bash

echo "Starting DriveDrop application..."

echo
echo "[1/3] Starting backend server..."
cd backend
npm run setup &
BACKEND_PID=$!

echo
echo "[2/3] Waiting for backend to initialize..."
sleep 5

echo
echo "[3/3] Starting mobile app..."
cd ../mobile
npm start &
MOBILE_PID=$!

echo
echo "DriveDrop is now running!"
echo "- Backend: http://localhost:3000"
echo "- Mobile: Expo DevTools"
echo
echo "Admin user credentials:"
echo "- Email: brunondenzi80@gmail.com"
echo "- Password: admin123"
echo

# Wait for either process to exit
wait $BACKEND_PID $MOBILE_PID
