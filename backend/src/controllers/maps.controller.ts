/**
 * Google Maps geolocation controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { googleMapsService } from '@services/google-maps.service';
import { TravelMode } from '@googlemaps/google-maps-services-js';

/**
 * Geocode an address to get coordinates
 * @route POST /api/v1/maps/geocode
 * @access Private
 */
export const geocodeAddress = asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.body;

  if (!address) {
    throw createError('Address is required', 400, 'MISSING_ADDRESS');
  }

  const result = await googleMapsService.geocodeAddress(address);

  res.status(200).json(successResponse(result));
});

/**
 * Reverse geocode coordinates to get address
 * @route POST /api/v1/maps/reverse-geocode
 * @access Private
 */
export const reverseGeocode = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw createError('Latitude and longitude are required', 400, 'MISSING_COORDINATES');
  }

  if (!googleMapsService.isValidCoordinates(latitude, longitude)) {
    throw createError('Invalid coordinates', 400, 'INVALID_COORDINATES');
  }

  const result = await googleMapsService.reverseGeocode(latitude, longitude);

  res.status(200).json(successResponse(result));
});

/**
 * Get directions between two locations
 * @route POST /api/v1/maps/directions
 * @access Private
 */
export const getDirections = asyncHandler(async (req: Request, res: Response) => {
  const { origin, destination, mode = 'driving' } = req.body;

  if (!origin || !destination) {
    throw createError('Origin and destination are required', 400, 'MISSING_LOCATIONS');
  }

  // Validate travel mode
  const validModes = ['driving', 'walking', 'bicycling', 'transit'];
  if (!validModes.includes(mode)) {
    throw createError('Invalid travel mode', 400, 'INVALID_TRAVEL_MODE');
  }

  const travelMode = mode as keyof typeof TravelMode;
  const result = await googleMapsService.getDirections(
    origin,
    destination,
    TravelMode[travelMode]
  );

  res.status(200).json(successResponse(result));
});

/**
 * Calculate distance matrix between multiple origins and destinations
 * @route POST /api/v1/maps/distance-matrix
 * @access Private
 */
export const getDistanceMatrix = asyncHandler(async (req: Request, res: Response) => {
  const { origins, destinations, mode = 'driving' } = req.body;

  if (!origins || !destinations) {
    throw createError('Origins and destinations are required', 400, 'MISSING_LOCATIONS');
  }

  if (!Array.isArray(origins) || !Array.isArray(destinations)) {
    throw createError('Origins and destinations must be arrays', 400, 'INVALID_FORMAT');
  }

  if (origins.length === 0 || destinations.length === 0) {
    throw createError('Origins and destinations cannot be empty', 400, 'EMPTY_ARRAYS');
  }

  // Validate travel mode
  const validModes = ['driving', 'walking', 'bicycling', 'transit'];
  if (!validModes.includes(mode)) {
    throw createError('Invalid travel mode', 400, 'INVALID_TRAVEL_MODE');
  }

  const travelMode = mode as keyof typeof TravelMode;
  const results = await googleMapsService.getDistanceMatrix(
    origins,
    destinations,
    TravelMode[travelMode]
  );

  res.status(200).json(successResponse(results));
});

/**
 * Calculate straight-line distance between two coordinates
 * @route POST /api/v1/maps/haversine-distance
 * @access Private
 */
export const calculateHaversineDistance = asyncHandler(async (req: Request, res: Response) => {
  const { lat1, lon1, lat2, lon2 } = req.body;

  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    throw createError('All coordinates (lat1, lon1, lat2, lon2) are required', 400, 'MISSING_COORDINATES');
  }

  if (!googleMapsService.isValidCoordinates(lat1, lon1) || 
      !googleMapsService.isValidCoordinates(lat2, lon2)) {
    throw createError('Invalid coordinates', 400, 'INVALID_COORDINATES');
  }

  const distance = googleMapsService.calculateHaversineDistance(lat1, lon1, lat2, lon2);

  res.status(200).json(successResponse({
    distance,
    coordinates: {
      point1: { latitude: lat1, longitude: lon1 },
      point2: { latitude: lat2, longitude: lon2 },
    },
  }));
});

/**
 * Find nearby places within a radius
 * @route POST /api/v1/maps/nearby-places
 * @access Private
 */
export const findNearbyPlaces = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, radius, type } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw createError('Latitude and longitude are required', 400, 'MISSING_COORDINATES');
  }

  if (!radius || radius <= 0) {
    throw createError('Valid radius is required', 400, 'INVALID_RADIUS');
  }

  if (!googleMapsService.isValidCoordinates(latitude, longitude)) {
    throw createError('Invalid coordinates', 400, 'INVALID_COORDINATES');
  }

  const places = await googleMapsService.findNearbyPlaces(
    { lat: latitude, lng: longitude },
    radius,
    type
  );

  res.status(200).json(successResponse({
    location: { latitude, longitude },
    radius,
    type,
    places,
    count: places.length,
  }));
});

/**
 * Get optimized route for multiple waypoints (useful for delivery routes)
 * @route POST /api/v1/maps/optimize-route
 * @access Private (Driver or Admin)
 */
export const optimizeRoute = asyncHandler(async (req: Request, res: Response) => {
  const { origin, waypoints, destination, mode = 'driving' } = req.body;

  if (!origin) {
    throw createError('Origin is required', 400, 'MISSING_ORIGIN');
  }

  if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
    throw createError('At least one waypoint is required', 400, 'MISSING_WAYPOINTS');
  }

  // Only drivers and admins can optimize routes
  if (req.user?.role !== 'driver' && req.user?.role !== 'admin') {
    throw createError('Driver or admin access required', 403, 'FORBIDDEN');
  }

  // For route optimization, we'll calculate distances between all points
  // and return them in a matrix format
  const allLocations = [origin, ...waypoints];
  if (destination) {
    allLocations.push(destination);
  }

  // Calculate distance matrix for all locations
  const distanceMatrix = await googleMapsService.getDistanceMatrix(
    allLocations,
    allLocations,
    TravelMode[mode as keyof typeof TravelMode]
  );

  // Simple optimization: sort waypoints by distance from origin
  const waypointDistances = waypoints.map((waypoint, index) => ({
    waypoint,
    index,
    distanceFromOrigin: distanceMatrix.find(result => 
      result.originAddress === allLocations[0] && 
      result.destinationAddress === allLocations[index + 1]
    )?.distance.value || 0,
  }));

  waypointDistances.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  const optimizedWaypoints = waypointDistances.map(item => item.waypoint);

  // Get directions for the optimized route
  const finalDestination = destination || optimizedWaypoints[optimizedWaypoints.length - 1];
  const optimizedRoute = await googleMapsService.getDirections(
    origin,
    finalDestination,
    TravelMode[mode as keyof typeof TravelMode]
  );

  res.status(200).json(successResponse({
    originalWaypoints: waypoints,
    optimizedWaypoints,
    route: optimizedRoute,
    totalDistance: optimizedRoute.distance,
    totalDuration: optimizedRoute.duration,
    distanceMatrix,
  }));
});

/**
 * Validate coordinates
 * @route POST /api/v1/maps/validate-coordinates
 * @access Private
 */
export const validateCoordinates = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    throw createError('Latitude and longitude are required', 400, 'MISSING_COORDINATES');
  }

  const isValid = googleMapsService.isValidCoordinates(latitude, longitude);
  const formatted = isValid ? googleMapsService.formatCoordinates(latitude, longitude) : null;

  res.status(200).json(successResponse({
    coordinates: { latitude, longitude },
    isValid,
    formatted,
  }));
});
