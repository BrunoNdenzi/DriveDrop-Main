# Dynamic Pricing Test Script
# Interactive PowerShell version for easy testing

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  Dynamic Pricing Configuration - Test Suite" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# Get API URL
$defaultUrl = "https://your-app.up.railway.app/api/v1"
$apiUrl = Read-Host "Enter your Railway API URL (example: https://your-app.up.railway.app/api/v1)"
if ([string]::IsNullOrWhiteSpace($apiUrl)) {
    Write-Host "⚠️  API URL is required!" -ForegroundColor Red
    exit
}

# Get admin credentials
Write-Host "`n📧 Admin Login" -ForegroundColor Yellow
$adminEmail = Read-Host "Enter admin email"
$adminPassword = Read-Host "Enter admin password" -AsSecureString
$adminPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassword))

Write-Host "`n🔐 Logging in as admin..." -ForegroundColor Yellow

# Login to get admin token
$loginBody = @{
    email = $adminEmail
    password = $adminPasswordPlain
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$($apiUrl -replace '/api/v1','')/api/v1/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    if ($loginResponse.success -and $loginResponse.data.token) {
        $adminToken = $loginResponse.data.token
        Write-Host "✅ Login successful!" -ForegroundColor Green
        Write-Host "User: $($loginResponse.data.user.email)" -ForegroundColor Gray
        Write-Host "Role: $($loginResponse.data.user.role)" -ForegroundColor Gray
        
        if ($loginResponse.data.user.role -ne "admin") {
            Write-Host "`n⚠️  WARNING: User role is not 'admin'. Tests may fail." -ForegroundColor Yellow
            $continue = Read-Host "Continue anyway? (y/n)"
            if ($continue -ne "y") { exit }
        }
    } else {
        Write-Host "❌ Login failed: Invalid response" -ForegroundColor Red
        Write-Host $loginResponse -ForegroundColor Gray
        exit
    }
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "Starting Tests..." -ForegroundColor Cyan
Write-Host ("=" * 60) + "`n" -ForegroundColor Cyan

$testsPassed = 0
$testsFailed = 0
$configId = $null

# Test 1: Get Active Configuration
Write-Host "Test 1: Get Active Pricing Configuration" -ForegroundColor Yellow
Write-Host ("-" * 60) -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $adminToken"
        "Content-Type" = "application/json"
    }
    
    $config = Invoke-RestMethod -Uri "$apiUrl/admin/pricing/config" `
        -Method Get `
        -Headers $headers
    
    if ($config.success -and $config.data) {
        Write-Host "✅ SUCCESS: Active configuration retrieved" -ForegroundColor Green
        Write-Host "  Config ID: $($config.data.id)" -ForegroundColor Gray
        Write-Host "  Min Quote: `$$($config.data.min_quote)" -ForegroundColor Gray
        Write-Host "  Current Fuel Price: `$$($config.data.current_fuel_price)/gal" -ForegroundColor Gray
        Write-Host "  Surge Enabled: $($config.data.surge_enabled)" -ForegroundColor Gray
        Write-Host "  Surge Multiplier: $($config.data.surge_multiplier)" -ForegroundColor Gray
        $configId = $config.data.id
        $testsPassed++
    } else {
        Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 1

# Test 2: Update Configuration
if ($configId) {
    Write-Host "`n🧪 Test 2: Update Pricing Configuration" -ForegroundColor Yellow
    Write-Host ("─" * 60) -ForegroundColor Gray
    
    try {
        $updateBody = @{
            change_reason = "Automated test update"
            current_fuel_price = 4.25
            surge_enabled = $true
            surge_multiplier = 1.15
        } | ConvertTo-Json
        
        $updateResponse = Invoke-RestMethod -Uri "$apiUrl/admin/pricing/config/$configId" `
            -Method Put `
            -Headers $headers `
            -Body $updateBody
        
        if ($updateResponse.success -and $updateResponse.data) {
            Write-Host "✅ SUCCESS: Configuration updated" -ForegroundColor Green
            Write-Host "  New Fuel Price: `$$($updateResponse.data.current_fuel_price)/gal" -ForegroundColor Gray
            Write-Host "  Surge Enabled: $($updateResponse.data.surge_enabled)" -ForegroundColor Gray
            Write-Host "  Surge Multiplier: $($updateResponse.data.surge_multiplier)" -ForegroundColor Gray
            $testsPassed++
        } else {
            Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
            $testsFailed++
        }
    } catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    
    Start-Sleep -Seconds 1
}

# Test 3: Get Quote with Dynamic Pricing
Write-Host "`n🧪 Test 3: Calculate Quote with Dynamic Pricing" -ForegroundColor Yellow
Write-Host ("─" * 60) -ForegroundColor Gray

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
    
    $quoteResponse = Invoke-RestMethod -Uri "$apiUrl/pricing/quote" `
        -Method Post `
        -Headers $headers `
        -Body $quoteBody
    
    if ($quoteResponse.success -and $quoteResponse.data) {
        Write-Host "✅ SUCCESS: Quote calculated with dynamic pricing" -ForegroundColor Green
        Write-Host "  Total Price: `$$($quoteResponse.data.total)" -ForegroundColor Gray
        Write-Host "  Fuel Price Used: `$$($quoteResponse.data.breakdown.fuelPricePerGallon)/gal" -ForegroundColor Gray
        Write-Host "  Surge Multiplier: $($quoteResponse.data.breakdown.surgeMultiplier)" -ForegroundColor Gray
        Write-Host "  Delivery Type: $($quoteResponse.data.breakdown.deliveryType)" -ForegroundColor Gray
        Write-Host "  Delivery Multiplier: $($quoteResponse.data.breakdown.deliveryTypeMultiplier)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 1

# Test 4: Get Change History
if ($configId) {
    Write-Host "`n🧪 Test 4: Get Configuration Change History" -ForegroundColor Yellow
    Write-Host ("─" * 60) -ForegroundColor Gray
    
    try {
        $historyResponse = Invoke-RestMethod -Uri "$apiUrl/admin/pricing/config/$configId/history?limit=5" `
            -Method Get `
            -Headers $headers
        
        if ($historyResponse.success) {
            Write-Host "✅ SUCCESS: History retrieved" -ForegroundColor Green
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
            Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
            $testsFailed++
        }
    } catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testsFailed++
    }
    
    Start-Sleep -Seconds 1
}

# Test 5: Clear Cache
Write-Host "`n🧪 Test 5: Clear Pricing Cache" -ForegroundColor Yellow
Write-Host ("─" * 60) -ForegroundColor Gray

try {
    $cacheResponse = Invoke-RestMethod -Uri "$apiUrl/admin/pricing/cache/clear" `
        -Method Post `
        -Headers $headers
    
    if ($cacheResponse.success -and $cacheResponse.data) {
        Write-Host "✅ SUCCESS: Cache cleared" -ForegroundColor Green
        Write-Host "  Timestamp: $($cacheResponse.data.timestamp)" -ForegroundColor Gray
        $testsPassed++
    } else {
        Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 1

# Test 6: Compare Static vs Dynamic Pricing
Write-Host "`n🧪 Test 6: Compare Static vs Dynamic Pricing" -ForegroundColor Yellow
Write-Host ("─" * 60) -ForegroundColor Gray

try {
    $compareBody = @{
        vehicle_type = "suv"
        distance_miles = 150
        is_accident_recovery = $false
        vehicle_count = 1
    }
    
    # Static pricing
    $staticBody = $compareBody.Clone()
    $staticBody["use_dynamic_config"] = $false
    $staticResponse = Invoke-RestMethod -Uri "$apiUrl/pricing/quote" `
        -Method Post `
        -Headers $headers `
        -Body ($staticBody | ConvertTo-Json)
    
    # Dynamic pricing
    $dynamicBody = $compareBody.Clone()
    $dynamicBody["use_dynamic_config"] = $true
    $dynamicResponse = Invoke-RestMethod -Uri "$apiUrl/pricing/quote" `
        -Method Post `
        -Headers $headers `
        -Body ($dynamicBody | ConvertTo-Json)
    
    if ($staticResponse.success -and $dynamicResponse.success) {
        Write-Host "✅ SUCCESS: Both calculations completed" -ForegroundColor Green
        
        Write-Host "`n  Static Pricing (Hardcoded):" -ForegroundColor Cyan
        Write-Host "    Total: `$$($staticResponse.data.total)" -ForegroundColor Gray
        Write-Host "    Fuel Price: `$$($staticResponse.data.breakdown.fuelPricePerGallon)/gal" -ForegroundColor Gray
        
        Write-Host "`n  Dynamic Pricing (Database Config):" -ForegroundColor Cyan
        Write-Host "    Total: `$$($dynamicResponse.data.total)" -ForegroundColor Gray
        Write-Host "    Fuel Price: `$$($dynamicResponse.data.breakdown.fuelPricePerGallon)/gal" -ForegroundColor Gray
        
        $difference = $dynamicResponse.data.total - $staticResponse.data.total
        $percentDiff = [math]::Round(($difference / $staticResponse.data.total) * 100, 2)
        
        Write-Host "`n  Difference: `$$([math]::Round($difference, 2)) ($percentDiff%)" -ForegroundColor Yellow
        $testsPassed++
    } else {
        Write-Host "❌ FAILED: Invalid response" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# Summary
Write-Host "`n" + ("═" * 60) -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host ("═" * 60) -ForegroundColor Cyan

$totalTests = $testsPassed + $testsFailed
Write-Host "`nTests Passed: " -NoNewline
Write-Host "$testsPassed/$totalTests" -ForegroundColor Green

if ($testsFailed -gt 0) {
    Write-Host "Tests Failed: " -NoNewline
    Write-Host "$testsFailed/$totalTests" -ForegroundColor Red
}

if ($testsPassed -eq $totalTests) {
    Write-Host "`n🎉 All tests passed! Dynamic pricing system is working correctly." -ForegroundColor Green
    Write-Host "`n✅ Ready to proceed with Mobile Admin UI implementation." -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  Some tests failed. Please review the errors above." -ForegroundColor Yellow
}

Write-Host ""
