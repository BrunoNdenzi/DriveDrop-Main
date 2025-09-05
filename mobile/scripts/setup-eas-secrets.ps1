# Simple EAS Secrets Setup Script

# Check for EAS CLI
try {
    $null = Get-Command eas -ErrorAction Stop
    Write-Host "EAS CLI is installed." -ForegroundColor Green
} 
catch {
    Write-Host "Error: EAS CLI is not installed. Please install it with: npm install -g eas-cli" -ForegroundColor Red
    exit 1
}

Write-Host "Setting up EAS secrets for production..." -ForegroundColor Cyan

# Helper function to create a secret
function Set-EasSecret {
    param(
        [string]$Name,
        [string]$Description,
        [bool]$Required = $false
    )
    
    Write-Host "`n$Description" -ForegroundColor Yellow
    $value = Read-Host "Enter value for $Name (leave empty to skip if optional)"
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        if ($Required) {
            Write-Host "This value is required. Please try again." -ForegroundColor Red
            return Set-EasSecret -Name $Name -Description $Description -Required $Required
        }
        else {
            Write-Host "Skipping $Name" -ForegroundColor Gray
            return
        }
    }
    
    Write-Host "Setting $Name secret..." -ForegroundColor Gray
    eas secret:create --scope project --name $Name --value $value --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Secret $Name created successfully" -ForegroundColor Green
    }
    else {
        Write-Host "Failed to create secret $Name" -ForegroundColor Red
    }
}

# Set required secrets
Set-EasSecret -Name "EXPO_PUBLIC_SUPABASE_URL" -Description "Supabase URL" -Required $true
Set-EasSecret -Name "EXPO_PUBLIC_SUPABASE_ANON_KEY" -Description "Supabase Anonymous Key" -Required $true
Set-EasSecret -Name "EXPO_PUBLIC_API_URL" -Description "API URL" -Required $true

# Set optional secrets
Set-EasSecret -Name "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" -Description "Google Maps API Key"
Set-EasSecret -Name "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" -Description "Stripe Publishable Key"
Set-EasSecret -Name "SENTRY_DSN" -Description "Sentry DSN"

# List all secrets
Write-Host "`nListing all EAS secrets:" -ForegroundColor Cyan
eas secret:list

Write-Host "`nSetup complete! Your EAS secrets are now configured for production builds." -ForegroundColor Green
Write-Host "Run 'yarn build:android' to create a new production build with these secrets." -ForegroundColor Cyan
