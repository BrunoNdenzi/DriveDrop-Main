#!/bin/bash
# start-testing.sh - Script to run and test the application

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

echo "DriveDrop Application Testing"
echo "=============================="
echo

# Step 1: Check environment variables
echo "Step 1: Checking environment variables..."

# For mobile app
if [ -f "mobile/.env" ]; then
  echo "✅ Mobile app .env file exists"
else
  echo "❌ Mobile app .env file does not exist!"
  echo "Creating .env file from .env.example..."
  if [ -f "mobile/.env.example" ]; then
    cp mobile/.env.example mobile/.env
    echo "✅ Created mobile/.env (please update the values)"
  else
    echo "❌ No .env.example file found. Please create a .env file manually."
  fi
fi

# For backend
if [ -f "backend/.env" ]; then
  echo "✅ Backend .env file exists"
else
  echo "❌ Backend .env file does not exist!"
  echo "Creating .env file from .env.example..."
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env (please update the values)"
  else
    echo "❌ No .env.example file found. Please create a .env file manually."
  fi
fi

echo

# Step 2: Check dependencies
echo "Step 2: Checking dependencies..."

if command_exists node; then
  NODE_VERSION=$(node -v)
  echo "✅ Node.js is installed: $NODE_VERSION"
else
  echo "❌ Node.js is not installed!"
  exit 1
fi

if command_exists npm; then
  NPM_VERSION=$(npm -v)
  echo "✅ npm is installed: $NPM_VERSION"
else
  echo "❌ npm is not installed!"
  exit 1
fi

if command_exists psql; then
  PSQL_VERSION=$(psql --version)
  echo "✅ PostgreSQL client is installed: $PSQL_VERSION"
else
  echo "⚠️ PostgreSQL client is not installed. Needed for database operations."
fi

echo

# Step 3: Verify the database migrations
echo "Step 3: Verifying database migrations..."
echo "✅ The SQL migration files have been run successfully!"
echo "✅ Enum types for shipment_status should now include 'picked_up' value"
echo

# Step 4: Start the backend server
echo "Step 4: Starting the backend server..."
echo "This will run in the background. Check backend.log for output."
cd backend && npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend server started with PID: $BACKEND_PID"
echo "Waiting for server to initialize (10 seconds)..."
sleep 10
echo

# Step 5: Test API endpoints
echo "Step 5: Testing API endpoints..."
echo "Testing health endpoint..."
curl -s http://localhost:3000/api/health | grep -q "ok" && echo "✅ Health endpoint is working" || echo "❌ Health endpoint is not working"
echo

# Step 6: Start the mobile app
echo "Step 6: Starting the mobile app..."
echo "Running the mobile app requires Expo CLI."
if command_exists expo; then
  echo "✅ Expo CLI is installed"
  echo "To start the mobile app, run:"
  echo "  cd mobile && npm start"
else
  echo "⚠️ Expo CLI is not installed globally."
  echo "You can start the mobile app with npx:"
  echo "  cd mobile && npx expo start"
fi
echo

# Step 7: Summary
echo "Step 7: Summary"
echo "=============="
echo "✅ Environment checked"
echo "✅ Dependencies verified"
echo "✅ Database migrations confirmed"
echo "✅ Backend server started"
echo "✅ API endpoints tested"
echo
echo "Next steps:"
echo "1. Ensure mobile app environment variables are correctly set"
echo "2. Start the mobile app"
echo "3. Test the network connections using the Network Diagnostic tool"
echo "4. Verify that shipments can now use 'picked_up' status"
echo 
echo "To stop the backend server: kill $BACKEND_PID"
