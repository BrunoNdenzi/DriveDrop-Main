# DriveDrop Mobile App

The DriveDrop mobile app is built with React Native and Expo, providing a comprehensive platform for vehicle shipping and transport services. The app features a modern, role-based interface with custom design system and multi-step booking flow.

## ✨ Key Features

### Client Features
- **Modern Dashboard**: Rich home screen with quick stats, recent activity, and promotional content
- **Smart Booking Flow**: Multi-step shipment booking with form validation and draft saving
- **Shipment Management**: Track and manage shipments with real-time updates
- **Quote Generation**: Get instant quotes for vehicle transport services

### Driver Features
- **Driver Dashboard**: Overview of available shipments and earnings
- **Job Management**: Accept and manage transport jobs
- **Route Planning**: Navigate pickup and delivery locations

### Shared Features
- **Role-based Authentication**: Secure login with client/driver role selection
- **Profile Management**: Update personal information and preferences
- **Push Notifications**: Real-time updates on shipment status changes
- **Offline Support**: Access critical features even without internet connectivity
- **Real-time Updates**: Live shipment status and message updates via Supabase subscriptions

## 🚀 Advanced Features

### 1. Push Notifications

DriveDrop now includes push notifications to keep users informed about important updates:

- **Shipment Status Updates**: Receive notifications when a shipment status changes
- **New Messages**: Get notified when someone sends you a message
- **Tracking Events**: Real-time updates for each tracking event in the shipment lifecycle
- **Customizable Preferences**: Users can choose which notifications to receive

#### Implementation Details

- Uses Expo Notifications for cross-platform notifications
- Stores device tokens in the Supabase `push_tokens` table
- Manages user preferences in the `notification_preferences` table
- Configurable through the new Settings screen

### 2. Real-time Updates

The app now uses Supabase's real-time subscription feature to provide live updates:

- **Live Shipment Updates**: Status changes reflected instantly
- **Real-time Chat**: Messages appear immediately without refreshing
- **Tracking Events**: Live updates of package location and status

#### Implementation Details

- Uses Supabase's Realtime Channels to subscribe to database changes
- Separate channels for each shipment to optimize performance
- Automatically updates UI when data changes

### 3. Offline Support

DriveDrop now works offline with automatic sync when connectivity is restored:

- **View Shipments Offline**: Access your shipments even without an internet connection
- **Create Messages Offline**: Queue messages to be sent when back online
- **Sync on Reconnect**: Automatically synchronize when connection is reestablished

#### Implementation Details

- Uses AsyncStorage for local data persistence
- Implements a queue system for offline actions
- Syncs with server when connection is reestablished

### 4. Settings & Preferences Management

A new comprehensive settings screen allows users to:

- **Manage Notification Preferences**: Toggle different notification types
- **Test Notifications**: Send a test notification to verify setup
- **Account Information**: View and manage account details

## 🎨 Design System

The app uses a comprehensive design system with:

### Design Tokens
- **Brand Colors**: Primary blue (#1E88E5) and secondary orange (#FF9800) with full color scales
- **Typography**: Consistent font sizes, weights, and line heights
- **Spacing**: 8-point grid system for consistent layout
- **Shadows**: Elevation system for depth and hierarchy
- **Border Radius**: Consistent corner radius values

### UI Components
- **Button**: Multiple variants (primary, secondary, outline, ghost) and sizes
- **Input**: Form inputs with validation, icons, and helper text
- **Card**: Flexible container component with variants and padding options

## 📱 Booking Flow

The multi-step booking form collects comprehensive shipment information:

### Step 1: Customer Details
- Full name, email, phone, address
- Pre-populated from user profile

### Step 2: Vehicle Information
- Make, model, year, VIN, license plate
- Condition notes and special requirements

### Step 3: Pickup Details
- Address, date/time preferences
- Contact person information

### Step 4: Delivery Details
- Destination address, date/time
- Contact person and special instructions

### Step 5: Towing/Transport
- Vehicle operability status
- Equipment needs and special requirements

### Step 6: Insurance & Documentation
- Proof of ownership upload
- Insurance documentation
- Additional required documents

### Step 7: Visual Documentation
- Vehicle condition photos (front, rear, sides, interior)
- Damage documentation

### Step 8: Terms & Authorization
- Service agreement acceptance
- Cancellation policy review
- Digital signature capture

### State Management
- Uses React Context for form state
- Draft saving and progress tracking
- Step validation and navigation controls

## 🏗️ Technical Architecture

### Tech Stack
- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and build tools
- **TypeScript**: Type-safe development
- **Supabase**: Backend-as-a-service for auth and data
- **React Navigation**: Screen navigation and routing

### Project Structure
```
mobile/
├── src/
│   ├── components/
│   │   └── ui/           # Design system components
│   ├── constants/
│   │   └── DesignSystem.ts # Design tokens and theme
│   ├── context/
│   │   ├── AuthContext.tsx      # Authentication state
│   │   ├── BookingContext.tsx   # Booking form state
│   │   └── NotificationContext.tsx # Notification preferences
│   ├── lib/
│   │   ├── supabase.ts    # Supabase client
│   │   └── database.types.ts # Database type definitions
│   ├── navigation/        # React Navigation setup
│   ├── screens/
│   │   ├── auth/          # Authentication screens
│   │   ├── booking/       # Booking flow screens
│   │   ├── home/          # Dashboard screen
│   │   ├── profile/       # User profile screens
│   │   └── shipments/     # Shipment management screens
│   ├── services/
│   │   ├── NotificationService.ts # Push notification handling
│   │   ├── OfflineService.ts     # Offline data management
│   │   └── RealtimeService.ts    # Real-time subscriptions
│   └── utils/             # Utility functions
└── app.config.js         # Expo configuration
```
│   │   └── BookingContext.tsx   # Booking form state
│   ├── screens/
│   │   ├── auth/         # Login, signup screens
│   │   ├── home/         # Dashboard and home screens
│   │   ├── booking/      # Multi-step booking flow
│   │   ├── shipments/    # Shipment management
│   │   ├── profile/      # User profile screens
│   │   └── driver/       # Driver-specific screens
│   └── navigation/       # Route configuration
├── App.tsx               # Root component with providers
└── package.json
```

## 🚀 Development Setup

## 🚀 Development Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- Android Studio (for Android development)
- Xcode (for iOS development on macOS)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file in the mobile directory:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on device/simulator:
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

## 🎯 Navigation Structure

### Client Navigation (Bottom Tabs)
- **Home**: Dashboard with overview and quick actions
- **New Shipment**: Quote generation form
- **Shipments**: Shipment list with filtering (Pending/Active/Past)
- **Profile**: Account information and settings

### Booking Flow (Stack Navigation)
```
NewShipment (Quote) → BookingStepCustomer → BookingStepVehicle → ... → BookingConfirmation
```

### Driver Navigation (Bottom Tabs)
- **Dashboard**: Available jobs and earnings overview
- **Available**: Browse available shipments
- **My Jobs**: Active and completed jobs
- **Profile**: Driver profile and settings

## 🔧 Extending the App

### Adding New Dashboard Widgets
1. Create widget component in `src/components/dashboard/`
2. Add to home screen configuration
3. Update state management if needed

### Adding New Booking Steps
1. Create step component in `src/screens/booking/`
2. Add to `BookingContext` step order
3. Update navigation types and routes
4. Add validation logic

### Customizing Design System
1. Update tokens in `src/constants/DesignSystem.ts`
2. Create new UI components in `src/components/ui/`
3. Use design tokens for consistency

## 📝 Code Quality

### TypeScript
- Strict typing enforced
- Navigation types for type-safe routing
- Component prop interfaces

### Linting & Formatting
```bash
npm run lint     # Check for linting errors
npm run lint:fix # Auto-fix linting issues
```

### Testing
```bash
npm test         # Run unit tests
npm run test:e2e # Run end-to-end tests
```

## 🚢 Deployment

### Building for Production
```bash
# Build for app stores
expo build:android
expo build:ios

# Or using EAS Build
eas build --platform android
eas build --platform ios
```

### Environment Configuration
- Development: Uses local/staging backend
- Production: Uses production Supabase instance
- Configure different environments in `app.json`

## 🔒 Security

- Secure token storage with Expo SecureStore
- Row Level Security (RLS) policies in Supabase
- Input validation and sanitization
- Biometric authentication support (planned)

## 📊 Analytics & Monitoring

- Crash reporting with Sentry (planned)
- User analytics with Mixpanel (planned)
- Performance monitoring
- Custom event tracking

---

## 🤝 Contributing

1. Follow the established design system
2. Write TypeScript with proper types
3. Add unit tests for new features
4. Update documentation for major changes
5. Follow conventional commit format

## 📱 Device Support

- **iOS**: iOS 13.0+
- **Android**: API Level 21+
- **Tablet**: Responsive design for larger screens
- **Accessibility**: VoiceOver and TalkBack support
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_API_URL=your_api_url
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Development Workflow

1. **Running on a simulator/emulator**:
   ```bash
   npm run ios     # For iOS simulator
   npm run android # For Android emulator
   ```

2. **Running on a physical device**:
   - Install the Expo Go app on your device
   - Scan the QR code from the terminal after running `npm start`

## Building for Production

1. **Create a production build**:
   ```bash
   eas build --platform ios     # For iOS
   eas build --platform android # For Android
   ```

2. **Submit to app stores**:
   ```bash
   eas submit --platform ios     # For iOS App Store
   eas submit --platform android # For Google Play Store
   ```

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is licensed under the terms specified in the LICENSE file at the root of the repository.
