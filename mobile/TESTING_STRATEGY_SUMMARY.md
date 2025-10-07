# Incremental Testing Strategy - Summary

## 🎯 Goal
Find **exactly what change** broke the app by starting from the known working build and adding changes one at a time.

## 📊 What We Know

### Working Build (Sept 12, 2025)
- **Commit**: `08f5868`
- **Build ID**: `36242b35-8f03-4c6f-962a-d8f06df7dd03`
- **AAB Size**: 58MB ✅
- **APK Size**: ~87MB ✅
- **Status**: Perfect - no crashes
- **Dependencies**: NO Stripe, NO image-manipulator, NO polyfills

### Current Broken State
- **Commit**: `main` branch (46 commits after working)
- **AAB Size**: 64MB ❌
- **APK Size**: 189MB ❌ (100MB+ larger!)
- **Status**: Crashes immediately with "Cannot read property 'bind' of undefined"
- **Added**: Stripe, image-manipulator, FormData polyfill

## 🔬 Testing Approach

### Phase 1: Test Individual Dependencies (In Progress)

**v52** ⏳ Building now...
- Exact working commit - no changes
- **Purpose**: Prove we can reproduce the working build
- **If fails**: EAS environment changed (big problem)
- **If works**: Proceed to v53

**v53** - Test Stripe alone
- Add ONLY `@stripe/stripe-react-native`
- **If crashes**: Stripe is the culprit
- **If works**: Stripe is fine, test next

**v54** - Test image-manipulator alone  
- Add ONLY `expo-image-manipulator`
- **If crashes**: image-manipulator is the culprit
- **If works**: image-manipulator is fine

**v55** - Test both dependencies together
- Add Stripe + image-manipulator
- **If crashes**: Bad interaction between them
- **If works**: Dependencies are fine, problem is in CODE

**v56** - Add FormData polyfill
- Add dependencies + polyfill file + index.ts changes
- **If crashes**: Polyfill implementation is broken
- **If works**: Polyfill is fine

### Phase 2: Binary Search Through Commits (If Needed)

If all dependency tests pass, the problem is in code/config changes:
1. Test commit 23 (midpoint)
2. Narrow down to breaking commit
3. Identify exact change that broke it

## 🎮 Quick Actions

### Check Build Status
```bash
eas build:list --limit 5
```

### Download Latest Build
```bash
eas build:download
```

### Check AAB Size (Instant Indicator)
```bash
Get-Item *.aab | Sort-Object LastWriteTime | Select-Object -Last 1 | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,1)}}
```
- **< 60MB** = Good ✅
- **> 62MB** = Bad ❌

### Extract and Install
```bash
bundletool build-apks --bundle=application-<ID>.aab --output=test.apks --mode=universal --ks=@drivedrop__drivedrop.jks --ks-pass=pass:6515c9e31c7274579be332380d9fb7ea --ks-key-alias=cee99183665473db5cb5676a801350b8 --key-pass=pass:63f453b23a7a80424f204726dc19f9c6

Copy-Item test.apks test.zip
Expand-Archive test.zip test_extracted -Force  
Copy-Item test_extracted\universal.apk test.apk
adb install -r test.apk
```

### Check for Crash
```bash
adb logcat -c  # Clear logs
# Launch app on device
adb logcat | Select-String "FATAL|AndroidRuntime.*Exception"
```

## 📁 Reference Files Created

1. **BUILD_TESTING_LOG.md** - Track results of each build
2. **QUICK_TEST_SCRIPTS.md** - Copy-paste commands for each test
3. **INCREMENTAL_TEST_PLAN.md** - Detailed strategy document
4. **This file** - Quick reference summary

## ⚡ Next Steps

1. **Wait for v52 to complete** (~15-20 min)
2. **Download and test v52**
   - If works: Great! Proceed to v53
   - If fails: EAS environment issue, need different approach
3. **Run v53-v56 tests** based on v52 results
4. **Document findings** in BUILD_TESTING_LOG.md
5. **Identify root cause** and fix

## 🔍 What We're Looking For

The exact change that causes:
- ❌ AAB size to jump from 58MB → 64MB
- ❌ APK size to explode from 87MB → 189MB
- ❌ Runtime crash: "Cannot read property 'bind' of undefined"

Once found, we can either:
- Remove/fix the problematic change
- Find alternative implementation
- Update dependencies to compatible versions

## 💡 Current Hypothesis

Most likely culprits (in order):
1. **FormData polyfill** - Unnecessary and may break native modules
2. **Stripe SDK** - Known to have Kotlin/Compose issues
3. **Gradle configuration changes** - Kotlin version bumps
4. **Some combination** of the above

We'll know soon! 🎯
