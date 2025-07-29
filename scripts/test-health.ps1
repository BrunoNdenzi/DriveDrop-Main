# test-health.ps1 - PowerShell script to test health endpoints

Write-Host "DriveDrop Health Endpoint Test" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Function to test if a URL is reachable
function Test-HealthEndpoint {
    param($Url)
    try {
        $null = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 5
        return $true
    }
    catch {
        return $false
    }
}

# Function to start backend server
function Start-BackendServer {
    Write-Host "Starting backend server..." -ForegroundColor Yellow
    
    # Check if backend directory exists
    $backendPath = Join-Path $PSScriptRoot "..\backend"
    if (-not (Test-Path $backendPath)) {
        Write-Host "ERROR: Backend directory not found at $backendPath" -ForegroundColor Red
        return $false
    }
    
    # Change to backend directory
    Push-Location $backendPath
    
    try {
        # Install dependencies if node_modules doesn't exist
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
                return $false
            }
        }
        
        # Create .env file if it doesn't exist
        if (-not (Test-Path ".env")) {
            Write-Host "Creating .env file..." -ForegroundColor Yellow
            if (Test-Path ".env.example") {
                Copy-Item ".env.example" ".env"
                Write-Host "Created .env from .env.example. Please edit with your values." -ForegroundColor Yellow
            } else {
                @"
PORT=3000
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
                Write-Host "Created basic .env file." -ForegroundColor Yellow
            }
        }
        
        # Start the server in background
        Write-Host "Starting server with npm run dev..." -ForegroundColor Green
        Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev" -WindowStyle Minimized
        
        # Wait for server to start
        Write-Host "Waiting for server to start (15 seconds)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        return $true
    }
    finally {
        Pop-Location
    }
}

# Function to test health endpoints using Node.js
function Test-HealthEndpointsWithNode {
    Write-Host "Testing health endpoints with Node.js..." -ForegroundColor Green
    
    # Change to scripts directory
    Push-Location $PSScriptRoot
    
    try {
        # Install script dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing script dependencies..." -ForegroundColor Yellow
            npm install
        }
        
        # Run the health test
        node "test-health-only.js"
    }
    finally {
        Pop-Location
    }
}

# Main execution
Write-Host "Step 1: Checking if backend server is already running..." -ForegroundColor Cyan

# Test common health endpoints
$baseUrl = $env:API_URL
if (-not $baseUrl) {
    $baseUrl = "http://localhost:3000"
}

$healthEndpoints = @(
    "$baseUrl/health",
    "$baseUrl/api/health"
)

$serverRunning = $false
foreach ($endpoint in $healthEndpoints) {
    Write-Host "Testing: $endpoint" -ForegroundColor Gray
    if (Test-HealthEndpoint $endpoint) {
        Write-Host "✅ Server is running and responding at $endpoint" -ForegroundColor Green
        $serverRunning = $true
        break
    }
}

if (-not $serverRunning) {
    Write-Host "❌ Backend server is not responding. Starting it now..." -ForegroundColor Red
    Write-Host ""
    
    if (-not (Start-BackendServer)) {
        Write-Host "❌ Failed to start backend server" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Running comprehensive health tests..." -ForegroundColor Cyan
Test-HealthEndpointsWithNode

Write-Host ""
Write-Host "Step 3: Testing full API endpoints..." -ForegroundColor Cyan
Push-Location $PSScriptRoot
try {
    node "test-api-endpoint.js"
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "✅ Health endpoint testing completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "- Health endpoints should now be available at both /health and /api/health"
Write-Host "- Use 'Get-Process node' to see running Node.js processes"
Write-Host "- Use 'Stop-Process -Name node' to stop the backend server if needed"
Write-Host ""
