# Google Play Store Signing Key Update

## Issue
App bundle was rejected with signing key mismatch:
- Expected SHA1: 5C:9F:FA:E3:10:F5:4B:5A:9F:CB:66:6A:4D:A0:73:67:9A:E6:A1:A6
- Actual SHA1: F9:3B:43:24:36:02:71:6A:17:7A:6D:C2:2A:FC:29:FB:F1:3A:F4:9F

## Solution
Upload new signing certificate to Google Play Console

## Files Created
- `@drivedrop__drivedrop.jks` - EAS keystore file
- `upload-certificate.pem` - Certificate for Google Play Console

## Keystore Details
- Type: JKS
- Key Alias: cee99183665473db5cb5676a801350b8
- SHA1 Fingerprint: F9:3B:43:24:36:02:71:6A:17:7A:6D:C2:2A:FC:29:FB:F1:3A:F4:9F
- SHA256 Fingerprint: 86:4E:4C:69:05:2B:39:36:70:C6:D6:35:2C:6F:79:A7:3D:A8:F1:1B:E2:E7:79:39:5E:3F:5D:63:59:90:2A:A2

## Steps to Fix
1. Go to Google Play Console → DriveDrop app → Setup → App signing
2. Upload the `upload-certificate.pem` file as new upload certificate
3. Re-upload the app bundle (same one that was built successfully)

## Keystore Passwords (for reference)
- Keystore password: 6515c9e31c7274579be332380d9fb7ea
- Key password: 63f453b23a7a80424f204726dc19f9c6