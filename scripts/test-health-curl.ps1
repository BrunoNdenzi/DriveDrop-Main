# test-health-curl.ps1 - Simple PowerShell script using curl to test health endpoints

Write-Host "DriveDrop Health Endpoint Test (using curl)" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = $env:API_URL
if (-not $baseUrl) {
    $baseUrl = "http://localhost:3000"
}

$endpoints = @(
    "$baseUrl/health",
    "$baseUrl/api/health", 
    "$baseUrl/health/db"
)

Write-Host "Testing server at: $baseUrl" -ForegroundColor Yellow
Write-Host ""

foreach ($endpoint in $endpoints) {
    Write-Host "Testing: $endpoint" -ForegroundColor White
    
    try {
        # Use curl to test the endpoint
        $result = curl.exe -s -w "%{http_code}" -o temp_response.json $endpoint 2>$null
        $httpCode = $result
        
        if ($httpCode -eq "200") {
            Write-Host "  ✅ Status: $httpCode (Success)" -ForegroundColor Green
            
            if (Test-Path "temp_response.json") {
                $content = Get-Content "temp_response.json" -Raw
                if ($content -and $content.Trim() -ne "") {
                    try {
                        $json = $content | ConvertFrom-Json
                        Write-Host "  Response:" -ForegroundColor Gray
                        Write-Host "    $($json | ConvertTo-Json -Compress)" -ForegroundColor Gray
                    }
                    catch {
                        Write-Host "  Response: $content" -ForegroundColor Gray
                    }
                }
                Remove-Item "temp_response.json" -ErrorAction SilentlyContinue
            }
        }
        elseif ($httpCode -eq "000") {
            Write-Host "  ❌ Connection failed (server may be down)" -ForegroundColor Red
        }
        else {
            Write-Host "  ❌ Status: $httpCode (Failed)" -ForegroundColor Red
            if (Test-Path "temp_response.json") {
                $content = Get-Content "temp_response.json" -Raw
                if ($content) {
                    Write-Host "  Error: $content" -ForegroundColor Red
                }
                Remove-Item "temp_response.json" -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

# Clean up any remaining temp files
Remove-Item "temp_response.json" -ErrorAction SilentlyContinue

Write-Host "Health endpoint testing complete." -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "- If all tests failed, start the backend with: cd backend && npm run dev"
Write-Host "- If only /api/health failed, the route mounting may need fixing"
Write-Host "- If /health/db failed, check your Supabase configuration"
Write-Host ""
