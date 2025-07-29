# test-api-auth.ps1 - PowerShell version of the authentication test script

Write-Host "DriveDrop API Testing with Authentication" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if .env file exists and has required variables
function Test-EnvironmentConfiguration {
    if (-not (Test-Path ".env")) {
        Write-Host "⚠️ No .env file found" -ForegroundColor Yellow
        
        if (Test-Path ".env.example") {
            Write-Host "Creating .env file from example..." -ForegroundColor Yellow
            Copy-Item ".env.example" ".env"
            Write-Host "✅ Created .env file from example" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️ Please edit .env file with your Supabase credentials:" -ForegroundColor Yellow
            Write-Host "- SUPABASE_URL" -ForegroundColor White
            Write-Host "- SUPABASE_ANON_KEY" -ForegroundColor White
            Write-Host ""
            Write-Host "Then re-run this script." -ForegroundColor Yellow
            return $false
        } else {
            Write-Host "❌ No .env.example found!" -ForegroundColor Red
            return $false
        }
    }
    
    # Check if required variables are in .env
    $envContent = Get-Content ".env" -Raw
    $hasSupabaseUrl = $envContent -match "SUPABASE_URL="
    $hasSupabaseKey = $envContent -match "SUPABASE_ANON_KEY="
    
    if (-not $hasSupabaseUrl -or -not $hasSupabaseKey) {
        Write-Host "⚠️ Missing required Supabase configuration in .env file" -ForegroundColor Yellow
        Write-Host "Please ensure these variables are set:" -ForegroundColor Yellow
        Write-Host "- SUPABASE_URL=https://your-project.supabase.co" -ForegroundColor White
        Write-Host "- SUPABASE_ANON_KEY=your-anon-key" -ForegroundColor White
        return $false
    }
    
    Write-Host "✅ Environment configuration looks good" -ForegroundColor Green
    return $true
}

# Function to install dependencies
function Install-Dependencies {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    
    try {
        $null = npm install 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error installing dependencies: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to check if backend is running
function Test-BackendHealth {
    Write-Host "Checking if backend server is running..." -ForegroundColor Yellow
    
    try {
        $healthResult = node "test-health-only.js" 2>&1
        
        if ($healthResult -match "✅ Success!") {
            Write-Host "✅ Backend server is running and healthy" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Backend server is not responding properly" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Could not check backend health: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to start backend server
function Start-BackendServer {
    $response = Read-Host "Would you like to start the backend server? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Starting backend server..." -ForegroundColor Yellow
        
        $backendPath = Join-Path $PSScriptRoot "..\backend"
        
        if (Test-Path $backendPath) {
            Push-Location $backendPath
            try {
                Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev" -WindowStyle Minimized
                Write-Host "Backend server started in background window" -ForegroundColor Green
                Write-Host "Waiting for server to initialize (15 seconds)..." -ForegroundColor Yellow
                Start-Sleep -Seconds 15
                return $true
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "❌ Backend directory not found at $backendPath" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "Please start the backend server manually and re-run this script" -ForegroundColor Yellow
        return $false
    }
}

# Function to run the authentication tests
function Invoke-AuthenticationTests {
    Write-Host "Running comprehensive API tests with authentication..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        node "test-api-with-auth.js"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "🎉 All tests completed successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next steps:" -ForegroundColor Cyan
            Write-Host "1. Your API endpoints are working correctly" -ForegroundColor White
            Write-Host "2. Authentication is properly configured" -ForegroundColor White
            Write-Host "3. You can now test the mobile app with confidence" -ForegroundColor White
            return $true
        } else {
            Write-Host ""
            Write-Host "❌ Some tests failed. Please check the output above." -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error running tests: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main execution
try {
    # Change to script directory
    Push-Location $PSScriptRoot
    
    Write-Host "Step 1: Checking environment configuration..." -ForegroundColor Cyan
    if (-not (Test-EnvironmentConfiguration)) {
        exit 1
    }
    Write-Host ""
    
    Write-Host "Step 2: Installing dependencies..." -ForegroundColor Cyan
    if (-not (Install-Dependencies)) {
        exit 1
    }
    Write-Host ""
    
    Write-Host "Step 3: Checking backend server status..." -ForegroundColor Cyan
    if (-not (Test-BackendHealth)) {
        Write-Host ""
        if (-not (Start-BackendServer)) {
            exit 1
        }
        Write-Host ""
        
        # Check again after starting
        if (-not (Test-BackendHealth)) {
            Write-Host "❌ Backend server still not responding after startup attempt" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host ""
    
    Write-Host "Step 4: Running authentication tests..." -ForegroundColor Cyan
    if (-not (Invoke-AuthenticationTests)) {
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Yellow
        Write-Host "- Missing or incorrect Supabase configuration" -ForegroundColor White
        Write-Host "- Backend server not running properly" -ForegroundColor White
        Write-Host "- Database connection issues" -ForegroundColor White
        Write-Host "- User permissions not set correctly" -ForegroundColor White
        exit 1
    }
    
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Testing completed. Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
