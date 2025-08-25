# DriveDrop API Backend

The backend for the DriveDrop application, providing RESTful APIs for shipment tracking, user management, and more.

## Features

- **User authentication and authorization** with Supabase Auth and custom JWT
- **Shipment tracking and management** with real-time location updates
- **Geospatial queries** for shipment location using PostGIS
- **Role-based access control** (client, driver, admin)
- **Error handling and logging** with structured error responses
- **Fully typed with TypeScript** for enhanced development experience

## Technology Stack

- **Node.js + Express** - Web framework
- **TypeScript** - Type safety and enhanced development
- **Supabase** - Database, authentication, and real-time features
  - PostgreSQL with PostGIS extension for geospatial data
  - Row Level Security (RLS) for data access control
  - Real-time subscriptions
- **JWT Authentication** - Custom and Supabase token validation
- **RESTful API design** - Standard HTTP methods and status codes

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Supabase account and project

### Environment Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update the `.env` file with your Supabase credentials:

```bash
# Required Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Authentication
JWT_SECRET=your-custom-jwt-secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=30d
```

### Installation

```bash
# Install dependencies
npm install

# Run environment checks
yarn run check:node

# Build TypeScript
yarn run build

# Run in development mode
yarn run dev

# Run in production mode
yarn run start
```

### Supabase Setup

1. **Database Migration**: Run the SQL migrations in your Supabase project:
   ```sql
   -- Located in /supabase/migrations/
   -- 01_initial_schema.sql
   -- 02_row_level_security.sql  
   -- 03_functions_and_triggers.sql
   ```

2. **Test Integration**:
   ```bash
   yarn run build && node scripts/test-supabase.js
   ```

## API Documentation

### Authentication

The API supports two authentication methods:

1. **Custom JWT** (recommended for mobile apps)
2. **Supabase JWT** (for web applications)

#### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "YourPassword123"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "YourPassword123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "client",
  "phone": "+1234567890"
}
```

#### Using Authentication

Include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Users

#### Get Current User Profile

```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

#### Update Profile

```http
PUT /api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890"
}
```

#### Find Nearby Drivers (Client only)

```http
GET /api/v1/users/drivers/nearby?lat=37.7749&lng=-122.4194&radius=10
Authorization: Bearer <token>
```

#### Get Users (Admin only)

```http
GET /api/v1/users?page=1&limit=10&role=driver
Authorization: Bearer <token>
```

### Shipments

#### Create Shipment (Client only)

```http
POST /api/v1/shipments
Authorization: Bearer <token>
Content-Type: application/json

{
  "pickup_location": {"lat": 37.7749, "lng": -122.4194},
  "delivery_location": {"lat": 37.7849, "lng": -122.4094},
  "pickup_address": "123 Main St, San Francisco, CA",
  "delivery_address": "456 Oak Ave, San Francisco, CA",
  "description": "Important documents",
  "estimated_price": 25.00,
  "scheduled_pickup": "2025-07-15T10:00:00Z"
}
```

#### Get Shipments

```http
GET /api/v1/shipments?page=1&limit=10&status=pending&clientId=uuid
Authorization: Bearer <token>
```

#### Update Shipment Status (Driver/Admin)

```http
PATCH /api/v1/shipments/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "accepted"
}
```

#### Find Nearby Shipments (Driver only)

```http
GET /api/v1/shipments/nearby?lat=37.7749&lng=-122.4194&radius=20&status=pending
Authorization: Bearer <token>
```

#### Get Shipment Tracking

```http
GET /api/v1/shipments/:id/tracking
Authorization: Bearer <token>
```

#### Create Tracking Event

```http
POST /api/v1/shipments/:id/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventType": "pickup",
  "location": {"lat": 37.7749, "lng": -122.4194},
  "notes": "Package picked up from warehouse"
}
```

## Authentication & Authorization

### Role-Based Access Control

The API implements three user roles:

- **Client**: Can create shipments, view their own shipments, find nearby drivers
- **Driver**: Can view available shipments, accept shipments, update tracking
- **Admin**: Full access to all resources and user management

### Middleware

1. **authenticate**: Validates JWT tokens and attaches user to request
2. **authorize(roles)**: Restricts access to specific roles
3. **validateResourceOwnership**: Ensures users can only access their own resources

Example middleware usage:
```typescript
// Protect route for authenticated users only
router.get('/profile', authenticate, getProfile);

// Restrict to specific roles
router.get('/admin', authenticate, authorize(['admin']), getAdminData);

// Resource ownership validation
router.get('/shipments/:id', authenticate, validateResourceOwnership(), getShipment);
```

### Supabase Integration

The backend integrates with Supabase for:

1. **Database Operations**: CRUD operations with type safety
2. **Authentication**: User registration, login, token validation
3. **Row Level Security**: Database-level access control
4. **Real-time Features**: Live updates for shipment tracking
5. **Geospatial Queries**: PostGIS functions for location-based features

### Custom Services

- **userService**: User profile management, nearby drivers search
- **shipmentService**: Shipment CRUD, status updates, proximity queries
- **authService**: Login, registration, token management

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE", 
    "message": "Error description",
    "errors": []
  }
}
```

Common error codes:
- `UNAUTHORIZED`: Authentication required or invalid token
- `FORBIDDEN`: Permission denied for the requested resource
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid input data
- `DATABASE_ERROR`: Database operation failed
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Development

### Scripts

- `npm run dev`: Development mode with hot reloading
- `npm run build`: Build TypeScript to JavaScript
- `npm run start`: Production mode
- `npm run lint`: ESLint code analysis
- `npm run format`: Prettier code formatting
- `npm run check:node`: Verify Node.js version compatibility

### Testing

```bash
# Test Supabase integration
npm run build && node scripts/test-supabase.js

# Environment validation
npm run verify:env
```

### Project Structure

```
src/
├── config/           # Environment configuration
├── controllers/      # Route controllers with business logic
├── lib/              # External service integrations
│   ├── supabase.ts   # Supabase client configuration
│   └── database.types.ts # Generated database types
├── middlewares/      # Express middlewares
│   ├── auth.middleware.ts # JWT authentication
│   ├── supabase-auth.middleware.ts # Supabase JWT auth
│   └── error.middleware.ts # Error handling
├── routes/           # API route definitions
├── services/         # Business logic and data access
│   ├── supabase.service.ts # Database operations
│   └── auth.service.ts # Authentication logic
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
│   ├── supabase-test.ts # Integration testing
│   ├── validation.ts # Input validation
│   └── response.ts   # Response formatting
└── index.ts          # Application entry point
```

### Adding New Resources

1. **Define types** in `src/types/api.types.ts`
2. **Create service methods** in `src/services/supabase.service.ts`
3. **Add controller functions** in `src/controllers/`
4. **Define routes** in `src/routes/`
5. **Add authentication/authorization** as needed
6. **Update API documentation**

Example:
```typescript
// 1. Types
export interface Vehicle {
  id: string;
  driver_id: string;
  type: VehicleType;
  // ...
}

// 2. Service
export const vehicleService = {
  async getVehicleById(id: string) {
    // Implementation
  }
};

// 3. Controller
export const getVehicle = asyncHandler(async (req: Request, res: Response) => {
  // Implementation
});

// 4. Routes
router.get('/:id', authenticate, authorize(['driver', 'admin']), getVehicle);
```

## Deployment

### Environment Variables

Ensure all required environment variables are set:

```bash
# Core
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
JWT_SECRET=your-strong-secret-key
```

### Health Checks

Monitor application health:

```http
GET /health          # Basic health check
GET /health/db       # Database connectivity check
```

## License

This project is licensed under the terms specified in the main repository.
