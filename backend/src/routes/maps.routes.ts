/**
 * Maps routes (Google Maps)
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import {
  geocodeAddress,
  reverseGeocode,
  getDirections,
  getDistanceMatrix,
  calculateHaversineDistance,
  findNearbyPlaces,
  optimizeRoute,
  validateCoordinates,
} from '@controllers/maps.controller';

const router = Router();

/**
 * @route POST /api/v1/maps/geocode
 * @desc Geocode an address to get coordinates
 * @access Private
 */
router.post('/geocode', authenticate, geocodeAddress);

/**
 * @route POST /api/v1/maps/reverse-geocode
 * @desc Reverse geocode coordinates to get address
 * @access Private
 */
router.post('/reverse-geocode', authenticate, reverseGeocode);

/**
 * @route POST /api/v1/maps/directions
 * @desc Get directions between two locations
 * @access Private
 */
router.post('/directions', authenticate, getDirections);

/**
 * @route POST /api/v1/maps/distance-matrix
 * @desc Calculate distance matrix between multiple origins and destinations
 * @access Private
 */
router.post('/distance-matrix', authenticate, getDistanceMatrix);

/**
 * @route POST /api/v1/maps/haversine-distance
 * @desc Calculate straight-line distance between two coordinates
 * @access Private
 */
router.post('/haversine-distance', authenticate, calculateHaversineDistance);

/**
 * @route POST /api/v1/maps/nearby-places
 * @desc Find nearby places within a radius
 * @access Private
 */
router.post('/nearby-places', authenticate, findNearbyPlaces);

/**
 * @route POST /api/v1/maps/optimize-route
 * @desc Get optimized route for multiple waypoints (Driver or Admin)
 * @access Private (Driver or Admin)
 */
router.post(
  '/optimize-route',
  authenticate,
  authorize(['driver', 'admin']),
  optimizeRoute
);

/**
 * @route POST /api/v1/maps/validate-coordinates
 * @desc Validate coordinates format
 * @access Private
 */
router.post('/validate-coordinates', authenticate, validateCoordinates);

export default router;
