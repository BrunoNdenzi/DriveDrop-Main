# Build v53 Preparation - Add ONLY Stripe

## Current State
- At commit: 08f5868 (working baseline)
- No Stripe, no image-manipulator

## Changes for v53
**Add ONLY** `@stripe/stripe-react-native` to test if Stripe alone causes the crash.

## Steps

1. Ensure we're at baseline:
```bash
cd F:\DD\DriveDrop-Main\mobile
git status  # Should be at 08f5868
```

2. Add Stripe to package.json (manually or via script)
3. Run `yarn install`
4. Build: `eas build --platform android --profile production --message "v53: Add ONLY Stripe 0.37.3"`
5. Download, extract, test

## Expected Outcomes

**If v53 works (APK ~87MB)**:
- ✅ Stripe is NOT the problem
- → Proceed to v54 (test image-manipulator)

**If v53 crashes (APK ~189MB)**:
- ❌ Stripe IS the problem!
- → Need to find alternative payment solution OR fix Stripe integration
- → Check if Stripe requires specific Kotlin/Gradle configuration

## How to Add Stripe

Edit `F:\DD\DriveDrop-Main\mobile\package.json`:

Find the dependencies section and add:
```json
"@stripe/stripe-react-native": "0.37.3",
```

Then:
```bash
cd F:\DD\DriveDrop-Main\mobile
yarn install
```

## Ready to Build?
Once Stripe is added and yarn install completes, run:
```bash
eas build --platform android --profile production --message "v53: Add ONLY Stripe 0.37.3" --non-interactive
```
