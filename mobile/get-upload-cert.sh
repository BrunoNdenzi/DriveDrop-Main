#!/bin/bash

# Instructions to get upload certificate from EAS keystore
# You need to run this manually through EAS credentials interface

echo "To get the upload certificate for Google Play Console:"
echo ""
echo "1. Run: npx eas credentials"
echo "2. Select: Android platform"
echo "3. Select: production profile"
echo "4. Choose: Keystore: Download keystore"
echo "5. Save the keystore file"
echo ""
echo "Then extract certificate:"
echo "keytool -export -rfc -keystore downloaded-keystore.jks -alias KEY_ALIAS -file upload-cert.pem"
echo ""
echo "Current keystore details:"
echo "SHA1: F9:3B:43:24:36:02:71:6A:17:7A:6D:C2:2A:FC:29:FB:F1:3A:F4:9F"
echo "SHA256: 86:4E:4C:69:05:2B:39:36:70:C6:D6:35:2C:6F:79:A7:3D:A8:F1:1B:E2:E7:79:39:5E:3F:5D:63:59:90:2A:A2"
echo "Key Alias: cee99183665473db5cb5676a801350b8"