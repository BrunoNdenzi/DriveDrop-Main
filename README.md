# DriveDrop

A modern, full-stack file sharing and collaboration platform built with React Native (Expo) and Node.js/Express.

## 🏗️ Project Structure

```
DriveDrop-Main/
├── mobile/          # React Native app (Expo SDK 53)
├── backend/         # Node.js/Express API server
├── .gitignore       # Git ignore rules
└── README.md        # This file
```

## 🎨 Design Philosophy

**"Apply a modern, tech-rich, yet simple and classic UI/UX design throughout all user-facing interfaces."**

We favor:
- **Clean layouts** with purposeful white space and logical information hierarchy
- **Balanced color palettes** that are accessible and professional
- **Intuitive navigation** that follows platform conventions and user expectations
- **Responsive layouts** that work seamlessly across devices and screen sizes
- **Accessibility best practices** including proper contrast ratios, screen reader support, and touch targets

### Recommended Design Systems
- **Mobile**: Custom design tokens with React Native StyleSheet and Expo themes
- **Web (future)**: Material-UI or Ant Design for consistency and rapid development
- **Typography**: System fonts with custom fallbacks for brand consistency
- **Color scheme**: Light/dark mode support with semantic color tokens

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Expo CLI
- For mobile development: Expo Go app on your device or iOS Simulator/Android Emulator

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DriveDrop-Main
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp backend/.env.example backend/.env
   
   # Mobile
   cp mobile/.env.example mobile/.env
   ```

3. **Install dependencies and start both apps**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm install
   npm run dev
   
   # Terminal 2 - Mobile
   cd mobile
   npm install
   npm start
   ```

## 📱 Mobile App (`/mobile`)

React Native app built with Expo SDK 53 and TypeScript.

### Technology Stack
- **Framework**: Expo SDK 53
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: React Context (expandable to Redux Toolkit)
- **Styling**: React Native StyleSheet with design tokens
- **Code Quality**: ESLint + Prettier + TypeScript

### Available Scripts
```bash
npm start         # Start Expo development server
npm run android   # Start on Android device/emulator
npm run ios       # Start on iOS device/simulator
npm run web       # Start web version
npm run build     # Build for production
npm run lint      # Run ESLint
npm run format    # Format code with Prettier
npm run type-check # Run TypeScript type checking
```

### Key Dependencies
- **expo**: ~53.0.17 (Latest SDK)
- **react**: 19.0.0
- **react-native**: 0.79.5
- **@react-navigation/native**: Latest navigation library
- **react-native-reanimated**: Smooth animations
- **react-native-gesture-handler**: Touch gestures

## 🖥️ Backend API (`/backend`)

RESTful API server built with Node.js, Express, TypeScript, and Supabase integration.

### Technology Stack
- **Runtime**: Node.js (Latest LTS)
- **Framework**: Express.js with TypeScript
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Authentication**: JWT + Supabase Auth
- **Security**: Helmet, CORS, Rate limiting
- **Logging**: Morgan + Winston
- **Code Quality**: ESLint + Prettier + TypeScript

### Available Scripts
```bash
npm run dev       # Start development server with hot reload
npm start         # Start production server
npm run build     # Build TypeScript to JavaScript
npm run lint      # Run ESLint
npm run format    # Format code with Prettier
npm run type-check # Run TypeScript type checking
npm run clean     # Clean build directory
npm run test      # Run integration tests
npm run test:supabase # Test Supabase integration
```

### API Endpoints

#### Authentication
```
POST /api/v1/auth/register    # User registration
POST /api/v1/auth/login       # User login
POST /api/v1/auth/refresh-token # Refresh JWT token
POST /api/v1/auth/logout      # User logout
```

#### Users
```
GET  /api/v1/users/me         # Get current user profile
GET  /api/v1/users/:id        # Get user by ID (admin only)
GET  /api/v1/users            # Get all users (admin only)
PUT  /api/v1/users/me         # Update current user profile
GET  /api/v1/users/drivers/nearby # Find nearby drivers
```

#### Shipments
```
GET  /api/v1/shipments        # Get shipments (filtered by user role)
GET  /api/v1/shipments/:id    # Get shipment by ID
POST /api/v1/shipments        # Create new shipment
PUT  /api/v1/shipments/:id/status # Update shipment status
GET  /api/v1/shipments/nearby # Find nearby shipments (drivers)
POST /api/v1/shipments/:id/events # Create tracking event
GET  /api/v1/shipments/:id/events # Get tracking events
```

#### Health & Monitoring
```
GET  /health                  # Basic health check
GET  /health/db              # Database connectivity check
```

### Authentication & Authorization

#### JWT Token Flow
1. **Login/Register**: Returns access token and sets HTTP-only refresh token cookie
2. **Protected Routes**: Require `Authorization: Bearer <token>` header
3. **Token Refresh**: Automatic refresh using HTTP-only cookies
4. **Role-Based Access**: Routes protected by user roles (client, driver, admin)

#### Example Usage
```javascript
// Login
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { accessToken } = await response.json();

// Use token for protected routes
const userResponse = await fetch('/api/v1/users/me', {
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

### Supabase Integration

#### Service Architecture
```
Controllers -> Services -> Supabase Client -> Database
```

#### Key Services
- **`userService`**: User profile management and driver location queries
- **`shipmentService`**: Shipment CRUD operations and geospatial queries
- **`authService`**: Authentication with Supabase Auth integration

#### Database Features
- **Row Level Security (RLS)**: Database-level access control
- **PostGIS Integration**: Geospatial queries for location-based features
- **Real-time Subscriptions**: Live updates for shipment tracking
- **Custom Functions**: Business logic implemented in PostgreSQL

#### Environment Variables
```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-jwt-secret

# Optional
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_MAPS_API_KEY=your-maps-api-key
STRIPE_SECRET_KEY=your-stripe-key
```

### Key Dependencies
- **@supabase/supabase-js**: ^2.50.5 (Supabase client)
- **express**: ^5.1.0 (Web framework)
- **jsonwebtoken**: ^9.0.2 (JWT handling)
- **bcryptjs**: ^3.0.2 (Password hashing)
- **helmet**: ^8.1.0 (Security middleware)
- **cors**: ^2.8.5 (CORS handling)
- **morgan**: ^1.10.0 (Request logging)

### Error Handling
The API returns standardized error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "errors": [] 
  }
}
```

### Testing
```bash
# Run all tests
npm test

# Test Supabase integration specifically
npm run test:supabase

# Check environment configuration
npm run verify:env
```

## 📊 Supabase Integration (`/supabase`)

The project uses Supabase as its primary database, authentication provider, and realtime backend.

### Technology Stack
- **Database**: PostgreSQL with PostGIS extension
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Realtime**: Supabase Realtime for live updates

### Features
- **User Management**: Client and driver profiles with role-based permissions
- **Geospatial Queries**: Find nearby shipments using PostGIS
- **Row Level Security**: Database-level access control policies
- **Custom Functions**: SQL functions for business logic
- **Migrations**: Versioned database schema changes

### Database Schema
- **profiles**: Extended user profiles (clients, drivers, admins)
- **driver_applications**: Driver verification and onboarding
- **vehicle_photos**: Photos of driver vehicles for verification
- **shipments**: Package delivery jobs with locations and details
- **job_applications**: Driver applications for shipments (consolidated table)
- **tracking_events**: Events that track shipment progress
- **messages**: Communication between clients and drivers
- **payments**: Payment records for shipments
- **shipment_applications_view**: View that provides compatibility with older code

### Setup Instructions
1. **Create a Supabase project**
   ```bash
   # Visit https://supabase.com and create a new project
   # Note your project URL and anon key
   ```

2. **Install the Supabase CLI**
   ```bash
   npm install -g supabase
   # or
   brew install supabase/tap/supabase
   ```

3. **Initialize and link your project**
   ```bash
   cd supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   ```

4. **Apply database migrations**
   ```bash
   supabase db push
   # or for development
   supabase db reset
   ```

5. **Seed the database** (optional)
   ```bash
   supabase db seed --db-url YOUR_DATABASE_URL
   ```

6. **Set environment variables**
   ```bash
   # Backend (.env)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Mobile (.env)
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### Authentication Flow
1. **User Registration/Login**: Handled by Supabase Auth
2. **JWT Token Generation**: Automatic via Supabase
3. **Middleware Validation**: Custom middleware validates tokens
4. **Role-Based Access**: Database policies enforce permissions

### Available Database Functions
- `get_drivers_near_location()`: Find drivers within radius
- `get_shipments_near_location()`: Find shipments by location
- `create_tracking_event()`: Add shipment tracking events
- `calculate_shipment_distance()`: Calculate delivery distance

## 🔧 Development Workflow

### Code Quality Standards
Both projects enforce strict code quality with:
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Zero warnings policy with recommended rules
- **Prettier**: Consistent code formatting
- **Git hooks**: Pre-commit linting and formatting (setup recommended)

### Database Development
1. **Schema Changes**: Create migrations in `/supabase/migrations/`
2. **Local Development**: Use `supabase db reset` to apply changes
3. **Testing**: Run `npm run test:supabase` to validate integration
4. **Deployment**: Push changes with `supabase db push`

### Authentication Testing
```bash
# Test authentication flow
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test protected endpoint
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Adding New Resources
1. **Create migration**: Add new table/columns in Supabase
2. **Update types**: Regenerate TypeScript types from schema
3. **Add service methods**: Implement CRUD operations in services
4. **Create controller**: Add route handlers with validation
5. **Protect routes**: Add authentication/authorization middleware
6. **Update tests**: Add integration tests for new endpoints

## 🔐 Security & Best Practices

### Authentication Security
- **JWT Tokens**: Short-lived access tokens with refresh token rotation
- **HTTP-Only Cookies**: Refresh tokens stored securely
- **Role-Based Access Control**: Database-level and application-level permissions
- **Rate Limiting**: Protection against brute force attacks

### Database Security
- **Row Level Security (RLS)**: Enforced at database level
- **Parameterized Queries**: Protection against SQL injection
- **Connection Pooling**: Efficient database connection management
- **Audit Logging**: Track all database changes

### API Security
- **CORS**: Configured for specific origins only
- **Helmet**: Security headers middleware
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Sanitized error responses

## 🧪 Testing

### Backend Testing
```bash
cd backend

# Run all tests
npm test

# Run specific test suites
npm run test:auth        # Authentication tests
npm run test:supabase    # Database integration tests
npm run test:api         # API endpoint tests

# Test coverage
npm run test:coverage
```

### Mobile Testing
```bash
cd mobile

# Run unit tests
npm test

# Run on specific platforms
npm run test:ios
npm run test:android
```

### Integration Testing
The project includes comprehensive integration tests for:
- **Authentication flows**: Registration, login, token refresh
- **Database operations**: CRUD operations with RLS validation
- **API endpoints**: All routes with proper authentication
- **Geospatial queries**: Location-based features with PostGIS

## 📚 API Documentation

### Interactive Documentation
When running in development mode, visit:
- **Swagger UI**: `http://localhost:3000/api/v1/docs` (coming soon)
- **Health Check**: `http://localhost:3000/health`
- **API Info**: `http://localhost:3000/api/v1`

### Postman Collection
Import the provided Postman collection for easy API testing:
```bash
# Located at: /docs/DriveDrop-API.postman_collection.json
```

## 🤝 Contributing

### Development Setup
1. **Fork and clone** the repository
2. **Install dependencies** in both `/backend` and `/mobile`
3. **Set up environment variables** using `.env.example` files
4. **Start local development** servers
5. **Run tests** to ensure everything works

### Code Contribution Guidelines
1. **Follow established code style** (ESLint + Prettier)
2. **Write TypeScript** with strict type checking
3. **Add tests** for new features and bug fixes
4. **Update documentation** for API changes
5. **Test on multiple platforms** for mobile changes
6. **Follow design philosophy** for UI/UX changes

### Database Contributions
1. **Create migrations** for schema changes
2. **Update TypeScript types** after schema changes
3. **Test with RLS policies** to ensure security
4. **Document new functions** and procedures

### Pull Request Process
1. **Create feature branch** from `main`
2. **Make changes** following contribution guidelines
3. **Run full test suite** (`npm test` in both projects)
4. **Update documentation** if needed
5. **Submit pull request** with clear description

### Reporting Issues
- **Use GitHub Issues** for bug reports and feature requests
- **Include reproduction steps** for bugs
- **Specify platform/environment** for mobile issues
- **Check existing issues** before creating new ones

---

## 🎯 Roadmap

### Phase 1: Core Platform (Current)
- ✅ **Backend API**: Express server with Supabase integration
- ✅ **Authentication**: JWT-based auth with role management
- ✅ **Database**: PostgreSQL with PostGIS for geospatial features
- 🔄 **Mobile App**: React Native app with Expo
- 🔄 **Basic Features**: User registration, shipment tracking

### Phase 2: Enhanced Features
- � **Real-time Tracking**: Live shipment location updates
- 📋 **Payment Integration**: Stripe payment processing
- 📋 **Push Notifications**: Real-time updates via Expo notifications
- 📋 **File Uploads**: Photo uploads for shipment verification
- 📋 **Chat System**: In-app messaging between clients and drivers

### Phase 3: Advanced Features
- 📋 **Web Dashboard**: Admin panel for managing platform
- 📋 **Analytics**: Business intelligence and reporting
- 📋 **Multi-language**: Internationalization support
- 📋 **API Rate Limiting**: Advanced security and performance
- 📋 **CI/CD Pipeline**: Automated testing and deployment

## 📞 Support

### Documentation
- **API Documentation**: Available at `/backend/README.md`
- **Mobile Documentation**: Available at `/mobile/README.md`
- **Database Schema**: Available at `/supabase/README.md`

### Getting Help
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community support
- **Email**: [support@drivedrop.com](mailto:support@drivedrop.com)

### Version Information
- **Current Version**: 1.0.0-beta
- **Node.js**: 18+ required
- **Expo SDK**: 53.x
- **Supabase**: Latest stable
- **Last Updated**: July 2025

## �📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using modern technologies for optimal performance and developer experience.**

*DriveDrop - Connecting people through seamless package delivery.*

```
DriveDrop-Main
├─ .qodo
├─ backend
│  ├─ .eslintrc.js
│  ├─ .prettierrc
│  ├─ app.json
│  ├─ docs
│  │  ├─ DRIVER_APPLICATION_API.md
│  │  └─ IMPLEMENTATION_VALIDATION.md
│  ├─ eslint.config.js
│  ├─ nodemon.json
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ README.md
│  ├─ schema.sql
│  ├─ scripts
│  │  ├─ check-driver-api.js
│  │  ├─ check-env.js
│  │  ├─ create-admin-user.js
│  │  ├─ test-driver-endpoints.ts
│  │  ├─ test-supabase.js
│  │  └─ verify-env.js
│  ├─ src
│  │  ├─ config
│  │  │  └─ index.ts
│  │  ├─ controllers
│  │  │  ├─ application.controller.ts
│  │  │  ├─ auth.controller.ts
│  │  │  ├─ health.controller.ts
│  │  │  ├─ maps.controller.ts
│  │  │  ├─ payments.controller.getConfig.ts
│  │  │  ├─ payments.controller.ts
│  │  │  ├─ shipment.controller.ts
│  │  │  ├─ sms.controller.ts
│  │  │  ├─ temp_payments.controller.ts
│  │  │  └─ user.controller.ts
│  │  ├─ index.ts
│  │  ├─ lib
│  │  │  ├─ database.types.ts
│  │  │  └─ supabase.ts
│  │  ├─ middlewares
│  │  │  ├─ auth.middleware.ts
│  │  │  ├─ error.middleware.ts
│  │  │  └─ supabase-auth.middleware.ts
│  │  ├─ register-paths.ts
│  │  ├─ routes
│  │  │  ├─ application.routes.ts
│  │  │  ├─ auth.routes.ts
│  │  │  ├─ diagnostics.routes.ts
│  │  │  ├─ driver.routes.ts
│  │  │  ├─ health.routes.ts
│  │  │  ├─ index.ts
│  │  │  ├─ maps.routes.ts
│  │  │  ├─ payments.routes.bak.ts
│  │  │  ├─ payments.routes.ts
│  │  │  ├─ shipment.routes.ts
│  │  │  ├─ sms.routes.ts
│  │  │  └─ user.routes.ts
│  │  ├─ services
│  │  │  ├─ auth.service.ts
│  │  │  ├─ google-maps.service.ts
│  │  │  ├─ stripe.service.ts
│  │  │  ├─ supabase.service.ts
│  │  │  └─ twilio.service.ts
│  │  ├─ types
│  │  │  └─ api.types.ts
│  │  └─ utils
│  │     ├─ error.ts
│  │     ├─ logger.ts
│  │     ├─ response.ts
│  │     ├─ supabase-test.ts
│  │     └─ validation.ts
│  ├─ tests
│  │  └─ driver-application.integration.test.ts
│  └─ tsconfig.json
├─ docs
│  ├─ application-consolidation-plan.md
│  ├─ application-management-implementation.md
│  ├─ AUTH-UNIFICATION.md
│  ├─ HEALTH-ENDPOINTS.md
│  ├─ MIGRATION_FIX_FUNCTION_COLLISION.md
│  ├─ realtime-features-updated.md
│  ├─ realtime-features.md
│  └─ SECRETS-MANAGEMENT.md
├─ DRIVE_DROP_CHECKLIST.md
├─ DRIVE_DROP_PLAN.md
├─ ENHANCEMENT_SUMMARY.md
├─ fix_payments_policy.sql
├─ LICENSE
├─ mobile
│  ├─ .eslintignore
│  ├─ .eslintrc.js
│  ├─ .prettierrc
│  ├─ app.config.js
│  ├─ app.json
│  ├─ App.tsx
│  ├─ assets
│  │  ├─ adaptive_icon.png
│  │  ├─ favicon.png
│  │  ├─ icon.png
│  │  ├─ notification_icon.png
│  │  ├─ notification_sound.wav
│  │  ├─ splash.png
│  │  └─ splash_icon.png
│  ├─ docs
│  │  └─ enhancements-summary.md
│  ├─ eas-build.json
│  ├─ eas.json
│  ├─ eslint.config.js
│  ├─ image1.jpg
│  ├─ image2.jpg
│  ├─ image3.jpg
│  ├─ image4.jpg
│  ├─ index.ts
│  ├─ integration-test.ts
│  ├─ package.json
│  ├─ PAYMENT_POLICY_IMPLEMENTATION.md
│  ├─ README.md
│  ├─ refactors
│  │  └─ AdminAssignmentScreen.refactor.md
│  ├─ scripts
│  │  ├─ preinstall.sh
│  │  ├─ verify-env.js
│  │  └─ verify-mobile-env.js
│  ├─ src
│  │  ├─ components
│  │  │  ├─ AdminAssignmentHeader.tsx
│  │  │  ├─ AdminAssignmentHeader.tsx.bak
│  │  │  ├─ Button.tsx
│  │  │  ├─ Button.tsx.bak
│  │  │  ├─ Card.tsx
│  │  │  ├─ Card.tsx.bak
│  │  │  ├─ DriverSelectionModal.tsx
│  │  │  ├─ DriverSelectionModal.tsx.bak
│  │  │  ├─ index.ts
│  │  │  ├─ Loading.tsx
│  │  │  ├─ Loading.tsx.bak
│  │  │  ├─ payment
│  │  │  │  ├─ PaymentPolicyCard.tsx
│  │  │  │  ├─ PaymentPolicyCard.tsx.bak
│  │  │  │  ├─ PAYMENT_COMPONENT_USAGE.md
│  │  │  │  ├─ StripePaymentForm.tsx
│  │  │  │  └─ StripePaymentForm.tsx.bak
│  │  │  ├─ PaymentPolicyCard.tsx
│  │  │  ├─ PaymentPolicyCard.tsx.bak
│  │  │  ├─ ShipmentList.tsx
│  │  │  ├─ ShipmentList.tsx.bak
│  │  │  ├─ ShipmentListItem.tsx
│  │  │  ├─ ShipmentListItem.tsx.bak
│  │  │  ├─ ShipmentSummary.tsx
│  │  │  ├─ ShipmentSummary.tsx.bak
│  │  │  ├─ TextInput.tsx
│  │  │  ├─ TextInput.tsx.bak
│  │  │  ├─ ui
│  │  │  │  ├─ Button.tsx
│  │  │  │  ├─ Button.tsx.bak
│  │  │  │  ├─ Card.tsx
│  │  │  │  ├─ Card.tsx.bak
│  │  │  │  ├─ Input.tsx
│  │  │  │  └─ Input.tsx.bak
│  │  │  ├─ UserProfile.tsx
│  │  │  └─ UserProfile.tsx.bak
│  │  ├─ constants
│  │  │  ├─ Colors.ts
│  │  │  ├─ Colors.ts.bak
│  │  │  ├─ DesignSystem.ts
│  │  │  ├─ DesignSystem.ts.bak
│  │  │  ├─ Expo.ts
│  │  │  └─ index.ts
│  │  ├─ context
│  │  │  ├─ AuthContext.tsx
│  │  │  ├─ AuthContext.tsx.bak
│  │  │  ├─ BookingContext.tsx
│  │  │  └─ BookingContext.tsx.bak
│  │  ├─ contexts
│  │  │  ├─ NotificationContext.tsx
│  │  │  └─ NotificationContext.tsx.bak
│  │  ├─ db
│  │  │  ├─ dbUtils.ts
│  │  │  └─ dbUtils.ts.bak
│  │  ├─ examples
│  │  │  ├─ ShipmentDetailsWithRealtime.tsx
│  │  │  └─ ShipmentDetailsWithRealtime.tsx.bak
│  │  ├─ hooks
│  │  │  ├─ index.ts
│  │  │  ├─ useAPI.ts
│  │  │  ├─ useAPI.ts.bak
│  │  │  ├─ useDriverLocation.ts
│  │  │  ├─ useDriverLocation.ts.bak
│  │  │  ├─ useFetch.ts
│  │  │  ├─ useFetch.ts.bak
│  │  │  ├─ useRealtimeMessages.ts
│  │  │  ├─ useRealtimeMessages.ts.bak
│  │  │  ├─ useRealtimeShipment.ts
│  │  │  ├─ useRealtimeShipment.ts.bak
│  │  │  ├─ useRoleCheck.ts
│  │  │  ├─ useRoleCheck.tsx
│  │  │  └─ useRoleCheck.tsx.bak
│  │  ├─ lib
│  │  │  ├─ database.types.ts
│  │  │  ├─ database.types.update.ts
│  │  │  ├─ database.types.update.ts.bak
│  │  │  ├─ supabase.ts
│  │  │  └─ supabase.ts.bak
│  │  ├─ navigation
│  │  │  ├─ index.tsx
│  │  │  ├─ index.tsx.bak
│  │  │  └─ types.ts
│  │  ├─ README-realtime.md
│  │  ├─ screens
│  │  │  ├─ admin
│  │  │  │  ├─ AdminAssignmentScreen.tsx
│  │  │  │  ├─ AdminAssignmentScreen.tsx.bak
│  │  │  │  ├─ AdminDashboardScreen.tsx
│  │  │  │  ├─ AdminDashboardScreen.tsx.bak
│  │  │  │  ├─ AdminDashboardScreenNew.tsx
│  │  │  │  └─ AdminDashboardScreenNew.tsx.bak
│  │  │  ├─ auth
│  │  │  │  ├─ ForgotPasswordScreen.tsx
│  │  │  │  ├─ ForgotPasswordScreen.tsx.bak
│  │  │  │  ├─ LoginScreen.tsx
│  │  │  │  ├─ LoginScreen.tsx.bak
│  │  │  │  ├─ SignUpScreen.tsx
│  │  │  │  └─ SignUpScreen.tsx.bak
│  │  │  ├─ booking
│  │  │  │  ├─ BookingConfirmationScreen.tsx
│  │  │  │  ├─ BookingConfirmationScreen.tsx.bak
│  │  │  │  ├─ BookingPaymentProcessingScreen.tsx
│  │  │  │  ├─ BookingPaymentProcessingScreen.tsx.bak
│  │  │  │  ├─ BookingStepCustomerScreen.tsx
│  │  │  │  ├─ BookingStepCustomerScreen.tsx.bak
│  │  │  │  ├─ BookingStepDeliveryScreen.tsx
│  │  │  │  ├─ BookingStepDeliveryScreen.tsx.bak
│  │  │  │  ├─ BookingStepInsuranceScreen.tsx
│  │  │  │  ├─ BookingStepInsuranceScreen.tsx.bak
│  │  │  │  ├─ BookingStepPaymentScreen.tsx
│  │  │  │  ├─ BookingStepPaymentScreen.tsx.bak
│  │  │  │  ├─ BookingStepPickupScreen.tsx
│  │  │  │  ├─ BookingStepPickupScreen.tsx.bak
│  │  │  │  ├─ BookingStepTermsScreen.tsx
│  │  │  │  ├─ BookingStepTermsScreen.tsx.bak
│  │  │  │  ├─ BookingStepTowingScreen.tsx
│  │  │  │  ├─ BookingStepTowingScreen.tsx.bak
│  │  │  │  ├─ BookingStepVehicleScreen.tsx
│  │  │  │  ├─ BookingStepVehicleScreen.tsx.bak
│  │  │  │  ├─ BookingStepVisualScreen.tsx
│  │  │  │  └─ BookingStepVisualScreen.tsx.bak
│  │  │  ├─ debug
│  │  │  │  ├─ TestInputScreen.tsx
│  │  │  │  └─ TestInputScreen.tsx.bak
│  │  │  ├─ driver
│  │  │  │  ├─ AvailableJobsScreen.tsx
│  │  │  │  ├─ AvailableJobsScreen.tsx.bak
│  │  │  │  ├─ AvailableShipmentsScreen.tsx
│  │  │  │  ├─ AvailableShipmentsScreen.tsx.bak
│  │  │  │  ├─ DriverDashboardScreen.tsx
│  │  │  │  ├─ DriverDashboardScreen.tsx.bak
│  │  │  │  ├─ DriverProfileScreen.tsx
│  │  │  │  ├─ DriverProfileScreen.tsx.bak
│  │  │  │  ├─ JobDetailsScreen.tsx
│  │  │  │  ├─ JobDetailsScreen.tsx.bak
│  │  │  │  ├─ MessagesScreen.tsx
│  │  │  │  ├─ MessagesScreen.tsx.bak
│  │  │  │  ├─ MyJobsScreen.tsx
│  │  │  │  ├─ MyJobsScreen.tsx.bak
│  │  │  │  ├─ MyShipmentsScreen.tsx
│  │  │  │  ├─ MyShipmentsScreen.tsx.bak
│  │  │  │  ├─ README.md
│  │  │  │  ├─ RouteMapScreen.tsx
│  │  │  │  ├─ RouteMapScreen.tsx.bak
│  │  │  │  ├─ ShipmentDetailsScreen.tsx
│  │  │  │  └─ ShipmentDetailsScreen.tsx.bak
│  │  │  ├─ home
│  │  │  │  ├─ HomeScreen.tsx
│  │  │  │  ├─ HomeScreen.tsx.bak
│  │  │  │  ├─ HomeScreenNew.tsx
│  │  │  │  └─ HomeScreenNew.tsx.bak
│  │  │  ├─ NetworkDiagnosticScreen.tsx
│  │  │  ├─ NetworkDiagnosticScreen.tsx.bak
│  │  │  ├─ NotificationTestScreen.tsx
│  │  │  ├─ NotificationTestScreen.tsx.bak
│  │  │  ├─ profile
│  │  │  │  ├─ ProfileScreen.tsx
│  │  │  │  ├─ ProfileScreen.tsx.bak
│  │  │  │  ├─ ProfileScreenNew.tsx
│  │  │  │  └─ ProfileScreenNew.tsx.bak
│  │  │  ├─ SettingsScreen.tsx
│  │  │  ├─ SettingsScreen.tsx.bak
│  │  │  └─ shipments
│  │  │     ├─ NewShipmentScreen.tsx
│  │  │     ├─ NewShipmentScreen.tsx.bak
│  │  │     ├─ ShipmentDetailsScreen.tsx
│  │  │     ├─ ShipmentDetailsScreen.tsx.bak
│  │  │     ├─ ShipmentsScreen.tsx
│  │  │     ├─ ShipmentsScreen.tsx.bak
│  │  │     ├─ ShipmentsScreenNew.tsx
│  │  │     └─ ShipmentsScreenNew.tsx.bak
│  │  ├─ services
│  │  │  ├─ applicationService.ts
│  │  │  ├─ applicationService.ts.bak
│  │  │  ├─ NotificationService.ts
│  │  │  ├─ NotificationService.ts.bak
│  │  │  ├─ OfflineService.ts
│  │  │  ├─ OfflineService.ts.bak
│  │  │  ├─ paymentApiTest.ts
│  │  │  ├─ paymentApiTest.ts.bak
│  │  │  ├─ paymentService.ts
│  │  │  ├─ paymentService.ts.bak
│  │  │  ├─ RealtimeService.ts
│  │  │  ├─ RealtimeService.ts.bak
│  │  │  ├─ shipmentService.ts
│  │  │  └─ shipmentService.ts.bak
│  │  ├─ sql
│  │  │  └─ job_applications_schema.sql
│  │  ├─ supabase.ts
│  │  ├─ theme
│  │  │  ├─ colors.ts
│  │  │  └─ colors.ts.bak
│  │  ├─ types
│  │  │  ├─ app.d.ts
│  │  │  ├─ index.ts
│  │  │  ├─ shipment.ts
│  │  │  ├─ shipment.ts.bak
│  │  │  ├─ shipment.types.ts
│  │  │  └─ user.ts
│  │  └─ utils
│  │     ├─ environment.ts
│  │     ├─ formatters.ts
│  │     ├─ index.ts
│  │     ├─ logger.ts
│  │     ├─ maps.ts
│  │     ├─ MessageUtil.ts
│  │     ├─ MessageUtil.ts.bak
│  │     ├─ NetworkUtil.ts
│  │     ├─ paymentApiTest.ts
│  │     ├─ paymentApiTest.ts.bak
│  │     ├─ ShipmentUtil.ts
│  │     ├─ ShipmentUtil.ts.bak
│  │     ├─ storage.ts
│  │     └─ validation.ts
│  ├─ supabase
│  │  └─ config.toml
│  ├─ t002_results.md
│  ├─ T003_PRIORITIZED_FIXES.md
│  ├─ t003_results.md
│  ├─ test-shipment-data.js
│  ├─ tsconfig.json
│  ├─ TYPESCRIPT_FIXES.md
│  └─ yarn.lock
├─ MOBILE_NETWORK_FIX.md
├─ PAYMENT_SYSTEM_ENHANCEMENT.md
├─ PAYMENT_SYSTEM_FIX_SUMMARY.md
├─ README.md
├─ scripts
│  ├─ admin-auth-helper.js
│  ├─ apply-migration-fix.js
│  ├─ auth-helper.js
│  ├─ generate-secrets.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ README.md
│  ├─ temp_restart.txt
│  ├─ test-api-auth.bat
│  ├─ test-api-auth.ps1
│  ├─ test-api-endpoint.js
│  ├─ test-api-robust.js
│  ├─ test-api-with-auth-final.js
│  ├─ test-api-with-auth.js
│  ├─ test-api.bat
│  ├─ test-applications-endpoint.js
│  ├─ test-health-curl.ps1
│  ├─ test-health-only.js
│  ├─ test-health.bat
│  ├─ test-health.ps1
│  ├─ test-invalid-shipment-status.js
│  ├─ test-quick-auth.js
│  └─ validate-token.js
├─ sql
│  ├─ add_open_status_to_enum.sql
│  ├─ add_updated_by_field.sql
│  ├─ all_fixes.sql
│  ├─ alternative_phase3.sql
│  ├─ BACKEND_IMPLEMENTATION_SUMMARY.md
│  ├─ check_profiles.sql
│  ├─ check_profiles_table.sql
│  ├─ COMPLETION_SUMMARY.md
│  ├─ create_user_trigger.sql
│  ├─ database_fixes.sql
│  ├─ database_functions.sql
│  ├─ debug_user_creation.sql
│  ├─ DriveDrop_Prioritized_Checklist_Version2.md
│  ├─ eliminate_status_change.sql
│  ├─ ENHANCEMENT_SUMMARY.md
│  ├─ FIXES-SUMMARY.md
│  ├─ fix_additional_issues.sql
│  ├─ fix_driver_errors.md
│  ├─ fix_driver_settings.sql
│  ├─ fix_messaging.sql
│  ├─ fix_payments_policy.sql
│  ├─ fix_profiles_policy.sql
│  ├─ fix_shipment_assignment.sql
│  ├─ fix_tracking_enum.sql
│  ├─ fix_tracking_enum_comprehensive.sql
│  ├─ fix_triggers.sql
│  ├─ FUNCTION_COLLISION_FIX_SUMMARY.md
│  ├─ HEALTH-ENDPOINT-FIX.md
│  ├─ MOBILE_NETWORK_FIX.md
│  ├─ PAYMENT_SYSTEM_ENHANCEMENT.md
│  ├─ PAYMENT_SYSTEM_FIX_SUMMARY.md
│  ├─ phase1_setup.sql
│  ├─ phase2_driver_assignment.sql
│  ├─ phase3_update_data.sql
│  ├─ phase4_recreate_triggers.sql
│  ├─ REALTIME-IMPLEMENTATION.md
│  ├─ sample_data.sql
│  ├─ SECTION_2.2_COMPLETION_SUMMARY.md
│  ├─ shipment_status_migration_report.md
│  ├─ simple_user_trigger.sql
│  ├─ start-and-test-backend.bat
│  ├─ start-app.bat
│  ├─ start-app.sh
│  ├─ start-testing.sh
│  └─ update_user_trigger.sql
├─ supabase
│  ├─ migrations
│  │  ├─ 01_initial_schema.sql
│  │  ├─ 02_row_level_security.sql
│  │  ├─ 03_fix_shipments.sql
│  │  ├─ 03_functions_and_triggers.sql
│  │  ├─ 04_consolidate_application_tables.sql
│  │  ├─ 04_fix_shipment_status_enum.sql
│  │  ├─ 05_application_management_procedures.sql
│  │  ├─ 05_application_management_procedures_production.sql
│  │  ├─ 05_fix_messages_rls.sql
│  │  ├─ 06_add_enum_helper_function.sql
│  │  ├─ 07_add_exec_sql_function.sql
│  │  ├─ 08_add_picked_up_status.sql
│  │  ├─ 20250725_driver_locations.sql
│  │  ├─ 20250725_realtime_messaging.sql
│  │  ├─ 20250726_realtime_shipment_updates.sql
│  │  ├─ 20250729_enhanced_payments.sql
│  │  ├─ 20250729_fix_payment_rls.sql
│  │  ├─ 20250729_fix_user_id_client_id.sql
│  │  ├─ test_function_cleanup.sql
│  │  ├─ verify_application_procedures.sql
│  │  ├─ verify_application_procedures_production.sql
│  │  └─ verify_consolidation.sql
│  ├─ README.md
│  ├─ Schema.sql
│  └─ seed
│     └─ 01_example_data.sql
├─ t001_audit.bat
├─ t001_audit.sh
├─ t001_audit_safe.bat
├─ t002_autolint.ps1
├─ t003_admin_followup
└─ y

```