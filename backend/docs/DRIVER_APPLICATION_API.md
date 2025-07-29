# Driver Application API Documentation

This document describes the REST API endpoints for driver job applications in the DriveDrop system.

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Apply for Shipment

Apply for a specific shipment as a driver.

**Endpoint:** `POST /api/v1/shipments/:id/apply`

**Access:** Private (Driver only)

**Parameters:**
- `id` (URL parameter): UUID of the shipment to apply for

**Request Body:**
```json
{
  "notes": "Optional application notes from the driver"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "shipment_id": "550e8400-e29b-41d4-a716-446655440001",
    "driver_id": "550e8400-e29b-41d4-a716-446655440002",
    "status": "pending",
    "notes": "I'm available and have experience with similar deliveries",
    "applied_at": "2025-07-23T10:30:00Z",
    "is_new_application": true
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid shipment ID, shipment not available, or already assigned
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Only drivers can apply for shipments
- `404 Not Found`: Shipment not found

**Example Usage:**
```bash
curl -X POST "https://api.drivedrop.com/api/v1/shipments/550e8400-e29b-41d4-a716-446655440001/apply" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "I have a refrigerated truck suitable for this delivery"
  }'
```

### 2. Get Driver Applications

Retrieve all job applications for the authenticated driver.

**Endpoint:** `GET /api/v1/drivers/applications`

**Access:** Private (Driver only)

**Query Parameters:**
- `status` (optional): Filter by application status (`pending`, `accepted`, `rejected`, `cancelled`)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "shipment_id": "550e8400-e29b-41d4-a716-446655440001",
      "driver_id": "550e8400-e29b-41d4-a716-446655440002",
      "status": "pending",
      "notes": "I'm available and have experience with similar deliveries",
      "applied_at": "2025-07-23T10:30:00Z",
      "updated_at": "2025-07-23T10:30:00Z",
      "shipment_title": "Furniture Delivery - Downtown to Suburbs",
      "shipment_pickup_address": "123 Main St, Downtown",
      "shipment_delivery_address": "456 Oak Ave, Suburbs",
      "shipment_estimated_price": 150.00,
      "shipment_status": "pending"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "shipment_id": "550e8400-e29b-41d4-a716-446655440004",
      "driver_id": "550e8400-e29b-41d4-a716-446655440002",
      "status": "accepted",
      "notes": "Perfect timing for my route",
      "applied_at": "2025-07-22T14:15:00Z",
      "updated_at": "2025-07-22T16:45:00Z",
      "shipment_title": "Electronics Delivery",
      "shipment_pickup_address": "789 Tech Blvd",
      "shipment_delivery_address": "321 Home St",
      "shipment_estimated_price": 75.00,
      "shipment_status": "assigned"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Only drivers can view their applications
- `500 Internal Server Error`: Database error

**Example Usage:**
```bash
# Get all applications
curl -X GET "https://api.drivedrop.com/api/v1/drivers/applications" \
  -H "Authorization: Bearer <jwt_token>"

# Get only pending applications
curl -X GET "https://api.drivedrop.com/api/v1/drivers/applications?status=pending" \
  -H "Authorization: Bearer <jwt_token>"
```

### 3. Update Application Status

Update the status of a driver's application. Admins can accept/reject applications, drivers can cancel their own applications.

**Endpoint:** `PUT /api/v1/applications/:id/status`

**Access:** Private (Admin or Driver with restrictions)

**Parameters:**
- `id` (URL parameter): UUID of the application to update

**Request Body:**
```json
{
  "status": "accepted|rejected|cancelled",
  "notes": "Optional status update notes"
}
```

**Access Rules:**
- **Admins**: Can set status to `pending`, `accepted`, or `rejected`
- **Drivers**: Can only set status to `cancelled` for their own applications

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "shipment_id": "550e8400-e29b-41d4-a716-446655440001", 
    "driver_id": "550e8400-e29b-41d4-a716-446655440002",
    "status": "accepted",
    "notes": "Driver has excellent ratings and is available",
    "applied_at": "2025-07-23T10:30:00Z",
    "updated_at": "2025-07-23T12:45:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid application ID or status
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions or trying to update another driver's application
- `404 Not Found`: Application not found

**Example Usage:**

**Admin accepting an application:**
```bash
curl -X PUT "https://api.drivedrop.com/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/status" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "accepted",
    "notes": "Driver has excellent ratings and availability matches requirements"
  }'
```

**Driver cancelling their own application:**
```bash
curl -X PUT "https://api.drivedrop.com/api/v1/applications/550e8400-e29b-41d4-a716-446655440000/status" \
  -H "Authorization: Bearer <driver_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "notes": "No longer available for this time slot"
  }'
```

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common error codes:
- `INVALID_ID`: Invalid UUID format
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `ALREADY_ASSIGNED`: Shipment already has a driver
- `NOT_AVAILABLE`: Shipment not available for applications
- `APPLICATION_FAILED`: Application creation failed
- `UPDATE_FAILED`: Status update failed
- `DATABASE_ERROR`: Database operation failed

## Business Logic

### Application Workflow

1. **Driver applies** for a shipment using `POST /shipments/:id/apply`
2. **Driver can view** all their applications using `GET /drivers/applications`
3. **Admin reviews** applications and updates status using `PUT /applications/:id/status`
4. **Driver can cancel** their own applications using `PUT /applications/:id/status`

### Automatic Shipment Assignment

When an admin accepts an application (`status: "accepted"`), the system automatically:
- Updates the shipment status to "assigned"
- Sets the shipment's driver_id to the accepted driver
- Rejects all other pending applications for that shipment

### Status Transitions

Valid status transitions:
- `pending` → `accepted` (Admin only)
- `pending` → `rejected` (Admin only)  
- `pending` → `cancelled` (Driver only, for their own applications)
- `accepted` → `rejected` (Admin only, if needed)

### Data Validation

- All UUIDs are validated for proper format
- Status values are validated against allowed values
- Drivers can only access their own applications
- Shipments must be in "pending" status to accept new applications

## Integration with Stored Procedures

These endpoints utilize the following PostgreSQL stored procedures:
- `apply_for_shipment(p_shipment_id, p_driver_id, p_notes)`
- `get_driver_applications(p_driver_id, p_status)`
- `update_application_status(p_application_id, p_status, p_notes)`

The stored procedures handle all business logic, data validation, and maintain referential integrity.
