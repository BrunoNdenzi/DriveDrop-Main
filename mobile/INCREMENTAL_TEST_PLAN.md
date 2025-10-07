
# Incremental Testing Plan - Finding the Breaking Change

**Working Build**: `08f5868` (Sep 12) - Build ID: `36242b35-8f03-4c6f-962a-d8f06df7dd03`
- AAB Size: 58MB ✅
- APK Size: ~87MB ✅
- Status: Working perfectly

**Current State**: Build v51 - Crashing with "Cannot read property 'bind' of undefined"
- AAB Size: 64MB ❌
- APK Size: 189MB ❌
- Status: Crashes immediately

## Strategy: Binary Search

Instead of testing all 46 commits, we'll use binary search:

### Phase 1: Test Midpoint
1. Checkout commit ~23 commits after working (halfway point)
2. Build and test
3. If works: Move forward
4. If fails: Move backward

### Phase 2: Only Added Dependencies
Since package.json shows only 2 new dependencies:
1. `@stripe/stripe-react-native": "0.37.3"`
2. `expo-image-manipulator": "~13.0.5"`

Let's test these individually:

## Test Builds

### Build v52: Baseline (Exact Working Commit)
```bash
git checkout 08f5868
# DON'T change anything
eas build --platform android --profile production
```
**Expected**: 58MB AAB, works ✅

### Build v53: Add ONLY Stripe
```bash
git checkout 08f5868
# Add only: "@stripe/stripe-react-native": "0.37.3" to package.json
yarn install
eas build --platform android --profile production
```
**Test**: Does Stripe alone cause the crash?

### Build v54: Add ONLY image-manipulator  
```bash
git checkout 08f5868
# Add only: "expo-image-manipulator": "~13.0.5" to package.json
yarn install
eas build --platform android --profile production
```
**Test**: Does image-manipulator alone cause the crash?

### Build v55: Add BOTH dependencies
```bash
git checkout 08f5868
# Add both Stripe + image-manipulator
yarn install
eas build --platform android --profile production
```
**Test**: Do they work together?

### Build v56: Add FormData Polyfill
```bash
git checkout 08f5868
# Add both dependencies
# Add formDataPolyfill.js file
# Update index.ts to import it
yarn install
eas build --platform android --profile production
```
**Test**: Does the polyfill cause issues?

## Files Changed Since Working Build

From git diff:
1. `index.ts` - Added polyfill imports + **DUPLICATE registerRootComponent()** ❌
2. `formDataPolyfill.js` - NEW FILE
3. `App.tsx` - 97 lines changed
4. `android/build.gradle` - Kotlin version changes
5. `android/app/build.gradle` - 50 lines changed

## Immediate Issues Found

1. **index.ts has duplicate registration**:
   ```typescript
   registerRootComponent(App);
   registerRootComponent(App); // ❌ CALLED TWICE!
   ```

2. **Potential polyfill issue**: The formDataPolyfill uses old ES5 syntax and might not be needed since RN 0.79 likely has FormData built-in

## Next Steps

1. Fix the duplicate `registerRootComponent()` call
2. Test if removing formDataPolyfill.js helps
3. If issues persist, do binary search through commits
4. Focus on the 2 new dependencies as likely culprits

## Quick Win Attempts Before Full Testing

1. Remove duplicate `registerRootComponent()` → Build v52
2. Remove formDataPolyfill entirely → Build v53
3. Remove polyfill but keep dependencies → Build v54
