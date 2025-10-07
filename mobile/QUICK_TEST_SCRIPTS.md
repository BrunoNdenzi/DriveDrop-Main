# Quick Test Scripts for Incremental Building

## Setup
```bash
# Start from working commit
git checkout 08f5868
git clean -fd  # Remove untracked files (except ignored ones)
```

## Build v53: Test Stripe Only
```bash
# Ensure we're at baseline
git checkout 08f5868
git clean -fd

# Add Stripe to package.json
$packageJson = Get-Content package.json | ConvertFrom-Json
$packageJson.dependencies.'@stripe/stripe-react-native' = '0.37.3'
$packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json

# Install and build
yarn install
eas build --platform android --profile production --message "v53: Add ONLY Stripe 0.37.3" --non-interactive
```

## Build v54: Test image-manipulator Only  
```bash
# Reset to baseline
git checkout 08f5868
git clean -fd

# Add image-manipulator to package.json
$packageJson = Get-Content package.json | ConvertFrom-Json
$packageJson.dependencies.'expo-image-manipulator' = '~13.0.5'
$packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json

# Install and build
yarn install
eas build --platform android --profile production --message "v54: Add ONLY image-manipulator" --non-interactive
```

## Build v55: Test BOTH Dependencies
```bash
# Reset to baseline
git checkout 08f5868
git clean -fd

# Add both dependencies
$packageJson = Get-Content package.json | ConvertFrom-Json
$packageJson.dependencies.'@stripe/stripe-react-native' = '0.37.3'
$packageJson.dependencies.'expo-image-manipulator' = '~13.0.5'
$packageJson | ConvertTo-Json -Depth 10 | Set-Content package.json

# Install and build
yarn install
eas build --platform android --profile production --message "v55: Add Stripe + image-manipulator" --non-interactive
```

## After Each Build
```bash
# Download when build completes
eas build:list --limit 1
eas build:download --id <BUILD_ID>

# Check size
Get-Item *.aab | Select-Object Name, Length

# If < 60MB → probably good
# If > 62MB → probably broken

# Extract and test
bundletool build-apks --bundle=application-<ID>.aab --output=test.apks --mode=universal --ks=@drivedrop__drivedrop.jks --ks-pass=pass:6515c9e31c7274579be332380d9fb7ea --ks-key-alias=cee99183665473db5cb5676a801350b8 --key-pass=pass:63f453b23a7a80424f204726dc19f9c6

# Extract APK
Copy-Item test.apks test.zip
Expand-Archive test.zip -Force
Copy-Item test\universal.apk test.apk

# Install
adb install -r test.apk

# Test and check logs
adb logcat -c
# Launch app
adb logcat | Select-String "drivedrop|FATAL"
```

## Quick One-Liner to Check Build
```powershell
# After download
$aab = Get-Item *.aab | Sort-Object LastWriteTime | Select-Object -Last 1
if ($aab.Length -lt 60MB) { Write-Host "✅ Good size: $($aab.Length / 1MB)MB" -ForegroundColor Green } else { Write-Host "❌ Bad size: $($aab.Length / 1MB)MB" -ForegroundColor Red }
```
