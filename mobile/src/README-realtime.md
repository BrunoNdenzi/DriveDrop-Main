# Supabase Real-Time Subscriptions Implementation

This README documents the implementation of Supabase Real-Time subscriptions for the DriveDrop application.

## Overview

We've implemented real-time features for:
1. Shipment Status Updates
2. Real-Time Messaging
3. Driver Location Tracking

## Implementation Details

### File Structure

The implementation consists of:

- **Service Layer**: `mobile/src/services/RealtimeService.ts` - Core functionality for managing Supabase channels
- **React Hooks**:
  - `mobile/src/hooks/useRealtimeShipment.ts` - For shipment status updates
  - `mobile/src/hooks/useRealtimeMessages.ts` - For real-time messaging
  - `mobile/src/hooks/useDriverLocation.ts` - For driver location tracking
- **Database Migrations**:
  - `supabase/migrations/20250725_driver_locations.sql` - Creates tables and RLS policies for location tracking
  - `supabase/migrations/20250725_realtime_messaging.sql` - Enhances messaging with read status tracking
  - `supabase/migrations/20250726_realtime_shipment_updates.sql` - Adds triggers for shipment status changes

### Key Features

#### 1. Shipment Status Updates
- Real-time notification when shipment status changes
- Automatic creation of tracking events
- React hook to simplify integration in components

#### 2. Real-Time Messaging
- Instant message delivery without polling
- Read status tracking
- Automatic notifications for new messages
- Clean React hook API for components

#### 3. Driver Location Tracking
- Efficient location updates (30-second intervals)
- Automatic cleanup of old location data
- Row-level security for proper access control
- React hook that works for both drivers and clients

## Usage Examples

For detailed usage examples, see the [Real-Time Features Documentation](docs/realtime-features-updated.md).

## Security Considerations

- All tables have proper Row Level Security (RLS) policies
- Drivers can only update their own location
- Clients can only view information related to their shipments
- Automatic data cleanup to maintain privacy

## Performance Optimizations

- Singleton pattern to prevent duplicate subscriptions
- Interval-based location updates to conserve battery
- Database triggers for data cleanup
- Proper subscription lifecycle management

## Implementation Checklist

- [x] Implement real-time subscription for shipment status changes
- [x] Implement real-time messaging subscription
- [x] Implement real-time driver location tracking
- [x] Ensure all subscriptions are cleaned up appropriately
- [x] Test and document example usage for each feature

## Next Steps

See the [Real-Time Features Documentation](docs/realtime-features-updated.md) for planned enhancements.
