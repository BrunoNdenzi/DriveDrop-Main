/**
 * Shipment controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { shipmentService } from '@services/supabase.service';
import { pricingService } from '@services/pricing.service';
import { isValidUuid } from '@utils/validation';
import { ShipmentStatus } from '../types/api.types';

/**
 * Get shipment by ID
 * @route GET /api/v1/shipments/:id
 * @access Private
 */
export const getShipmentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  const shipment = await shipmentService.getShipmentById(id);
  
  res.status(200).json(successResponse(shipment));
});

/**
 * Get shipments (with pagination and filters)
 * @route GET /api/v1/shipments
 * @access Private
 */
export const getShipments = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query['page'] as string || '1', 10);
  const limit = parseInt(req.query['limit'] as string || '10', 10);
  
  // Parse filters
  const filters: {
    clientId?: string;
    driverId?: string;
    status?: ShipmentStatus;
  } = {};

  if (req.query['clientId'] && typeof req.query['clientId'] === 'string') {
    filters.clientId = req.query['clientId'];
  }

  if (req.query['driverId'] && typeof req.query['driverId'] === 'string') {
    filters.driverId = req.query['driverId'];
  }

  if (req.query['status'] && typeof req.query['status'] === 'string') {
    filters.status = req.query['status'] as ShipmentStatus;
  }

  // If user is not admin, apply user-specific filters
  if (req.user?.role !== 'admin') {
    if (req.user?.role === 'client') {
      filters.clientId = req.user.id;
    } else if (req.user?.role === 'driver') {
      filters.driverId = req.user.id;
    }
  }

  const { data, meta } = await shipmentService.getShipments(page, limit, filters);
  
  res.status(200).json(successResponse(data, meta));
});

/**
 * Create tracking event
 * @route POST /api/v1/shipments/:id/events
 * @access Private
 */
export const createTrackingEvent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { eventType, location, notes } = req.body;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!eventType) {
    throw createError('Event type is required', 400, 'MISSING_FIELDS');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const eventId = await shipmentService.createTrackingEvent(
    id,
    eventType,
    req.user.id,
    location,
    notes,
  );
  
  res.status(201).json(successResponse({ eventId }));
});

/**
 * Create a new shipment
 * @route POST /api/v1/shipments
 * @access Private (Client)
 */
export const createShipment = asyncHandler(async (req: Request, res: Response) => {
  const {
    pickup_location,
    delivery_location,
    pickup_address,
    delivery_address,
    description,
    vehicle_type, // expected from client (sedan, suv, pickup, luxury, motorcycle, heavy)
    distance_miles, // numeric distance precomputed client or server
    is_accident_recovery,
    vehicle_count,
    estimated_price, // optional override
    scheduled_pickup,
  } = req.body;

  // Validate required fields
  if (!pickup_location || !delivery_location || !pickup_address || !delivery_address || !description) {
    throw createError('Missing required fields', 400, 'MISSING_FIELDS');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can create shipments
  if (req.user.role !== 'client') {
    throw createError('Only clients can create shipments', 403, 'FORBIDDEN');
  }

  let finalEstimatedPrice = estimated_price;
  if (!finalEstimatedPrice && vehicle_type && distance_miles) {
    try {
      // Map vehicle types to simplified EnhancedVehicleType
      const mapToEnhancedVehicleType = (vehicleType: string): import('../types/api.types').EnhancedVehicleType => {
        const mapping: Record<string, import('../types/api.types').EnhancedVehicleType> = {
          'sedan': 'sedan' as any,
          'suv': 'suv' as any,
          'pickup': 'truck' as any,
          'truck': 'truck' as any,
          'luxury': 'sedan' as any, // Map luxury to sedan for simplicity
          'motorcycle': 'sedan' as any, // Map motorcycle to sedan for simplicity
          'heavy': 'truck' as any, // Map heavy to truck for simplicity
        };
        return mapping[vehicleType.toLowerCase()] || ('sedan' as any);
      };

      const allowedVehicleTypes = ['sedan','suv','pickup','truck','luxury','motorcycle','heavy'] as const;
      const vt = typeof vehicle_type === 'string' && (allowedVehicleTypes as readonly string[]).includes(vehicle_type)
        ? vehicle_type as typeof allowedVehicleTypes[number]
        : undefined;
      if (!vt) {
        throw new Error('Unsupported vehicle type');
      }
      
      const enhancedVehicleType = mapToEnhancedVehicleType(vt);
      
      const { total } = pricingService.calculateQuote({
        vehicleType: enhancedVehicleType,
        distanceMiles: Number(distance_miles),
        isAccidentRecovery: Boolean(is_accident_recovery),
        vehicleCount: vehicle_count ? Number(vehicle_count) : 1,
      });
      finalEstimatedPrice = total;
    } catch {
      // Fallback: leave undefined, don't block creation
    }
  }

  const shipment = await shipmentService.createShipment({
    client_id: req.user.id,
    pickup_location,
    delivery_location,
    pickup_address,
    delivery_address,
    description,
    estimated_price: finalEstimatedPrice,
    scheduled_pickup,
  });

  res.status(201).json(successResponse(shipment));
});

/**
 * Update shipment (general update for any field)
 * @route PATCH /api/v1/shipments/:id
 * @access Private (Client/Admin)
 */
export const updateShipment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Get the shipment to check permissions
  const existingShipment = await shipmentService.getShipmentById(id);
  
  // Only the client who created the shipment or admin can update it
  if (req.user.role !== 'admin' && existingShipment.client_id !== req.user.id) {
    throw createError('Not authorized to update this shipment', 403, 'FORBIDDEN');
  }

  // Validate update data (remove read-only fields)
  const allowedFields = [
    'title', 'description', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip',
    'pickup_notes', 'pickup_date', 'delivery_address', 'delivery_city', 'delivery_state', 
    'delivery_zip', 'delivery_notes', 'delivery_date', 'vehicle_type', 'cargo_type',
    'weight', 'dimensions', 'special_instructions', 'estimated_price', 'final_price',
    'is_accident_recovery', 'distance'
  ];

  const filteredUpdateData = Object.keys(updateData)
    .filter(key => allowedFields.includes(key))
    .reduce((obj: any, key) => {
      obj[key] = updateData[key];
      return obj;
    }, {});

  // Add timestamp
  filteredUpdateData.updated_at = new Date().toISOString();
  filteredUpdateData.updated_by = req.user.id;

  const updatedShipment = await shipmentService.updateShipment(id, filteredUpdateData);
  
  res.status(200).json(successResponse(updatedShipment));
});

/**
 * Update shipment status
 * @route PATCH /api/v1/shipments/:id/status
 * @access Private (Driver/Admin)
 */
export const updateShipmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!status || !Object.values(ShipmentStatus).includes(status as ShipmentStatus)) {
    throw createError('Invalid status', 400, 'INVALID_STATUS');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only drivers and admins can update status
  if (!['driver', 'admin'].includes(req.user.role)) {
    throw createError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const shipment = await shipmentService.updateShipmentStatus(
    id, 
    status as ShipmentStatus, 
    req.user.role === 'driver' ? req.user.id : undefined
  );

  res.status(200).json(successResponse(shipment));
});

/**
 * Get shipments near location
 * @route GET /api/v1/shipments/nearby
 * @access Private (Driver)
 */
export const getShipmentsNearby = asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query['lat'] as string);
  const lng = parseFloat(req.query['lng'] as string);
  const radius = parseInt(req.query['radius'] as string || '20', 10);
  const status = req.query['status'] as ShipmentStatus | undefined;

  if (isNaN(lat) || isNaN(lng)) {
    throw createError('Valid latitude and longitude are required', 400, 'INVALID_COORDINATES');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only drivers can search for nearby shipments
  if (req.user.role !== 'driver') {
    throw createError('Only drivers can search for nearby shipments', 403, 'FORBIDDEN');
  }

  const shipments = await shipmentService.getShipmentsNearLocation(lat, lng, radius, status);

  res.status(200).json(successResponse(shipments));
});

/**
 * Get tracking events for a shipment
 * @route GET /api/v1/shipments/:id/tracking
 * @access Private
 */
export const getShipmentTracking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Get the shipment first to check ownership/access
  const shipment = await shipmentService.getShipmentById(id);
  
  // Check if user has access to this shipment
  const hasAccess = req.user.role === 'admin' || 
                   shipment.client_id === req.user.id || 
                   shipment.driver_id === req.user.id;

  if (!hasAccess) {
    throw createError('Access denied', 403, 'FORBIDDEN');
  }

  const trackingEvents = await shipmentService.getTrackingEvents(id);

  res.status(200).json(successResponse(trackingEvents));
});

/**
 * Assign driver to shipment (admin only)
 * @route PUT /api/v1/shipments/:id/assign
 * @access Admin
 */
export const assignDriverToShipment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { driverId } = req.body;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!driverId || !isValidUuid(driverId)) {
    throw createError('Invalid driver ID', 400, 'INVALID_DRIVER_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  if (req.user.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const assignedShipment = await shipmentService.assignDriverToShipment(id, driverId);

  res.status(200).json(successResponse({
    message: 'Driver assigned successfully',
    shipment: assignedShipment
  }));
});

/**
 * Get shipment applicants (admin only)
 * @route GET /api/v1/shipments/:id/applicants
 * @access Admin
 */
export const getShipmentApplicants = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid shipment ID', 400, 'INVALID_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  if (req.user.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const applicants = await shipmentService.getShipmentApplicants(id);

  res.status(200).json(successResponse(applicants));
});

/**
 * Create or update draft shipment
 * @route POST /api/v1/shipments/draft
 * @route PUT /api/v1/shipments/draft/:id
 * @access Private (Client)
 */
export const createOrUpdateDraft = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const draftData = req.body;

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can create/update drafts
  if (req.user.role !== 'client') {
    throw createError('Only clients can create draft shipments', 403, 'FORBIDDEN');
  }

  // Validate draft data
  const validation = await shipmentService.validateDraftData({
    ...draftData,
    client_id: req.user.id
  });

  if (!validation.isValid) {
    throw createError(`Validation failed: ${validation.errors.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const draft = await shipmentService.createOrUpdateDraft({
    ...draftData,
    client_id: req.user.id
  }, id);

  // Include progress information
  const progress = await shipmentService.getShipmentProgress(draft);

  res.status(id ? 200 : 201).json(successResponse({ 
    draft, 
    progress,
    validation: {
      warnings: validation.warnings,
      canSubmit: await shipmentService.canSubmitDraft(draft)
    }
  }));
});

/**
 * Get user's draft shipments
 * @route GET /api/v1/shipments/drafts
 * @access Private (Client)
 */
export const getUserDrafts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query['page'] as string || '1', 10);
  const limit = parseInt(req.query['limit'] as string || '10', 10);

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can get their drafts
  if (req.user.role !== 'client') {
    throw createError('Only clients can access draft shipments', 403, 'FORBIDDEN');
  }

  const { data, meta } = await shipmentService.getUserDrafts(req.user.id, page, limit);

  // Add progress information for each draft
  const draftsWithProgress = await Promise.all(
    data.map(async (draft: any) => {
      const progress = await shipmentService.getShipmentProgress(draft);
      const canSubmit = await shipmentService.canSubmitDraft(draft);
      return {
        ...draft,
        progress,
        canSubmit
      };
    })
  );

  res.status(200).json(successResponse(draftsWithProgress, meta));
});

/**
 * Delete draft shipment
 * @route DELETE /api/v1/shipments/draft/:id
 * @access Private (Client)
 */
export const deleteDraft = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid draft ID', 400, 'INVALID_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can delete their drafts
  if (req.user.role !== 'client') {
    throw createError('Only clients can delete draft shipments', 403, 'FORBIDDEN');
  }

  await shipmentService.deleteDraft(id, req.user.id);

  res.status(200).json(successResponse({ message: 'Draft deleted successfully' }));
});

/**
 * Submit draft as final shipment
 * @route POST /api/v1/shipments/draft/:id/submit
 * @access Private (Client)
 */
export const submitDraft = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const finalData = req.body;

  if (!id || !isValidUuid(id)) {
    throw createError('Invalid draft ID', 400, 'INVALID_ID');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can submit their drafts
  if (req.user.role !== 'client') {
    throw createError('Only clients can submit draft shipments', 403, 'FORBIDDEN');
  }

  // Submit the draft
  const shipment = await shipmentService.submitDraft(id, req.user.id, finalData);

  res.status(200).json(successResponse(shipment));
});

/**
 * Validate draft shipment data
 * @route POST /api/v1/shipments/validate
 * @access Private (Client)
 */
export const validateShipmentData = asyncHandler(async (req: Request, res: Response) => {
  const draftData = req.body;
  const { validateForSubmission = false } = req.query;

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Only clients can validate shipment data
  if (req.user.role !== 'client') {
    throw createError('Only clients can validate shipment data', 403, 'FORBIDDEN');
  }

  const dataToValidate = {
    ...draftData,
    client_id: req.user.id
  };

  let validation;
  if (validateForSubmission === 'true') {
    validation = await shipmentService.validateCompleteData(dataToValidate);
  } else {
    validation = await shipmentService.validateDraftData(dataToValidate);
  }

  const progress = await shipmentService.getShipmentProgress(dataToValidate);
  const canSubmit = await shipmentService.canSubmitDraft(dataToValidate);

  res.status(200).json(successResponse({
    validation,
    progress,
    canSubmit
  }));
});
