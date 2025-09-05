# Skip fingerprint calculation during EAS builds to avoid issues
# Usage: . ./scripts/skip-fingerprint-build.ps1
# Then run: yarn build:android

$env:EAS_SKIP_AUTO_FINGERPRINT = "1"
Write-Host "Set EAS_SKIP_AUTO_FINGERPRINT=1"
Write-Host "You can now run: yarn build:android"
