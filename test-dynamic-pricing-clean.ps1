# Dynamic Pricing Test Script - PowerShell Version
# Tests the dynamic pricing API endpoints

param(
    [string]$ApiUrl = "",
    [string]$AdminEmail = "",
    [string]$AdminPassword = ""
)

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  Dynamic Pricing Configuration - Test Suite" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Get API URL if not provided
if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = Read-Host "Enter your Railway API URL"
    if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
        Write-Host "[ERROR] API URL is required!" -ForegroundColor Red
        exit 1
    }
}

# Get admin credentials if not provided
if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
    Write-Host "`nAdmin Login" -ForegroundColor Yellow
    $AdminEmail = Read-Host "Enter admin email"
}

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
    $SecurePassword = Read-Host "Enter admin password" -AsSecureString
    $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword))
}

Write-Host "`nLogging in as admin..." -ForegroundColor Yellow

# Login to get admin token
$loginBody = @{
    email = $AdminEmail
    password = $AdminPassword
} | ConvertTo-Json

$baseUrl = $ApiUrl -replace '/api/v1$', ''
$authUrl = "$baseUrl/api/v1/auth/login"

try {
    $loginResponse = Invoke-RestMethod -Uri $authUrl `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    if ($loginResponse.success -and ($loginResponse.data.token -or $loginResponse.data.accessToken)) {
        # Handle both token formats
        $adminToken = if ($loginResponse.data.token) { $loginResponse.data.token } else { $loginResponse.data.accessToken }
        
        Write-Host "[SUCCESS] Login successful!" -ForegroundColor Green
        
        # Try to get user info from response or make a separate call
        if ($loginResponse.data.user) {
            Write-Host "User: $($loginResponse.data.user.email)" -ForegroundColor Gray
            Write-Host "Role: $($loginResponse.data.user.role)" -ForegroundColor Gray
            
            if ($loginResponse.data.user.role -ne "admin") {
                Write-Host "`n[WARNING] User role is not 'admin'. Tests may fail." -ForegroundColor Yellow
                $continue = Read-Host "Continue anyway? (y/n)"
                if ($continue -ne "y") { exit 1 }
            }
        } else {
            Write-Host "Token received successfully" -ForegroundColor Gray
        }
    } else {
        Write-Host "[ERROR] Login failed: Invalid response" -ForegroundColor Red
        Write-Host "Response: $($loginResponse | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "[ERROR] Login failed" -ForegroundColor Red
    Write-Host "URL: $authUrl" -ForegroundColor Gray
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "Starting Tests..." -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

$testsPassed = 0
$testsFailed = 0
$configId = $null
$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Test 1: Get Active Configuration
Write-Host "Test 1: Get Active Pricing Configuration" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

try {
    $config = Invoke-RestMethod -Uri "$ApiUrl/admin/pricing/config" `
        -Method Get `
        -Headers $headers
    
    if ($config.success -and $config.data) {
        Write-Host "[SUCCESS] Active configuration retrieved" -ForegroundColor Green
        Write-Host "  Config ID: $($config.data.id)" -ForegroundColor Gray
        Write-Host "  Min Quote: `$$($config.data.min_quote)" -ForegroundColor Gray
        Write-Host "  Current Fuel Price: `$$($config.data.current_fuel_price)/gal" -ForegroundColor Gray
        Write-Host "  Surge Enabled: $($config.data.surge_enabled)" -ForegroundColor Gray
        Write-Host "  Surge Multiplier: $($config.data.surge_multiplier)" -ForegroundColor Gray
        $configId = $config.data.id
        $testsPassed++
    } else {
        Write-Host "[FAILED] Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 1

# Test 2: Update Configuration
if ($configId) {
    Write-Host "`nTest 2: Update Pricing Configuration" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    try {
        $updateBody = @{
            change_reason = "Automated test update"
            current_fuel_price = 4.25
            surge_enabled = $true
            surge_multiplier = 1.15
        } | ConvertTo-Json
        
        $updateResponse = Invoke-RestMethod -Uri "$ApiUrl/admin/pricing/config/$configId" `
            -Method Put `
            -Headers $headers `
            -Body $updateBody
        
        if ($updateResponse.success -and $updateResponse.data) {
            Write-Host "[SUCCESS] Configuration updated" -ForegroundColor Green
            Write-Host "  New Fuel Price: `$$($updateResponse.data.current_fuel_price)/gal" -ForegroundColor Gray
            Write-Host "  Surge Enabled: $($updateResponse.data.surge_enabled)" -ForegroundColor Gray
            Write-Host "  Surge Multiplier: $($updateResponse.data.surge_multiplier)" -ForegroundColor Gray
            $testsPassed++
        } else {
            Write-Host "[FAILED] Invalid response" -ForegroundColor Red
            $testsFailed++
        }
    } catch {
        Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    
    Start-Sleep -Seconds 1
}

# Test 3: Get Quote with Dynamic Pricing
Write-Host "`nTest 3: Calculate Quote with Dynamic Pricing" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

try {
    $quoteBody = @{
        vehicle_type = "sedan"
        distance_miles = 250
        pickup_date = "2025-02-01"
        delivery_date = "2025-02-05"
        is_accident_recovery = $false
        vehicle_count = 1
        use_dynamic_config = $true
    } | ConvertTo-Json
    
    $quoteResponse = Invoke-RestMethod -Uri "$ApiUrl/pricing/quote" `
        -Method Post `
        -Headers $headers `
        -Body $quoteBody
    
    if ($quoteResponse.success -and $quoteResponse.data) {
        Write-Host "[SUCCESS] Quote calculated with dynamic pricing" -ForegroundColor Green
        Write-Host "  Total Price: `$$($quoteResponse.data.total)" -ForegroundColor Gray
        Write-Host "  Fuel Price Used: `$$($quoteResponse.data.breakdown.fuelPricePerGallon)/gal" -ForegroundColor Gray
        Write-Host "  Surge Multiplier: $($quoteResponse.data.breakdown.surgeMultiplier)" -ForegroundColor Gray
        Write-Host "  Delivery Type: $($quoteResponse.data.breakdown.deliveryType)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "[FAILED] Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 1

# Test 4: Get Change History
if ($configId) {
    Write-Host "`nTest 4: Get Configuration Change History" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    try {
        $historyResponse = Invoke-RestMethod -Uri "$ApiUrl/admin/pricing/config/$configId/history?limit=5" `
            -Method Get `
            -Headers $headers
        
        if ($historyResponse.success) {
            Write-Host "[SUCCESS] History retrieved" -ForegroundColor Green
            Write-Host "  Number of entries: $($historyResponse.data.Count)" -ForegroundColor Gray
            
            if ($historyResponse.data.Count -gt 0) {
                $latest = $historyResponse.data[0]
                Write-Host "`n  Most Recent Change:" -ForegroundColor Cyan
                Write-Host "    Reason: $($latest.change_reason)" -ForegroundColor Gray
                Write-Host "    Changed Fields: $($latest.changed_fields -join ', ')" -ForegroundColor Gray
                Write-Host "    Changed At: $($latest.changed_at)" -ForegroundColor Gray
            }
            $testsPassed++
        } else {
            Write-Host "[FAILED] Invalid response" -ForegroundColor Red
            $testsFailed++
        }
    } catch {
        Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    
    Start-Sleep -Seconds 1
}

# Test 5: Clear Cache
Write-Host "`nTest 5: Clear Pricing Cache" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------" -ForegroundColor Gray

try {
    $cacheResponse = Invoke-RestMethod -Uri "$ApiUrl/admin/pricing/cache/clear" `
        -Method Post `
        -Headers $headers
    
    if ($cacheResponse.success -and $cacheResponse.data) {
        Write-Host "[SUCCESS] Cache cleared" -ForegroundColor Green
        Write-Host "  Timestamp: $($cacheResponse.data.timestamp)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "[FAILED] Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "[FAILED] $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Summary
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$totalTests = $testsPassed + $testsFailed
Write-Host "`nTests Passed: " -NoNewline
Write-Host "$testsPassed/$totalTests" -ForegroundColor Green

if ($testsFailed -gt 0) {
    Write-Host "Tests Failed: " -NoNewline
    Write-Host "$testsFailed/$totalTests" -ForegroundColor Red
}

if ($testsPassed -eq $totalTests) {
    Write-Host "`n[SUCCESS] All tests passed! Dynamic pricing system is working." -ForegroundColor Green
    Write-Host "`nReady to proceed with Mobile Admin UI implementation." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "`n[WARNING] Some tests failed. Please review the errors above." -ForegroundColor Yellow
    exit 1
}
