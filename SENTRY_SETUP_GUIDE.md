# Sentry Setup Guide for DriveDrop Mobile App

## Current Status
✅ **Sentry SDK Already Installed**: `@sentry/react-native` v7.0.1  
✅ **Sentry Configuration File Exists**: `mobile/src/lib/sentry.ts`  
✅ **Error Boundary Implemented**: `mobile/src/components/ErrorBoundary.tsx`  
✅ **Auto-initialization in App.tsx**: Sentry starts on app launch

**What's Missing**: Sentry DSN (Data Source Name) configuration

---

## Step 1: Create Sentry Account & Project

### 1.1 Sign Up for Sentry
1. Go to https://sentry.io/signup/
2. Sign up with GitHub, Google, or email
3. Choose the **Free Plan** (up to 5,000 errors/month)

### 1.2 Create New Project
1. After logging in, click **"Create Project"**
2. **Select Platform**: Choose **"React Native"**
3. **Alert Frequency**: Choose **"I'll create my own alerts later"**
4. **Project Name**: Enter `drivedrop-mobile` (or your preferred name)
5. **Team**: Select your team or create a new one
6. Click **"Create Project"**

### 1.3 Get Your DSN
1. After project creation, you'll see the setup page
2. **Copy the DSN** - it looks like:
   ```
   https://07162e57983d52b56ca46a12786e9605@o4509960738701312.ingest.us.sentry.io/4510499270426624
   ```
3. Keep this tab open, we'll need it!

---

## Step 2: Configure Mobile App

### 2.1 Update `.env` File
Open `mobile/.env` and add your Sentry DSN:

```bash
# Add this line to mobile/.env
EXPO_PUBLIC_SENTRY_DSN=https://your-actual-dsn@o123456.ingest.sentry.io/7890123
```

**Replace** `https://your-actual-dsn@o123456.ingest.sentry.io/7890123` with your actual DSN from Sentry.

### 2.2 Update `.env.example` (Optional but Recommended)
```bash
# In mobile/.env.example, update the line:
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-key@sentry.io/your-project
```

---

## Step 3: Configure app.json for Sentry

### 3.1 Update app.json
Open `mobile/app.json` and add Sentry configuration:

```json
{
  "expo": {
    "name": "DriveDrop",
    "slug": "drivedrop-mobile",
    ...
    "extra": {
      "sentryDsn": "${EXPO_PUBLIC_SENTRY_DSN}",
      "env": "${EXPO_PUBLIC_ENV}",
      "eas": {
        "projectId": "your-eas-project-id"
      }
    },
    "hooks": {
      "postPublish": [
        {
          "file": "sentry-expo/upload-sourcemaps",
          "config": {
            "organization": "your-sentry-org",
            "project": "drivedrop-mobile",
            "authToken": "${SENTRY_AUTH_TOKEN}"
          }
        }
      ]
    }
  }
}
```

**Note**: We'll configure sourcemap uploads later (optional for now).

---

## Step 4: Test Sentry Integration

### 4.1 Create Test Screen (Optional)
Create `mobile/src/screens/debug/SentryTestScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';

export default function SentryTestScreen() {
  const testCrash = () => {
    throw new Error('Test Error: This is a manual crash test!');
  };

  const testError = () => {
    try {
      throw new Error('Test Error: Caught and logged to Sentry');
    } catch (error) {
      Sentry.captureException(error);
      console.log('Error captured and sent to Sentry');
    }
  };

  const testMessage = () => {
    Sentry.captureMessage('Test Message: Sentry is working!', 'info');
    console.log('Message sent to Sentry');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sentry Test Screen</Text>
      
      <TouchableOpacity style={styles.button} onPress={testMessage}>
        <Text style={styles.buttonText}>Send Test Message</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testError}>
        <Text style={styles.buttonText}>Throw Caught Error</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={testCrash}>
        <Text style={styles.buttonText}>⚠️ Throw Crash (Will restart app)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  button: { backgroundColor: '#7B61FF', padding: 15, borderRadius: 8, marginBottom: 15, width: '100%' },
  dangerButton: { backgroundColor: '#FF5555' },
  buttonText: { color: 'white', textAlign: 'center', fontSize: 16, fontWeight: '600' },
});
```

### 4.2 Add to Navigation
In `mobile/src/navigation/index.tsx`, add:

```tsx
import SentryTestScreen from '../screens/debug/SentryTestScreen';

// Inside your Stack.Navigator:
<Stack.Screen 
  name="SentryTest" 
  component={SentryTestScreen} 
  options={{ title: 'Sentry Test' }} 
/>
```

### 4.3 Run the App
```bash
cd mobile
npm start
```

Press `a` for Android or `i` for iOS.

### 4.4 Test Error Reporting
1. Navigate to the Sentry Test screen
2. Tap **"Send Test Message"** - should appear in Sentry immediately
3. Tap **"Throw Caught Error"** - error logged but app continues
4. Tap **"⚠️ Throw Crash"** - app will crash and restart, error sent to Sentry

### 4.5 Verify in Sentry Dashboard
1. Go to https://sentry.io
2. Select your project (`drivedrop-mobile`)
3. Click **"Issues"** in the left sidebar
4. You should see your test errors appear within seconds!

---

## Step 5: Configure Production Settings

### 5.1 Environment Variables for EAS Build
Create/update `mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_ENV": "staging"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 5.2 Add Secrets to EAS
```bash
# Set Sentry DSN as EAS Secret
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://your-dsn@sentry.io/project"

# Set environment
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value "production"
```

---

## Step 6: Advanced Configuration (Optional)

### 6.1 Source Maps for Production
Source maps help Sentry show the exact line of code that caused errors in production builds.

#### Install Sentry CLI
```bash
npm install -g @sentry/cli
```

#### Create Sentry Auth Token
1. Go to Sentry → Settings → Auth Tokens
2. Click **"Create New Token"**
3. **Scopes**: Select `project:releases` and `project:write`
4. Copy the token

#### Add to EAS Secrets
```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "your-auth-token"
```

#### Update app.json
```json
{
  "expo": {
    "hooks": {
      "postPublish": [
        {
          "file": "sentry-expo/upload-sourcemaps",
          "config": {
            "organization": "your-organization-slug",
            "project": "drivedrop-mobile"
          }
        }
      ]
    }
  }
}
```

### 6.2 User Context
Track which users are experiencing errors:

```typescript
// In your AuthContext or after login
import * as Sentry from '@sentry/react-native';

Sentry.setUser({
  id: user.id,
  email: user.email,
  username: `${user.first_name} ${user.last_name}`,
  role: user.role,
});

// On logout
Sentry.setUser(null);
```

### 6.3 Custom Breadcrumbs
Add context to errors:

```typescript
import * as Sentry from '@sentry/react-native';

// Log important actions
Sentry.addBreadcrumb({
  category: 'shipment',
  message: 'User created new shipment',
  level: 'info',
  data: {
    shipmentId: shipment.id,
    status: shipment.status,
  },
});
```

### 6.4 Performance Monitoring
Already enabled in `sentry.ts`. Track custom transactions:

```typescript
import * as Sentry from '@sentry/react-native';

const transaction = Sentry.startTransaction({
  name: 'Load Shipments',
  op: 'navigation',
});

try {
  await fetchShipments();
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

---

## Step 7: Verify Everything Works

### ✅ Checklist
- [ ] Sentry account created
- [ ] Project created in Sentry
- [ ] DSN copied
- [ ] DSN added to `mobile/.env`
- [ ] App restarted with new env variable
- [ ] Test message sent successfully
- [ ] Test error appears in Sentry dashboard
- [ ] Error details show correct file and line number
- [ ] Production environment configured (if deploying)

---

## Monitoring & Alerts

### View Issues
1. **Dashboard**: https://sentry.io → Select Project
2. **Issues**: See all errors grouped by type
3. **Performance**: Monitor app performance metrics
4. **Releases**: Track errors by app version

### Set Up Alerts
1. Go to **Alerts** → **Create Alert**
2. **Alert Type**: Choose "Issues"
3. **Conditions**: 
   - "When an issue is first seen"
   - "When an issue affects more than X users in Y minutes"
4. **Actions**: Email, Slack, PagerDuty, etc.

### Best Practices
- ✅ Monitor daily for new issues
- ✅ Set up Slack notifications for critical errors
- ✅ Review performance metrics weekly
- ✅ Fix high-volume errors first
- ✅ Use breadcrumbs to understand user journey
- ✅ Tag releases to track regressions

---

## Common Issues & Solutions

### Issue: "Sentry DSN not found"
**Solution**: Make sure `.env` file exists and has correct variable name:
```bash
EXPO_PUBLIC_SENTRY_DSN=https://...
```
Restart expo with `npm start -- --clear`

### Issue: Errors not appearing in Sentry
**Solution**:
1. Check network connection
2. Verify DSN is correct
3. Check Sentry dashboard has correct project selected
4. Wait 30-60 seconds (Sentry batches events)

### Issue: Source maps not working
**Solution**:
1. Ensure `sentry-expo` is installed: `npm install sentry-expo`
2. Configure auth token in EAS secrets
3. Rebuild with `eas build`

---

## Next Steps

1. **Set up the DSN** (Step 2.1)
2. **Test with the app** (Step 4)
3. **Configure user context** after login (Step 6.2)
4. **Set up alerts** for critical errors
5. **Monitor dashboard** regularly

---

## Support

- **Sentry Docs**: https://docs.sentry.io/platforms/react-native/
- **Expo + Sentry**: https://docs.expo.dev/guides/using-sentry/
- **DriveDrop Team**: Check internal docs or ask the team

---

**You're all set!** 🎉 Sentry will now automatically catch and report all errors in your mobile app.
