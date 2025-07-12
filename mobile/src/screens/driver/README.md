# DriveDrop - Driver Interface

This directory contains the implementation of the driver interface for the DriveDrop mobile application. The driver interface provides delivery drivers with a comprehensive set of tools to manage their shipments, track routes, communicate with clients, and update their profile.

## Screens

### 1. Dashboard (`DriverDashboardScreen.tsx`)
- The main landing screen for drivers
- Displays a summary of their job status and quick statistics
- Provides quick access to important features

### 2. Available Jobs (`AvailableJobsScreen.tsx`)
- Lists all available jobs that drivers can apply for
- Displays job details including pickup/delivery locations, estimated earnings, and distance
- Allows drivers to apply for jobs directly

### 3. My Jobs (`MyJobsScreen.tsx`)
- Tabbed interface showing active and completed jobs
- Active tab shows jobs that are accepted, picked up, or in transit
- Completed tab shows successfully delivered jobs
- Each job card displays key information and status

### 4. Job Details (`JobDetailsScreen.tsx`)
- Comprehensive view of a specific job
- Shows client information, pickup/delivery details, and payment information
- Includes buttons to update job status (pickup, in transit, delivered)
- Provides directions and route map options

### 5. Route Map (`RouteMapScreen.tsx`)
- Interactive map showing the route for a specific job
- Displays current location, pickup location, and delivery location
- Shows turn-by-turn directions and estimated arrival time
- Supports external navigation app integration

### 6. Messages (`MessagesScreen.tsx`)
- Messaging interface for communication with clients
- Lists all contacts (clients) on the left
- Chat interface on the right
- Real-time message updates via Supabase

### 7. Driver Profile (`DriverProfileScreen.tsx`)
- Driver profile management
- Shows statistics like completed jobs, rating, and earnings
- Includes availability toggle and preferences settings
- Account management options

## Features

### 1. Job Management
- Apply for available jobs
- Accept/reject job offers
- Update job status (pickup, in transit, delivered)
- View job history and details

### 2. Navigation & Routing
- Interactive maps for route visualization
- Turn-by-turn directions
- Distance and ETA calculations
- Location tracking for job status updates

### 3. Client Communication
- Real-time messaging with clients
- Message history and unread indicators
- Support for images and attachments (future)

### 4. Profile & Settings
- Update personal information
- Set availability status
- Configure notification preferences
- Manage payment information (future)

### 5. Earnings & Statistics
- Track earnings by job
- View performance statistics
- Rating system

## Data Structure

The driver interface integrates with Supabase for data storage and real-time updates:

### Tables:
- `shipments`: Job/shipment information
- `profiles`: User profiles for drivers and clients
- `job_applications`: Records of driver applications to jobs
- `messages`: Communication between drivers and clients
- `shipment_status_history`: History of status changes
- `driver_settings`: Driver preferences and settings
- `driver_ratings`: Ratings received by drivers

## Integration

The driver interface is fully integrated with the rest of the DriveDrop application:
- Shared navigation system with role-based routing
- Common components and styling
- Unified authentication system
- Real-time updates via Supabase

## Future Enhancements

Planned improvements for the driver interface:
- Enhanced route optimization
- Offline support for rural areas
- Multi-stop route planning
- Earnings reports and tax documentation
- Advanced availability scheduling
- Team driving support for large shipments

## Development Notes

- The driver interface uses React Navigation for screen management
- Styling follows the DriveDrop design system with orange accents for the driver interface
- Real-time features utilize Supabase's real-time subscriptions
- Location tracking is handled via the Expo Location API
- Maps integration uses react-native-maps
