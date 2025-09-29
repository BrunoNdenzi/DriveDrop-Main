# Database Schema and API Notes

## Column Mismatches in Shipments Table

When updating shipments, be aware that some fields used in the mobile app are not directly mapped to database columns:

- `special_instructions`: This field is used in the mobile app but doesn't exist in the database schema. When sending this data, store it in the `description` field instead.

- `vehicle_photos`: This array is not stored directly in the shipments table. These should be uploaded separately to storage and referenced.

- `ownership_documents`: Like vehicle photos, these should be uploaded to storage and referenced.

## Using the ShipmentApiService

To avoid issues with column mismatches, use the `ShipmentApiService` class when updating shipments with data that might require special handling:

```typescript
import { ShipmentApiService } from '../services/shipmentApiService';

// Example usage
const session = await supabase.auth.getSession();
await ShipmentApiService.updateShipment(
  shipmentId,
  {
    // Standard database fields
    vehicle_make: 'Toyota',
    vehicle_model: 'Camry',
    
    // Fields requiring special handling
    special_instructions: 'Handle with care', // Will be stored in description
    vehicle_photos: [...photoUrls],
    ownership_documents: [...documentUrls],
  },
  session.data.session?.access_token || ''
);
```

## Database Schema Reference

The shipments table includes the following columns (incomplete list):
- id
- client_id
- driver_id
- status
- title
- description (use this for special_instructions)
- pickup_address
- delivery_address
- vehicle_make
- vehicle_model
- vehicle_year
- is_operable
- payment_status
- payment_intent_id

For the full schema, refer to the SQL schema file.