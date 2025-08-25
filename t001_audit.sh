#!/usr/bin/env bash
# T001 short audit — backend: npm, mobile: yarn
set -euo pipefail
OUT="/tmp/drivedrop_t001"
rm -rf "$OUT"
mkdir -p "$OUT"

# safety: require clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted changes present — stash/commit first" | tee "$OUT/git_status.txt"
  git status --porcelain | tee -a "$OUT/git_status.txt"
  exit 1
fi
echo "BRANCH: $(git rev-parse --abbrev-ref HEAD)" > "$OUT/git_status.txt"

# BACKEND (npm)
(
  cd backend
  echo "=== backend: npm ci ===" | tee "$OUT/backend_full.log"
  npm ci 2>&1 | tee -a "$OUT/backend_full.log"

  echo "=== backend: lint ===" | tee -a "$OUT/backend_full.log"
  ( npm run lint 2>&1 || npx eslint . --ext .ts,.tsx,.js,.jsx 2>&1 ) | tee "$OUT/backend_lint.log"

  echo "=== backend: type-check ===" | tee -a "$OUT/backend_full.log"
  ( npm run type-check 2>&1 || npx tsc --noEmit 2>&1 ) | tee "$OUT/backend_typecheck.log"

  echo "=== backend: tests ===" | tee -a "$OUT/backend_full.log"
  ( npm test -- --watchAll=false --coverage=false 2>&1 || npx jest --runInBand --silent 2>&1 ) | tee "$OUT/backend_test.log"

  echo "=== backend: npm audit ===" | tee -a "$OUT/backend_full.log"
  npm audit --json 2>&1 | tee "$OUT/backend_audit_raw.json"
) 2>&1 | tee -a "$OUT/backend_wrapper.log"

# MOBILE (yarn)
(
  cd mobile
  echo "=== mobile: yarn install ===" | tee "$OUT/mobile_full.log"
  yarn --frozen-lockfile 2>&1 | tee -a "$OUT/mobile_full.log"

  echo "=== mobile: lint ===" | tee -a "$OUT/mobile_full.log"
  ( yarn lint 2>&1 || npx eslint . --ext .ts,.tsx,.js,.jsx 2>&1 ) | tee "$OUT/mobile_lint.log"

  echo "=== mobile: type-check ===" | tee -a "$OUT/mobile_full.log"
  ( yarn type-check 2>&1 || npx tsc --noEmit 2>&1 ) | tee "$OUT/mobile_typecheck.log"

  echo "=== mobile: expo version & quick start (45s) ===" | tee -a "$OUT/mobile_full.log"
  npx expo --version 2>&1 | tee -a "$OUT/mobile_expo.log"

  ( npx expo start --non-interactive --no-dev 2>&1 | tee -a "$OUT/mobile_expo_start.log" ) & EXPO_PID=$!
  echo "Expo PID: $EXPO_PID" | tee -a "$OUT/mobile_expo.log"
  sleep 45
  kill "$EXPO_PID" 2>/dev/null || true
  echo "expo smoke captured" >> "$OUT/mobile_expo.log"
) 2>&1 | tee -a "$OUT/mobile_wrapper.log"

# GLOBAL
node -v > "$OUT/node.txt" 2>&1
npm -v > "$OUT/npm.txt" 2>&1
yarn -v > "$OUT/yarn.txt" 2>&1 || true
docker --version > "$OUT/docker.txt" 2>&1 || true
supabase --version > "$OUT/supabase.txt" 2>&1 || true

# SUMMARY
echo "Generating summary..." > "$OUT/summary.txt"
grep -i "error" "$OUT/backend_lint.log" 2>/dev/null | wc -l | awk '{print "backend lint errors: "$1}' >> "$OUT/summary.txt"
grep -E "error TS|error:" "$OUT/backend_typecheck.log" 2>/dev/null | wc -l | awk '{print "backend type errors (approx): "$1}' >> "$OUT/summary.txt"
grep -E "FAIL|Test Suites:" "$OUT/backend_test.log" 2>/dev/null | tail -n +1 >> "$OUT/summary.txt"
grep -i "error" "$OUT/mobile_lint.log" 2>/dev/null | wc -l | awk '{print "mobile lint errors: "$1}' >> "$OUT/summary.txt"
grep -E "error TS|error:" "$OUT/mobile_typecheck.log" 2>/dev/null | wc -l | awk '{print "mobile type errors (approx): "$1}' >> "$OUT/summary.txt"
echo "Audit file: $OUT/backend_audit_raw.json" >> "$OUT/summary.txt"
echo "Full logs: $OUT" >> "$OUT/summary.txt"

# output summary and final git status
cat "$OUT/summary.txt"
git status --porcelain

echo "DONE. Share $OUT/summary.txt and top 10 blocking items from the logs for next steps."
