@echo off
REM T001 short audit — backend: npm, mobile: yarn (without clean working tree requirement)

set OUT=%TEMP%\drivedrop_t001
if exist %OUT% rmdir /s /q %OUT%
mkdir %OUT%

REM Note working tree status but continue anyway
echo === Git Status === > %OUT%\git_status.txt
git status --porcelain >> %OUT%\git_status.txt
git rev-parse --abbrev-ref HEAD >> %OUT%\git_status.txt

REM BACKEND (npm)
cd backend
echo === backend: npm ci === > %OUT%\backend_full.log
call npm ci >> %OUT%\backend_full.log 2>&1

echo === backend: lint === >> %OUT%\backend_full.log
(call npm run lint > %OUT%\backend_lint.log 2>&1) || (call npx eslint . --ext .ts,.tsx,.js,.jsx > %OUT%\backend_lint.log 2>&1)

echo === backend: type-check === >> %OUT%\backend_full.log
(call npm run type-check > %OUT%\backend_typecheck.log 2>&1) || (call npx tsc --noEmit > %OUT%\backend_typecheck.log 2>&1)

echo === backend: tests === >> %OUT%\backend_full.log
(call npm test -- --watchAll=false --coverage=false > %OUT%\backend_test.log 2>&1) || (call npx jest --runInBand --silent > %OUT%\backend_test.log 2>&1)

echo === backend: npm audit === >> %OUT%\backend_full.log
call npm audit --json > %OUT%\backend_audit_raw.json 2>&1

cd ..

REM MOBILE (yarn)
cd mobile
echo === mobile: yarn install === > %OUT%\mobile_full.log
call yarn --frozen-lockfile >> %OUT%\mobile_full.log 2>&1

echo === mobile: lint === >> %OUT%\mobile_full.log
(call yarn lint > %OUT%\mobile_lint.log 2>&1) || (call npx eslint . --ext .ts,.tsx,.js,.jsx > %OUT%\mobile_lint.log 2>&1)

echo === mobile: type-check === >> %OUT%\mobile_full.log
(call yarn type-check > %OUT%\mobile_typecheck.log 2>&1) || (call npx tsc --noEmit > %OUT%\mobile_typecheck.log 2>&1)

echo === mobile: expo version & quick start === >> %OUT%\mobile_full.log
call npx expo --version > %OUT%\mobile_expo.log 2>&1

echo Running expo start for a quick smoke test (15 seconds)...
start /b cmd /c "call npx expo start --non-interactive --no-dev > %OUT%\mobile_expo_start.log 2>&1"
ping -n 16 127.0.0.1 > nul
taskkill /f /im node.exe /fi "WINDOWTITLE eq expo*" > nul 2>&1
echo expo smoke test completed >> %OUT%\mobile_expo.log

cd ..

REM GLOBAL
node -v > %OUT%\node.txt 2>&1
npm -v > %OUT%\npm.txt 2>&1
yarn -v > %OUT%\yarn.txt 2>&1
where docker > nul 2>&1 && docker --version > %OUT%\docker.txt 2>&1
where supabase > nul 2>&1 && supabase --version > %OUT%\supabase.txt 2>&1

REM SUMMARY
echo Generating summary... > %OUT%\summary.txt

findstr /i "error" %OUT%\backend_lint.log > %OUT%\backend_lint_errors.txt 2>nul
for /f %%i in ('type %OUT%\backend_lint_errors.txt ^| find /c /v ""') do echo backend lint errors: %%i >> %OUT%\summary.txt

findstr /r "error TS" %OUT%\backend_typecheck.log > %OUT%\backend_typecheck_errors.txt 2>nul
for /f %%i in ('type %OUT%\backend_typecheck_errors.txt ^| find /c /v ""') do echo backend type errors (approx): %%i >> %OUT%\summary.txt

findstr /r "FAIL" %OUT%\backend_test.log >> %OUT%\summary.txt 2>nul
findstr /r "Test Suites:" %OUT%\backend_test.log >> %OUT%\summary.txt 2>nul

findstr /i "error" %OUT%\mobile_lint.log > %OUT%\mobile_lint_errors.txt 2>nul
for /f %%i in ('type %OUT%\mobile_lint_errors.txt ^| find /c /v ""') do echo mobile lint errors: %%i >> %OUT%\summary.txt

findstr /r "error TS" %OUT%\mobile_typecheck.log > %OUT%\mobile_typecheck_errors.txt 2>nul
for /f %%i in ('type %OUT%\mobile_typecheck_errors.txt ^| find /c /v ""') do echo mobile type errors (approx): %%i >> %OUT%\summary.txt

echo Audit file: %OUT%\backend_audit_raw.json >> %OUT%\summary.txt
echo Full logs: %OUT% >> %OUT%\summary.txt

REM output summary and final git status
type %OUT%\summary.txt
git status --porcelain

echo DONE. Share %OUT%\summary.txt and top 10 blocking items from the logs for next steps.
echo Log location: %OUT%
