# T002 condensed: auto-fix lint + tsconfig excludes — backend: npm, mobile: yarn
# Safety: Requires clean working tree. DOES NOT push or open PRs.

$ErrorActionPreference = "Stop"
$OUT = "$env:TEMP\drivedrop_t002"
if (Test-Path $OUT) { Remove-Item -Recurse -Force $OUT }
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

# Log function
function Write-Log {
    param (
        [string]$message
    )
    Write-Host $message
    Add-Content -Path "$OUT\run.log" -Value $message
}

# Safety check: clean repo
$gitStatus = git status --porcelain
if ($gitStatus) {
    $errorMsg = "ERROR: Please commit/stash working tree before running."
    Write-Host $errorMsg
    Set-Content -Path "$OUT\error.txt" -Value $errorMsg
    Add-Content -Path "$OUT\error.txt" -Value $gitStatus
    exit 1
}

Write-Log "START T002: $(Get-Date)"
Write-Log "Branch base: $(git rev-parse --abbrev-ref HEAD)"

# Helper functions
function Write-EslintIgnore {
    param (
        [string]$path
    )
    $eslintIgnorePath = "$path\.eslintignore"
    @"
node_modules/
dist/
build/
.expo/
*.log
**/*.bak
**/*.bak.*
**/*.tmp
temp_*
"@ | Set-Content -Path $eslintIgnorePath
    Write-Log "Wrote $eslintIgnorePath"
}

function Add-TsExcludes {
    param (
        [string]$target
    )
    if (Test-Path $target) {
        Copy-Item $target "${target}.bak" -Force
        $tsconfig = Get-Content -Raw $target | ConvertFrom-Json
        if (-not $tsconfig.exclude) {
            $tsconfig | Add-Member -MemberType NoteProperty -Name "exclude" -Value @()
        }
        $excludes = $tsconfig.exclude + @("node_modules", "dist", "build", ".expo", "**/*.bak", "**/*.bak.*", "**/*.tmp", "temp_*") | Sort-Object -Unique
        $tsconfig.exclude = $excludes
        $tsconfig | ConvertTo-Json -Depth 10 | Set-Content -Path $target
        Write-Log "Updated $target"
    }
}

# BACKEND (npm)
if (Test-Path "backend") {
    Write-Log "=== BACKEND T002 ==="
    git fetch origin 2>&1 | Out-Null
    git checkout -b feat/T002-backend-lint-fixes 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        git checkout feat/T002-backend-lint-fixes 2>&1 | Out-Null
    }

    # write eslintignore
    New-Item -ItemType Directory -Force -Path "backend" | Out-Null
    Write-EslintIgnore "backend"

    # locate tsconfig for backend
    $TSC = ""
    if (Test-Path "backend\tsconfig.json") {
        $TSC = "backend\tsconfig.json"
    } elseif (Test-Path "tsconfig.json") {
        $TSC = "tsconfig.json"
    }
    
    if ($TSC) {
        Add-TsExcludes $TSC
    } else {
        Write-Log "No tsconfig found for backend"
    }

    # install and run auto-fix
    Push-Location backend
    try {
        Write-Log "-> npm ci"
        npm ci 2>&1 | Tee-Object -FilePath "$OUT\backend_npm_install.log"
        
        Write-Log "-> eslint --fix (backend)"
        $npmRunOutput = npm run
        if ($npmRunOutput -match "lint") {
            npm run lint -- --fix 2>&1 | Tee-Object -FilePath "$OUT\backend_lint_fix.log"
        } else {
            npx eslint 'src/**/*.{ts,tsx,js,jsx}' --fix 2>&1 | Tee-Object -FilePath "$OUT\backend_lint_fix.log" -ErrorAction SilentlyContinue
        }
        
        Write-Log "-> type-check (backend)"
        if ($npmRunOutput -match "type-check") {
            npm run type-check 2>&1 | Tee-Object -FilePath "$OUT\backend_typecheck.log" -ErrorAction SilentlyContinue
        } else {
            npx tsc --noEmit 2>&1 | Tee-Object -FilePath "$OUT\backend_typecheck.log" -ErrorAction SilentlyContinue
        }
        
        Write-Log "-> tests (backend)"
        if ($npmRunOutput -match "test") {
            npm test -- --watchAll=false --coverage=false 2>&1 | Tee-Object -FilePath "$OUT\backend_test.log" -ErrorAction SilentlyContinue
        } else {
            npx jest --runInBand --silent 2>&1 | Tee-Object -FilePath "$OUT\backend_test.log" -ErrorAction SilentlyContinue
        }
    } finally {
        Pop-Location
    }

    # stage and commit backend changes if any
    git add backend\.eslintignore $TSC backend\ 2>$null
    $hasStagedChanges = git diff --staged --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Log "No staged changes to commit for backend"
    } else {
        git commit -m "[T002] backend: eslint auto-fixes, .eslintignore & tsconfig excludes" 2>$null
    }
}

# MOBILE (yarn)
if (Test-Path "mobile") {
    Write-Log "=== MOBILE T002 ==="
    git fetch origin 2>&1 | Out-Null
    git checkout -b feat/T002-mobile-lint-fixes 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        git checkout feat/T002-mobile-lint-fixes 2>&1 | Out-Null
    }

    # write eslintignore
    New-Item -ItemType Directory -Force -Path "mobile" | Out-Null
    Write-EslintIgnore "mobile"

    # locate tsconfig for mobile
    $MTSC = ""
    if (Test-Path "mobile\tsconfig.json") {
        $MTSC = "mobile\tsconfig.json"
    } elseif (Test-Path "tsconfig.json") {
        $MTSC = "tsconfig.json"
    }
    
    if ($MTSC) {
        Add-TsExcludes $MTSC
    } else {
        Write-Log "No tsconfig found for mobile"
    }

    # install and run auto-fix
    Push-Location mobile
    try {
        Write-Log "-> yarn install"
        yarn --frozen-lockfile 2>&1 | Tee-Object -FilePath "$OUT\mobile_yarn_install.log"
        
        Write-Log "-> eslint --fix (mobile)"
        $yarnRunOutput = yarn run
        if ($yarnRunOutput -match "lint") {
            yarn lint --fix 2>&1 | Tee-Object -FilePath "$OUT\mobile_lint_fix.log" -ErrorAction SilentlyContinue
        } else {
            npx eslint 'src/**/*.{ts,tsx,js,jsx}' --fix 2>&1 | Tee-Object -FilePath "$OUT\mobile_lint_fix.log" -ErrorAction SilentlyContinue
        }
        
        Write-Log "-> type-check (mobile)"
        if ($yarnRunOutput -match "type-check") {
            yarn type-check 2>&1 | Tee-Object -FilePath "$OUT\mobile_typecheck.log" -ErrorAction SilentlyContinue
        } else {
            npx tsc --noEmit 2>&1 | Tee-Object -FilePath "$OUT\mobile_typecheck.log" -ErrorAction SilentlyContinue
        }
    } finally {
        Pop-Location
    }

    # stage and commit mobile changes if any
    git add mobile\.eslintignore $MTSC mobile\ 2>$null
    $hasStagedChanges = git diff --staged --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Log "No staged changes to commit for mobile"
    } else {
        git commit -m "[T002] mobile: eslint auto-fixes, .eslintignore & tsconfig excludes" 2>$null
    }
}

# Final summary outputs
Write-Log "=== T002 COMPLETE ==="
Write-Log "Logs at $OUT (backend_lint_fix.log, mobile_lint_fix.log, *_typecheck.log, *_test.log)"
git status --porcelain | Tee-Object -FilePath "$OUT\final_git_status.txt"
Write-Log "Branches created (local):"
$branches = git branch --list | Select-String "T002"
if ($branches) {
    Write-Log $branches
}

# Print concise items to paste back
Write-Host "---- SUMMARY ----"
Write-Host "Logs: $OUT"
Write-Host "Run: Get-Content $OUT\backend_lint_fix.log -Head 50  (if backend exists)"
Write-Host "Run: Get-Content $OUT\mobile_lint_fix.log -Head 50   (if mobile exists)"
Write-Host "Final git status:"
Get-Content "$OUT\final_git_status.txt"
Write-Host "If you want to discard, run: git checkout <prev-branch>; git branch -D feat/T002-backend-lint-fixes feat/T002-mobile-lint-fixes"
