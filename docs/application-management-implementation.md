# Driver Application Management Implementation

## Overview
This implementation enhances the driver application system by ensuring all necessary stored procedures and API endpoints exist for managing job applications in the consolidated `job_applications` table.

## Changes Made

### 1. Database Stored Procedures
- Created/updated the following stored procedures:
  - `get_driver_applications`: Retrieves applications submitted by a specific driver
  - `update_application_status`: Updates an application's status (pending/accepted/rejected)
  - `apply_for_shipment`: Handles driver applications for shipments
  - `assign_driver_to_shipment`: Assigns a driver to a shipment and updates related application statuses

### 2. Backend API Endpoints
- Added new API endpoints:
  - `POST /api/v1/shipments/:id/apply`: For drivers to apply for shipments
  - `GET /api/v1/users/drivers/applications`: For drivers to view their applications
  - `PUT /api/v1/applications/:id/status`: For admins to accept/reject applications

### 3. Controllers
- Created a new `application.controller.ts` with the following methods:
  - `applyForShipment`: Handles shipment applications from drivers
  - `getDriverApplications`: Fetches applications for the currently authenticated driver
  - `updateApplicationStatus`: Allows admins to accept or reject applications

### 4. Routes
- Added new route file `application.routes.ts` for application-specific endpoints
- Updated existing route files to include new endpoints
- Registered the application routes in the main API router

### 5. Verification Scripts
- Created verification script to validate stored procedures functionality

## Testing Procedure
To test the complete flow:

1. **Driver Applies for Shipment**
   - `POST /api/v1/shipments/:id/apply` (Requires driver authentication)

2. **Driver Views Applications**
   - `GET /api/v1/users/drivers/applications` (Requires driver authentication)
   - Optionally filter by status: `?status=pending|accepted|rejected`

3. **Admin Reviews Applications**
   - `GET /api/v1/shipments/:id/applicants` (Requires admin authentication)

4. **Admin Accepts/Rejects Application**
   - `PUT /api/v1/applications/:id/status` (Requires admin authentication)
   - Body: `{ "status": "accepted" }` or `{ "status": "rejected" }`

5. **Shipment Assignment**
   - When an application is accepted, the shipment is automatically assigned to the driver
   - All other applications for that shipment are automatically rejected

## Key Benefits
- Ensures consistent handling of driver applications across backend and mobile apps
- Provides API endpoints for all necessary operations
- Maintains data integrity through properly constrained stored procedures
- Improves security with role-based access control for all endpoints
