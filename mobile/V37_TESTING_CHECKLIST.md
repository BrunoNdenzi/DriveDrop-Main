# Testing Checklist for v37

## Build Information
- **Build ID:** 32124029-eda2-44e6-ac9c-075996527784
- **Version:** v37
- **Fix:** Global error handler for bind errors

## Installation Steps

1. **Download AAB** (when build completes)
   ```powershell
   cd F:\
   # Download from: https://expo.dev/artifacts/eas/[artifact-id].aab
   ```

2. **Convert to APK**
   ```powershell
   java -jar bundletool-all-1.18.2.jar build-apks --bundle=[filename].aab --output=v37.apks --mode=universal
   Copy-Item v37.apks v37.zip
   Expand-Archive v37.zip v37-temp -Force
   Copy-Item v37-temp\universal.apk F:\DriveDrop-v37-ERROR-HANDLER.apk
   Remove-Item v37.zip, v37.apks, v37-temp -Recurse -Force
   ```

3. **Install on Device**
   ```powershell
   adb devices  # Verify connection
   adb install -r F:\DriveDrop-v37-ERROR-HANDLER.apk
   ```

4. **Clear Logcat**
   ```powershell
   adb logcat -c
   ```

5. **Launch App & Capture Logs**
   ```powershell
   # Launch app manually on device
   Start-Sleep -Seconds 5
   adb logcat -d -v time ReactNativeJS:V *:E | Select-String -Pattern "Polyfill|FATAL|bind|Error" -Context 0,2 | Select-Object -First 100
   ```

## What to Look For

### ✅ SUCCESS INDICATORS:
- `[Polyfill] 🔧 Starting global polyfills...`
- `[Polyfill] ✅ Global error handler installed`
- `[Polyfill] ✅ Function.prototype.bind protected`
- `[Polyfill] Creating FormData...`
- `[Polyfill] ✅ FormData created`
- `[Polyfill] ❌ CAUGHT BIND ERROR - Attempting to recover...` ← **KEY!**
- App reaches login screen
- **NO FATAL EXCEPTION**

### ❌ FAILURE INDICATORS:
- `FATAL EXCEPTION: mqt_js`
- `Cannot read property 'bind' of undefined` (without recovery message)
- App crashes before reaching login screen
- Error handler NOT installed

## Scenario Analysis

### Scenario 1: Error Handler Works
**Logs show:**
```
[Polyfill] ❌ CAUGHT BIND ERROR - Attempting to recover...
[Polyfill] Error details: Cannot read property 'bind' of undefined
[Polyfill] Stack: [stack trace]
```
**Action:** Success! App should continue. Analyze the stack trace to identify the problematic library.

### Scenario 2: Error Too Early
**Logs show:**
```
FATAL EXCEPTION: Cannot read property 'bind' of undefined
(No polyfill messages)
```
**Action:** Error occurs before ErrorUtils is available. Need to:
- Analyze bundle to find exact code at `bundle:1:1063324`
- Identify and remove/replace the problematic library

### Scenario 3: Different Error
**Logs show:**
```
[Polyfill] ✅ All polyfills installed
FATAL EXCEPTION: [different error]
```
**Action:** Bind error fixed! Move to next issue.

### Scenario 4: App Works!
**Logs show:**
```
[Polyfill] ✅ All polyfills installed
[App initialization logs]
[Login screen rendered]
```
**Action:** 🎉 SUCCESS! App is working!

## Next Steps Based on Outcome

### If Error Handler Catches It:
1. Review full stack trace from logs
2. Identify the library from the trace
3. Create targeted fix:
   - Option A: Remove the library
   - Option B: Downgrade to compatible version
   - Option C: Create specific polyfill for missing API
   - Option D: Patch the library

### If Error Still Fatal:
1. The error is happening too early (before ErrorUtils)
2. Need to analyze the actual bundle code
3. Possible solutions:
   - Remove Sentry package: `yarn remove @sentry/react-native`
   - Check for other problematic dependencies
   - Use Metro's module replacement feature

### If App Works:
1. Test all major features
2. Verify no degraded functionality
3. Upload to Play Store
4. Monitor for production errors

## Quick Commands

**Check build status:**
```powershell
cd F:\DD\DriveDrop-Main\mobile
eas build:list --platform android --limit 1 --non-interactive
```

**Full test sequence:**
```powershell
# After build completes and AAB is in F:\
cd F:\
adb devices
adb install -r DriveDrop-v37-ERROR-HANDLER.apk
adb logcat -c
# Launch app
Start-Sleep -Seconds 5
adb logcat -d -v time ReactNativeJS:V *:E | Select-String "Polyfill|FATAL|bind" -Context 0,2
```

---

*Created: October 5, 2025 - 17:45*
*Build ETA: ~18:05 (20 minutes from start)*
