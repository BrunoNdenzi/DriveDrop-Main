# Shipment Status Enum Migration Report

## Overview
This document describes the changes made to safely migrate the `shipment_status` enum while properly handling all dependent triggers, functions, Row Level Security (RLS) policies, and default values.

## Problem
The application was using shipment status values ("assigned", "completed") that were not defined in the database enum. PostgreSQL does not allow altering the type of a column that's referenced in triggers or RLS policies, or that has a default value using the enum type, requiring special handling during migration.

## Solution
We implemented a safe migration process following PostgreSQL best practices that:
1. Drops all affected triggers and RLS policies
2. Removes default values before altering the enum type
3. Updates the enum type
4. Restores the column type, default values, triggers, functions, and policies

## Migration Steps Implemented

1. **Drop affected triggers**
   - Identified and dropped two triggers that reference `shipments.status`:
     - `send_shipment_notification`: Used for notifying users of status changes
     - `on_shipment_status_update`: Used for tracking status change history

2. **Drop affected RLS policies**
   - Identified and dropped three policies that reference `shipments.status`:
     - "Clients can update their own shipments"
     - "Drivers can view assigned and available shipments"
     - "Drivers can view available shipments"

3. **Remove default value**
   - Removed the default value from the `shipments.status` column
   - This is necessary before altering the type to avoid dependency errors

4. **Create a new enum type**
   - Created `shipment_status_new` with all required values:
     - 'pending', 'accepted', 'assigned', 'in_transit', 'in_progress', 'delivered', 'completed', 'cancelled'

5. **Convert columns to TEXT**
   - Changed `shipments.status` and `shipment_status_history.status` to TEXT type
   - This preserves the values during the migration

6. **Replace the enum type**
   - Dropped the old `shipment_status` enum
   - Renamed `shipment_status_new` to `shipment_status`

7. **Restore column types**
   - Changed `shipments.status` back to the new enum type
   - Kept `shipment_status_history.status` as TEXT for flexibility

8. **Restore default value**
   - Set the default value for `shipments.status` back to 'pending'
   - This ensures new shipments are created with the correct initial status

9. **Enhance and restore trigger functions**
   - Updated the `handle_shipment_status_update` function to:
     - Support the new 'completed' status value
     - Update the delivered_at timestamp when status changes to either 'delivered' or 'completed'
   
   - Created the `send_shipment_notification_function` to:
     - Handle all status transitions including the new ones
     - Support both 'in_transit' and 'in_progress' as equivalent statuses
     - Support both 'delivered' and 'completed' as completion statuses

10. **Restore triggers**
    - Recreated `on_shipment_status_update` trigger with the same behavior
    - Recreated `send_shipment_notification` trigger with the same behavior

11. **Restore RLS policies**
    - Recreated all three policies with identical logic
    - No changes were made to policy logic as the new values don't affect these specific policies

12. **Add documentation**
    - Added a comment to the enum type explaining all valid values

## Execution Approach
The migration was implemented as a sequence of individual SQL statements rather than using procedural blocks (DO $$...END $$). This approach:
- Follows best practices for DDL operations
- Makes errors easier to identify and fix
- Improves visibility of each step in the migration process

## Trigger Function Enhancements

### handle_shipment_status_update
- Now supports both 'delivered' and 'completed' statuses
- Updates the delivered_at timestamp for either status
- Maintains all previous functionality for existing status values

### send_shipment_notification_function
- Enhanced to handle all new status values
- Sends appropriate notifications for each status change:
  - 'assigned': When a shipment is assigned to a driver
  - 'in_transit'/'in_progress': When a shipment is picked up and in delivery
  - 'delivered'/'completed': When a shipment is successfully delivered
  - 'cancelled': When a shipment is cancelled

## Client-Side Changes
- Updated `ShipmentUtil.ts` with comprehensive status validation
- Added detailed comments for each status value
- Created helper functions to safely update shipment status

## Validation
The migration script has been carefully designed to:
- Drop all triggers and policies that reference the `shipments.status` column
- Remove default values before altering the column type
- Preserve all data during the migration
- Maintain security by restoring all policies with identical logic
- Enhance trigger functionality to support all status values needed by the application
- Execute each step sequentially for better error handling and visibility
- Restore default values to maintain application behavior

## Next Steps
- Run the migration script in the Supabase dashboard
- Verify that all RLS policies and triggers are working as expected
- Test the application to ensure it can use all status values
