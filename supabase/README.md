# Supabase Project Setup

This directory contains the SQL migrations and seed data for the Supabase project that powers DriveDrop's database and authentication.

## Database Schema

The database is designed with the following tables:

- **profiles**: User profiles extending Supabase Auth
- **driver_applications**: Applications for drivers to join the platform
- **vehicle_photos**: Photos of vehicles for driver applications
- **shipments**: Shipment/delivery records
- **tracking_events**: Events that track the progress of shipments
- **messages**: Communication between clients and drivers
- **payments**: Payment records for shipments

## Row Level Security (RLS)

All tables are protected with Row Level Security policies that ensure users can only access data they're authorized to see:

- Clients can only see their own shipments and related data
- Drivers can see their own data and available shipments
- Admins have access to manage all data

## Custom Functions

Several PostgreSQL functions are provided for common operations:

- **accept_shipment**: For drivers to accept a pending shipment
- **create_tracking_event**: Add tracking events to shipments
- **get_nearby_shipments**: Find shipments near a geographic location
- **mark_message_read**: Mark a message as read
- **verify_driver**: Approve a driver application
- **update_payment_status**: Update payment status with webhook data

## Setup Instructions

### Prerequisites

1. Create a Supabase project at https://supabase.com
2. Install the Supabase CLI: `npm install -g supabase`
3. Login to Supabase CLI: `supabase login`

### Setup Steps

1. Initialize Supabase in your project:
   ```
   supabase init
   ```

2. Link to your Supabase project:
   ```
   supabase link --project-ref your-project-ref
   ```

3. Apply migrations to your Supabase project:
   ```
   supabase db push
   ```

4. (Optional) Seed test data:
   ```
   supabase db reset
   ```

## Environment Variables

Add the following to your .env files:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## References

- [Supabase Documentation](https://supabase.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
