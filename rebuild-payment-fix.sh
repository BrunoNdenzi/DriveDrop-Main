#!/bin/bash

# Payment Fix - Rebuild Script
# This script rebuilds the mobile app with the payment fixes

echo "======================================"
echo "   REBUILDING APP WITH PAYMENT FIX   "
echo "======================================"
echo ""
echo "Fixes included:"
echo "  ✓ Removed premature shipment creation"
echo "  ✓ Fixed pay button disabled condition"
echo "  ✓ Added extensive CardField logging"
echo "  ✓ Shipment now created ONLY when user clicks Pay"
echo ""
echo "======================================"
echo ""

# Navigate to mobile directory
cd mobile

# Check if in correct directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Are you in the DriveDrop-Main directory?"
  exit 1
fi

echo "📱 Starting EAS build for Android..."
echo ""

# Build for Android
eas build --platform android --profile production

echo ""
echo "======================================"
echo "   BUILD SUBMITTED!                  "
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Wait for build to complete (check EAS dashboard)"
echo "  2. Download the APK when ready"
echo "  3. UNINSTALL the old version from your device"
echo "  4. Install the new APK"
echo "  5. Test the payment flow"
echo ""
echo "Expected results:"
echo "  ✓ No 'Initializing payment...' loading screen"
echo "  ✓ Card input visible immediately"
echo "  ✓ NO shipment created when screen loads"
echo "  ✓ Pay button enables when card is complete"
echo "  ✓ Shipment created ONLY after clicking Pay"
echo ""
echo "Check console logs for:"
echo "  ═══ CARD CHANGE EVENT ═══"
echo "  These logs will show CardField validation details"
echo ""
echo "======================================"
