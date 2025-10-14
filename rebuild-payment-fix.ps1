# Payment Fix - Rebuild Script (PowerShell)
# This script rebuilds the mobile app with the payment fixes

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   REBUILDING APP WITH PAYMENT FIX   " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fixes included:" -ForegroundColor Yellow
Write-Host "  ✓ Removed premature shipment creation" -ForegroundColor Green
Write-Host "  ✓ Fixed pay button disabled condition" -ForegroundColor Green
Write-Host "  ✓ Added extensive CardField logging" -ForegroundColor Green
Write-Host "  ✓ Shipment now created ONLY when user clicks Pay" -ForegroundColor Green
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to mobile directory
Set-Location -Path "mobile"

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Are you in the DriveDrop-Main directory?" -ForegroundColor Red
    exit 1
}

Write-Host "📱 Starting EAS build for Android..." -ForegroundColor Cyan
Write-Host ""

# Build for Android
eas build --platform android --profile production

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   BUILD SUBMITTED!                  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Wait for build to complete (check EAS dashboard)" -ForegroundColor White
Write-Host "  2. Download the APK when ready" -ForegroundColor White
Write-Host "  3. UNINSTALL the old version from your device" -ForegroundColor White
Write-Host "  4. Install the new APK" -ForegroundColor White
Write-Host "  5. Test the payment flow" -ForegroundColor White
Write-Host ""
Write-Host "Expected results:" -ForegroundColor Yellow
Write-Host "  ✓ No 'Initializing payment...' loading screen" -ForegroundColor Green
Write-Host "  ✓ Card input visible immediately" -ForegroundColor Green
Write-Host "  ✓ NO shipment created when screen loads" -ForegroundColor Green
Write-Host "  ✓ Pay button enables when card is complete" -ForegroundColor Green
Write-Host "  ✓ Shipment created ONLY after clicking Pay" -ForegroundColor Green
Write-Host ""
Write-Host "Check console logs for:" -ForegroundColor Yellow
Write-Host "  ═══ CARD CHANGE EVENT ═══" -ForegroundColor Magenta
Write-Host "  These logs will show CardField validation details" -ForegroundColor White
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
