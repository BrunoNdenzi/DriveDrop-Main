/**
 * Route Optimization Service
 * 
 * Comprehensive route optimization for DriveDrop drivers featuring:
 * - Multi-stop TSP solver (nearest-neighbor + 2-opt improvement)
 * - Carolina corridor awareness (I-85, I-77, I-40, I-26, I-95)
 * - Fuel cost calculation with regional pricing
 * - Time-window optimization for pickups/deliveries
 * - Traffic pattern modeling (Charlotte, Raleigh, Greensboro metros)
 * - Weather & seasonal adjustments
 * - Smart fuel stop recommendations
 * - Benji AI coaching integration
 */

import { googleMapsService } from './google-maps.service';
import { logger } from '@utils/logger';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RouteStop {
  id: string;
  address: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  type: 'pickup' | 'delivery' | 'fuel' | 'rest' | 'current_location';
  shipmentId?: string | undefined;
  vehicleInfo?: string | undefined;
  timeWindow?: {
    earliest: string; // ISO datetime
    latest: string;
  } | undefined;
  estimatedDuration?: number | undefined; // minutes at stop
  priority?: 'high' | 'medium' | 'low' | undefined;
}

export interface OptimizedRoute {
  stops: OptimizedStop[];
  summary: RouteSummary;
  legs: RouteLeg[];
  savings: RouteSavings;
  carolinaInsights: CarolinaInsight[];
  fuelStops: FuelStopRecommendation[];
  benjiTips: string[];
  polyline?: string;
}

export interface OptimizedStop extends RouteStop {
  order: number;
  estimatedArrival: string;
  estimatedDeparture: string;
  distanceFromPrevious: number; // miles
  durationFromPrevious: number; // minutes
}

export interface RouteLeg {
  fromStop: string;
  toStop: string;
  distance: { text: string; value: number }; // meters
  duration: { text: string; value: number }; // seconds
  corridors: string[];
  trafficWarning?: string | undefined;
}

export interface RouteSummary {
  totalDistance: number; // miles
  totalDuration: number; // minutes
  totalFuelCost: number; // USD
  totalStops: number;
  estimatedStartTime: string;
  estimatedEndTime: string;
  efficiencyScore: number; // 0-100
}

export interface RouteSavings {
  distanceSaved: number; // miles vs naive order
  timeSaved: number; // minutes
  fuelCostSaved: number; // USD
  emptyMilesSaved: number; // deadhead miles eliminated
  percentImprovement: number;
}

export interface CarolinaInsight {
  type: 'corridor' | 'traffic' | 'weather' | 'construction' | 'tip';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  affectedSegment?: string;
}

export interface FuelStopRecommendation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  estimatedPrice: number; // per gallon
  distanceFromRoute: number; // miles
  afterStopIndex: number;
  reason: string;
}

export interface DailyPlan {
  date: string;
  driverLocation: string;
  routes: OptimizedRoute[];
  totalEarnings: number;
  totalMiles: number;
  totalHours: number;
  breakSchedule: BreakRecommendation[];
  weatherForecast: string;
  benjiDailySummary: string;
}

export interface BreakRecommendation {
  afterStopIndex: number;
  suggestedLocation: string;
  type: 'short_break' | 'meal' | 'rest';
  duration: number; // minutes
  reason: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Carolina-Specific Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Major interstate corridors in the Carolinas */
const CAROLINA_CORRIDORS = {
  'I-85': { 
    cities: ['Charlotte', 'Gastonia', 'Salisbury', 'Greensboro', 'Burlington', 'Durham', 'Henderson'],
    avgSpeed: 65, peakHourDelay: 25, // % slower during rush
    description: 'Charlotte to Durham corridor - heaviest freight corridor in NC'
  },
  'I-77': { 
    cities: ['Charlotte', 'Mooresville', 'Statesville', 'Elkin', 'Rock Hill SC', 'Columbia SC'],
    avgSpeed: 65, peakHourDelay: 20,
    description: 'Charlotte to Virginia / South Carolina corridor'
  },
  'I-40': { 
    cities: ['Wilmington', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem', 'Hickory', 'Asheville'],
    avgSpeed: 65, peakHourDelay: 15,
    description: 'Coast to mountains - longest NC interstate'
  },
  'I-26': { 
    cities: ['Asheville', 'Hendersonville', 'Spartanburg SC', 'Columbia SC', 'Charleston SC'],
    avgSpeed: 65, peakHourDelay: 10,
    description: 'Western NC to Charleston corridor'
  },
  'I-95': { 
    cities: ['Lumberton', 'Fayetteville', 'Smithfield', 'Rocky Mount', 'Roanoke Rapids'],
    avgSpeed: 70, peakHourDelay: 10,
    description: 'East coast north-south corridor'
  },
  'I-74': {
    cities: ['Winston-Salem', 'High Point', 'Asheboro', 'Rockingham', 'Laurinburg'],
    avgSpeed: 60, peakHourDelay: 5,
    description: 'Piedmont cross-connector'
  },
};

/** Metropolitan traffic zones with peak hours */
const METRO_TRAFFIC_ZONES = {
  'Charlotte': {
    center: { lat: 35.2271, lng: -80.8431 },
    radius: 25, // miles
    morningPeak: { start: 7, end: 9 },
    eveningPeak: { start: 16, end: 18.5 },
    peakDelay: 30, // % increase in travel time
    hotspots: ['I-77/I-85 interchange', 'I-485 inner loop', 'Billy Graham Pkwy', 'Independence Blvd'],
  },
  'Raleigh-Durham': {
    center: { lat: 35.7796, lng: -78.6382 },
    radius: 20,
    morningPeak: { start: 7, end: 9 },
    eveningPeak: { start: 16.5, end: 18.5 },
    peakDelay: 25,
    hotspots: ['I-40/I-440 interchange', 'I-540', 'US-1 corridor', 'Research Triangle Park'],
  },
  'Greensboro': {
    center: { lat: 36.0726, lng: -79.7920 },
    radius: 15,
    morningPeak: { start: 7, end: 8.5 },
    eveningPeak: { start: 16.5, end: 18 },
    peakDelay: 15,
    hotspots: ['I-85/I-40 interchange (Death Valley)', 'Wendover Ave corridor', 'Battleground Ave'],
  },
  'Columbia SC': {
    center: { lat: 34.0007, lng: -81.0348 },
    radius: 15,
    morningPeak: { start: 7, end: 9 },
    eveningPeak: { start: 16, end: 18 },
    peakDelay: 20,
    hotspots: ['I-26/I-126 interchange', 'I-77/I-20 interchange', 'Malfunction Junction'],
  },
  'Charleston SC': {
    center: { lat: 32.7765, lng: -79.9311 },
    radius: 15,
    morningPeak: { start: 7, end: 9 },
    eveningPeak: { start: 16, end: 18 },
    peakDelay: 20,
    hotspots: ['I-26/US-17 interchange', 'Ravenel Bridge', 'I-526'],
  },
};

/** Average fuel prices by region (updated quarterly) */
const FUEL_PRICES: Record<string, number> = {
  'NC': 3.25,
  'SC': 3.05,
  'VA': 3.35,
  'GA': 3.15,
  'TN': 3.10,
  'default': 3.25,
};

/** Vehicle hauler fuel economy estimates */
const FUEL_ECONOMY = {
  'car_hauler_loaded': 6.5, // MPG
  'car_hauler_empty': 9.0,
  'pickup_with_trailer': 10.0,
  'flatbed_loaded': 7.0,
  'enclosed_loaded': 6.0,
  'default': 7.5,
};

/** FMCSA break requirements */
const BREAK_RULES = {
  maxDrivingBeforeBreak: 480, // 8 hours in minutes
  requiredBreakDuration: 30, // minutes
  maxDailyDriving: 660, // 11 hours in minutes
  maxDailyOnDuty: 840, // 14 hours in minutes
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Service
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class RouteOptimizationService {

  // ── Core Optimization ─────────────────────────────────────────────────

  /**
   * Optimize a set of stops using TSP nearest-neighbor + 2-opt improvement
   */
  async optimizeRoute(
    stops: RouteStop[],
    options: {
      vehicleType?: string | undefined;
      departureTime?: string | undefined; // ISO datetime
      returnToOrigin?: boolean | undefined;
      avoidHighways?: boolean | undefined;
      prioritizeFuel?: boolean | undefined;
      maxDetourMinutes?: number | undefined;
    } = {}
  ): Promise<OptimizedRoute> {
    const startTime = Date.now();
    logger.info('Starting route optimization', { 
      stopCount: stops.length, 
      options 
    });

    if (stops.length < 2) {
      throw new Error('At least 2 stops are required for route optimization');
    }

    // 1. Build distance matrix between all stops
    const addresses = stops.map(s => s.address);
    const distanceMatrix = await this.buildDistanceMatrix(addresses);

    // 2. Calculate naive (original) route distance for comparison
    const naiveDistance = this.calculateNaiveDistance(distanceMatrix, stops.length);

    // 3. Solve TSP with nearest-neighbor heuristic
    let optimizedOrder = this.nearestNeighborTSP(distanceMatrix, stops.length, 0);

    // 4. Improve with 2-opt local search
    optimizedOrder = this.twoOptImprovement(distanceMatrix, optimizedOrder);

    // 5. Apply time-window constraints (shift stops if needed)
    optimizedOrder = this.applyTimeWindowConstraints(stops, optimizedOrder, options.departureTime);

    // 6. Apply priority constraints (high-priority stops earlier)
    optimizedOrder = this.applyPriorityConstraints(stops, optimizedOrder);

    // 7. Build optimized stops with ETAs
    const departureTime = options.departureTime 
      ? new Date(options.departureTime) 
      : new Date();
    
    const { optimizedStops, legs } = await this.buildOptimizedRoute(
      stops, optimizedOrder, distanceMatrix, departureTime
    );

    // 8. Calculate optimized total distance
    const optimizedDistance = this.calculateRouteDistance(distanceMatrix, optimizedOrder);

    // 9. Calculate fuel costs
    const vehicleType = options.vehicleType || 'default';
    const mpg = FUEL_ECONOMY[vehicleType as keyof typeof FUEL_ECONOMY] || FUEL_ECONOMY.default;
    const totalMiles = optimizedDistance / 1609.34; // meters to miles
    const fuelGallons = totalMiles / mpg;
    const fuelPrice = this.getRegionalFuelPrice(stops[0]?.address || '');
    const totalFuelCost = fuelGallons * fuelPrice;

    // 10. Savings calculation
    const naiveMiles = naiveDistance / 1609.34;
    const naiveFuel = (naiveMiles / mpg) * fuelPrice;
    
    const savings: RouteSavings = {
      distanceSaved: Math.max(0, Math.round((naiveMiles - totalMiles) * 10) / 10),
      timeSaved: Math.max(0, this.calculateTimeSaved(distanceMatrix, optimizedOrder, stops.length)),
      fuelCostSaved: Math.max(0, Math.round((naiveFuel - totalFuelCost) * 100) / 100),
      emptyMilesSaved: this.calculateEmptyMilesSaved(stops, optimizedOrder, distanceMatrix),
      percentImprovement: naiveMiles > 0 
        ? Math.round(((naiveMiles - totalMiles) / naiveMiles) * 1000) / 10 
        : 0,
    };

    // 11. Carolina-specific insights
    const carolinaInsights = this.generateCarolinaInsights(
      optimizedStops, legs, departureTime
    );

    // 12. Fuel stop recommendations
    const fuelStops = options.prioritizeFuel 
      ? await this.recommendFuelStops(optimizedStops, mpg, fuelGallons)
      : [];

    // 13. Benji tips
    const benjiTips = this.generateBenjiTips(
      optimizedStops, savings, carolinaInsights, departureTime, vehicleType
    );

    // 14. Total duration
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60; // seconds to minutes
    const stopDuration = optimizedStops.reduce((sum, s) => sum + (s.estimatedDuration || 15), 0);
    const totalWithStops = totalDuration + stopDuration;

    const endTime = new Date(departureTime.getTime() + totalWithStops * 60000);

    // 15. Efficiency score
    const efficiencyScore = this.calculateEfficiencyScore(
      savings, optimizedStops.length, totalMiles, totalWithStops
    );

    const result: OptimizedRoute = {
      stops: optimizedStops,
      legs,
      summary: {
        totalDistance: Math.round(totalMiles * 10) / 10,
        totalDuration: Math.round(totalWithStops),
        totalFuelCost: Math.round(totalFuelCost * 100) / 100,
        totalStops: optimizedStops.length,
        estimatedStartTime: departureTime.toISOString(),
        estimatedEndTime: endTime.toISOString(),
        efficiencyScore,
      },
      savings,
      carolinaInsights,
      fuelStops,
      benjiTips,
    };

    const elapsed = Date.now() - startTime;
    logger.info('Route optimization complete', { 
      elapsed: `${elapsed}ms`,
      totalMiles: result.summary.totalDistance,
      savings: savings.percentImprovement + '%',
      efficiencyScore,
    });

    return result;
  }

  // ── Daily Plan ────────────────────────────────────────────────────────

  /**
   * Generate a full daily plan for a driver
   */
  async generateDailyPlan(
    driverLocation: string,
    shipments: Array<{
      id: string;
      pickupAddress: string;
      deliveryAddress: string;
      vehicleInfo?: string;
      pickupWindow?: { earliest: string; latest: string };
      deliveryWindow?: { earliest: string; latest: string };
      priority?: 'high' | 'medium' | 'low';
      estimatedPayout?: number;
    }>,
    options: {
      vehicleType?: string | undefined;
      departureTime?: string | undefined;
      maxHours?: number | undefined;
      preferHighway?: boolean | undefined;
    } = {}
  ): Promise<DailyPlan> {
    logger.info('Generating daily plan', { 
      shipmentCount: shipments.length, 
      driverLocation 
    });

    // Convert shipments to route stops
    const stops: RouteStop[] = [
      {
        id: 'driver-start',
        address: driverLocation,
        type: 'current_location',
        estimatedDuration: 0,
      },
    ];

    let totalEstimatedEarnings = 0;

    for (const shipment of shipments) {
      stops.push({
        id: `pickup-${shipment.id}`,
        address: shipment.pickupAddress,
        type: 'pickup',
        shipmentId: shipment.id,
        vehicleInfo: shipment.vehicleInfo,
        timeWindow: shipment.pickupWindow,
        estimatedDuration: 20, // 20 min for pickup inspection
        priority: shipment.priority || 'medium',
      });
      stops.push({
        id: `delivery-${shipment.id}`,
        address: shipment.deliveryAddress,
        type: 'delivery',
        shipmentId: shipment.id,
        vehicleInfo: shipment.vehicleInfo,
        timeWindow: shipment.deliveryWindow,
        estimatedDuration: 15, // 15 min for delivery
        priority: shipment.priority || 'medium',
      });
      totalEstimatedEarnings += shipment.estimatedPayout || 0;
    }

    // Optimize the route
    const optimizedRoute = await this.optimizeRoute(stops, {
      vehicleType: options.vehicleType,
      departureTime: options.departureTime,
    });

    // Generate break schedule based on FMCSA rules
    const breakSchedule = this.generateBreakSchedule(
      optimizedRoute.stops, 
      optimizedRoute.legs
    );

    // Weather insight placeholder
    const weatherForecast = this.getWeatherInsight(driverLocation);

    // Build Benji daily summary
    const benjiDailySummary = this.buildDailySummary(
      optimizedRoute, shipments.length, totalEstimatedEarnings, breakSchedule
    );

    return {
      date: (options.departureTime ? new Date(options.departureTime) : new Date())
        .toISOString().split('T')[0]!,
      driverLocation,
      routes: [optimizedRoute],
      totalEarnings: totalEstimatedEarnings,
      totalMiles: optimizedRoute.summary.totalDistance,
      totalHours: Math.round((optimizedRoute.summary.totalDuration / 60) * 10) / 10,
      breakSchedule,
      weatherForecast,
      benjiDailySummary,
    };
  }

  // ── Benji AI Route Assist ─────────────────────────────────────────────

  /**
   * Natural language route assistance via Benji
   */
  async benjiRouteAssist(
    query: string,
    context: {
      driverLocation?: string;
      activeShipments?: Array<{ id: string; pickup: string; delivery: string; status: string }>;
      currentRoute?: OptimizedRoute;
    }
  ): Promise<{
    answer: string;
    suggestions: string[];
    actionRequired?: {
      type: 'reoptimize' | 'add_stop' | 'fuel_stop' | 'reroute' | 'break';
      data?: any;
    };
  }> {
    const lowerQuery = query.toLowerCase();

    // Route optimization intents
    if (lowerQuery.includes('optimize') || lowerQuery.includes('best order') || lowerQuery.includes('best route')) {
      if (context.activeShipments && context.activeShipments.length > 0) {
        return {
          answer: `I found ${context.activeShipments.length} active shipment${context.activeShipments.length > 1 ? 's' : ''}. Let me optimize your route for the fastest delivery order while minimizing fuel costs. Tap "Optimize Now" to see your optimized plan!`,
          suggestions: ['Optimize Now', 'Show fuel savings', 'Add a stop'],
          actionRequired: { type: 'reoptimize' },
        };
      }
      return {
        answer: "I don't see any active shipments to optimize. Pick up some loads from Available Jobs and I'll plan the best route!",
        suggestions: ['Show available jobs', 'Find loads near me', 'Check earnings'],
      };
    }

    // Fuel-related intents
    if (lowerQuery.includes('fuel') || lowerQuery.includes('gas') || lowerQuery.includes('cheapest')) {
      return {
        answer: `Looking for the cheapest fuel near you? South Carolina typically has the lowest prices in the Carolinas (~$${FUEL_PRICES['SC']}/gal). I'll find fuel stations along your route that won't add extra detour miles.`,
        suggestions: ['Find fuel stops', 'Show savings breakdown', 'Fuel cost estimate'],
        actionRequired: { type: 'fuel_stop' },
      };
    }

    // Traffic-related intents
    if (lowerQuery.includes('traffic') || lowerQuery.includes('avoid') || lowerQuery.includes('congestion')) {
      const insights = this.getTrafficInsightsNow();
      return {
        answer: insights,
        suggestions: ['Reroute to avoid', 'Show alternate routes', 'Current ETA update'],
        actionRequired: { type: 'reroute' },
      };
    }

    // Time/ETA intents
    if (lowerQuery.includes('when') || lowerQuery.includes('eta') || lowerQuery.includes('arrive') || lowerQuery.includes('how long')) {
      if (context.currentRoute) {
        return {
          answer: `Based on your current route: Total distance is ${context.currentRoute.summary.totalDistance} miles with an estimated arrival at ${new Date(context.currentRoute.summary.estimatedEndTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. That includes ${context.currentRoute.summary.totalStops} stops.`,
          suggestions: ['Detailed breakdown', 'Skip a stop', 'Update departure'],
        };
      }
      return {
        answer: "Set up your route first and I'll give you detailed ETAs for every stop. Use the Route Planner to get started!",
        suggestions: ['Open Route Planner', 'Show active deliveries'],
      };
    }

    // Break/rest intents
    if (lowerQuery.includes('break') || lowerQuery.includes('rest') || lowerQuery.includes('tired') || lowerQuery.includes('sleep')) {
      return {
        answer: "FMCSA requires a 30-minute break after 8 hours of driving. I recommend taking breaks at truck-friendly locations. Want me to add a rest stop to your route?",
        suggestions: ['Add rest stop', 'Find truck stops nearby', 'Show break schedule'],
        actionRequired: { type: 'break' },
      };
    }

    // Cost-saving intents
    if (lowerQuery.includes('save') || lowerQuery.includes('cost') || lowerQuery.includes('cheaper') || lowerQuery.includes('money')) {
      return {
        answer: "Here are my top cost-saving tips for Carolina drivers: 1) Fill up in SC where gas is ~$0.20/gal cheaper. 2) Avoid Charlotte I-77/I-85 interchange during 4-6:30 PM. 3) Use I-40 for east-west instead of local highways. 4) Group pickups before deliveries to reduce deadhead miles.",
        suggestions: ['Optimize for cost', 'Weekly savings report', 'Fuel price map'],
      };
    }

    // Pickup order intents
    if (lowerQuery.includes('pickup') || lowerQuery.includes('pick up') || lowerQuery.includes('next stop')) {
      if (context.activeShipments && context.activeShipments.length > 0) {
        const pending = context.activeShipments.filter(s => 
          s.status === 'accepted' || s.status === 'assigned'
        );
        return {
          answer: `You have ${pending.length} pending pickup${pending.length > 1 ? 's' : ''}. I can arrange them in the smartest order — minimizing backtracking and hitting time windows. Want me to plan your pickup sequence?`,
          suggestions: ['Plan pickups', 'Show on map', 'Navigate to next'],
        };
      }
      return {
        answer: "No pending pickups right now. Check Available Jobs for new loads!",
        suggestions: ['Available jobs', 'Recommended loads', 'Check messages'],
      };
    }

    // Default helpful response
    return {
      answer: "I'm here to help you drive smarter in the Carolinas! I can optimize your route, find cheap fuel, avoid traffic, estimate costs, and plan your whole day. What would you like help with?",
      suggestions: ['Optimize my route', 'Find cheap fuel', 'Avoid traffic', 'Plan my day'],
    };
  }

  // ── TSP Algorithms ────────────────────────────────────────────────────

  /**
   * Nearest-neighbor TSP heuristic
   * Greedy: always go to the closest unvisited stop
   */
  private nearestNeighborTSP(
    matrix: number[][], 
    n: number, 
    startIndex: number
  ): number[] {
    const visited = new Set<number>([startIndex]);
    const order = [startIndex];
    let current = startIndex;

    while (visited.size < n) {
      let nearest = -1;
      let nearestDist = Infinity;

      for (let i = 0; i < n; i++) {
        const dist = matrix[current]?.[i] ?? Infinity;
        if (!visited.has(i) && dist < nearestDist) {
          nearest = i;
          nearestDist = dist;
        }
      }

      if (nearest === -1) break;
      visited.add(nearest);
      order.push(nearest);
      current = nearest;
    }

    return order;
  }

  /**
   * 2-opt improvement: iteratively reverse segments to reduce total distance
   */
  private twoOptImprovement(matrix: number[][], route: number[]): number[] {
    let improved = true;
    let bestRoute = [...route];
    let bestDistance = this.calculateRouteDistance(matrix, bestRoute);
    let iterations = 0;
    const maxIterations = 1000;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 1; i < bestRoute.length - 1; i++) {
        for (let j = i + 1; j < bestRoute.length; j++) {
          const newRoute = this.twoOptSwap(bestRoute, i, j);
          const newDist = this.calculateRouteDistance(matrix, newRoute);

          if (newDist < bestDistance - 0.01) { // small epsilon to avoid floating point issues
            bestRoute = newRoute;
            bestDistance = newDist;
            improved = true;
          }
        }
      }
    }

    logger.info('2-opt improvement', { iterations, improvement: route.length > 0 });
    return bestRoute;
  }

  /** Reverse a segment of the route (2-opt swap) */
  private twoOptSwap(route: number[], i: number, j: number): number[] {
    const newRoute = route.slice(0, i);
    const reversed = route.slice(i, j + 1).reverse();
    const remaining = route.slice(j + 1);
    return [...newRoute, ...reversed, ...remaining];
  }

  /** Calculate total route distance from the distance matrix */
  private calculateRouteDistance(matrix: number[][], order: number[]): number {
    let total = 0;
    for (let i = 0; i < order.length - 1; i++) {
      const from = order[i]!;
      const to = order[i + 1]!;
      total += matrix[from]?.[to] ?? 0;
    }
    return total;
  }

  // ── Distance Matrix Builder ───────────────────────────────────────────

  /**
   * Build NxN distance matrix from addresses using Google Maps Distance Matrix API
   */
  private async buildDistanceMatrix(addresses: string[]): Promise<number[][]> {
    const n = addresses.length;
    const matrix: number[][] = Array.from({ length: n }, () => 
      Array(n).fill(0)
    );

    // Google Distance Matrix API supports max 25 origins x 25 destinations per request
    // For larger sets, we batch
    const batchSize = 10;
    
    for (let i = 0; i < n; i += batchSize) {
      const originBatch = addresses.slice(i, Math.min(i + batchSize, n));
      
      for (let j = 0; j < n; j += batchSize) {
        const destBatch = addresses.slice(j, Math.min(j + batchSize, n));
        
        try {
          const results = await googleMapsService.getDistanceMatrix(
            originBatch,
            destBatch
          );

          // Map results back to matrix
          let resultIdx = 0;
          for (let oi = 0; oi < originBatch.length; oi++) {
            for (let dj = 0; dj < destBatch.length; dj++) {
              const globalI = i + oi;
              const globalJ = j + dj;
              if (resultIdx < results.length && results[resultIdx]) {
                matrix[globalI]![globalJ] = results[resultIdx]!.distance?.value || 999999;
              }
              resultIdx++;
            }
          }
        } catch (error) {
          logger.error('Distance matrix batch failed', { i, j, error });
          // Fallback: use haversine estimation
          for (let oi = 0; oi < originBatch.length; oi++) {
            for (let dj = 0; dj < destBatch.length; dj++) {
              matrix[i + oi]![j + dj] = 999999; // large penalty for unknown
            }
          }
        }
      }
    }

    return matrix;
  }

  // ── Constraint Handlers ───────────────────────────────────────────────

  /** Apply time-window constraints: ensure stops with time windows are reachable */
  private applyTimeWindowConstraints(
    stops: RouteStop[], 
    order: number[],
    _departureTime?: string
  ): number[] {
    // If no stops have time windows, return as-is
    const hasTimeWindows = stops.some(s => s.timeWindow);
    if (!hasTimeWindows) return order;

    // Simple constraint: move high-urgency time-window stops earlier
    const result = [...order];
    // Sort by urgency of time window (earliest deadline first) while keeping first stop fixed
    const fixed = result[0]!;
    const rest = result.slice(1);

    rest.sort((a, b) => {
      const windowA = stops[a]?.timeWindow;
      const windowB = stops[b]?.timeWindow;
      
      if (windowA && windowB) {
        return new Date(windowA.latest).getTime() - new Date(windowB.latest).getTime();
      }
      if (windowA) return -1; // time-windowed stops go first
      if (windowB) return 1;
      return 0;
    });

    return [fixed, ...rest];
  }

  /** Apply priority constraints: high-priority stops get moved earlier */
  private applyPriorityConstraints(stops: RouteStop[], order: number[]): number[] {
    const priorityWeight = { high: 0, medium: 1, low: 2 };
    
    // Only re-sort if there are priority differences
    const hasPriorities = stops.some(s => s.priority && s.priority !== 'medium');
    if (!hasPriorities) return order;

    const fixed = order[0]!;
    const rest = order.slice(1);

    // Stable sort — only move high-priority significantly
    rest.sort((a, b) => {
      const pA = priorityWeight[stops[a]?.priority || 'medium'];
      const pB = priorityWeight[stops[b]?.priority || 'medium'];
      return pA - pB;
    });

    return [fixed, ...rest];
  }

  // ── Route Building ────────────────────────────────────────────────────

  /** Build full optimized route with ETAs and leg details */
  private async buildOptimizedRoute(
    stops: RouteStop[],
    order: number[],
    distanceMatrix: number[][],
    departureTime: Date
  ): Promise<{ optimizedStops: OptimizedStop[]; legs: RouteLeg[] }> {
    const optimizedStops: OptimizedStop[] = [];
    const legs: RouteLeg[] = [];
    let currentTime = new Date(departureTime);

    for (let i = 0; i < order.length; i++) {
      const stopIdx = order[i]!;
      const stop = stops[stopIdx]!;
      const stopDuration = stop.estimatedDuration || 15; // default 15 min

      let distFromPrev = 0;
      let durFromPrev = 0;

      if (i > 0) {
        const prevIdx = order[i - 1]!;
        distFromPrev = (distanceMatrix[prevIdx]?.[stopIdx] ?? 0) / 1609.34; // meters to miles
        durFromPrev = ((distanceMatrix[prevIdx]?.[stopIdx] ?? 0) / 1609.34) / 45 * 60; // rough: 45mph avg → minutes

        // Try to get actual directions for leg detail
        try {
          const prevStop = stops[prevIdx]!;
          const directions = await googleMapsService.getDirections(
            prevStop.address,
            stop.address
          );
          durFromPrev = directions.duration.value / 60; // seconds to minutes
          distFromPrev = directions.distance.value / 1609.34; // meters to miles

          const corridors = this.identifyCorridors(
            prevStop.address, stop.address
          );

          const trafficWarning = this.getTrafficWarning(
            prevStop.address, stop.address, currentTime
          );

          legs.push({
            fromStop: prevStop.id,
            toStop: stop.id,
            distance: directions.distance,
            duration: directions.duration,
            corridors,
            trafficWarning: trafficWarning ?? undefined,
          });
        } catch (err) {
          // fallback leg
          const prevStop = stops[order[i - 1]!]!;
          legs.push({
            fromStop: prevStop.id,
            toStop: stop.id,
            distance: { text: `${Math.round(distFromPrev)} mi`, value: distFromPrev * 1609.34 },
            duration: { text: `${Math.round(durFromPrev)} min`, value: durFromPrev * 60 },
            corridors: [],
          });
        }

        currentTime = new Date(currentTime.getTime() + durFromPrev * 60000);
      }

      const arrival = new Date(currentTime);
      const departure = new Date(currentTime.getTime() + stopDuration * 60000);
      currentTime = departure;

      optimizedStops.push({
        ...stop,
        order: i + 1,
        estimatedArrival: arrival.toISOString(),
        estimatedDeparture: departure.toISOString(),
        distanceFromPrevious: Math.round(distFromPrev * 10) / 10,
        durationFromPrevious: Math.round(durFromPrev),
      });
    }

    return { optimizedStops, legs };
  }

  // ── Carolina Insights ─────────────────────────────────────────────────

  /** Generate Carolina-specific route insights */
  private generateCarolinaInsights(
    stops: OptimizedStop[],
    legs: RouteLeg[],
    departureTime: Date
  ): CarolinaInsight[] {
    const insights: CarolinaInsight[] = [];
    const hour = departureTime.getHours();

    // Check for corridor usage
    for (const leg of legs) {
      for (const corridor of leg.corridors) {
        const info = CAROLINA_CORRIDORS[corridor as keyof typeof CAROLINA_CORRIDORS];
        if (info) {
          insights.push({
            type: 'corridor',
            title: `Using ${corridor}`,
            description: info.description,
            severity: 'info',
            affectedSegment: `${leg.fromStop} → ${leg.toStop}`,
          });
        }
      }

      // Traffic warnings
      if (leg.trafficWarning) {
        insights.push({
          type: 'traffic',
          title: 'Traffic Alert',
          description: leg.trafficWarning,
          severity: 'warning',
          affectedSegment: `${leg.fromStop} → ${leg.toStop}`,
        });
      }
    }

    // Peak hour warnings
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) {
      insights.push({
        type: 'traffic',
        title: 'Rush Hour Active',
        description: `You're traveling during peak hours. Charlotte I-77/I-85 can add 20-30 min. Consider departing ${hour < 12 ? 'before 6:30 AM' : 'after 7:00 PM'} for smoother travel.`,
        severity: 'warning',
      });
    }

    // Seasonal insights
    const month = departureTime.getMonth();
    if (month >= 11 || month <= 2) {
      insights.push({
        type: 'weather',
        title: 'Winter Driving Alert',
        description: 'Mountain passes on I-40 west of Asheville and I-26 near Saluda may have ice. Check NCDOT for conditions. Allow extra time and reduce speed in elevated areas.',
        severity: 'warning',
      });
    } else if (month >= 5 && month <= 8) {
      insights.push({
        type: 'weather',
        title: 'Summer Storm Season',
        description: 'Afternoon thunderstorms common in the Carolinas, especially along the I-85 corridor. Keep an eye on the sky between 2-6 PM.',
        severity: 'info',
      });
    }

    // SC fuel tip
    const hasSCStops = stops.some(s => 
      s.address.toLowerCase().includes(' sc') || 
      s.address.toLowerCase().includes('south carolina')
    );
    if (hasSCStops) {
      insights.push({
        type: 'tip',
        title: 'Cheaper Fuel in SC',
        description: `South Carolina gas prices are typically $0.20-0.30/gal cheaper than NC. Fill up when you cross the state line to save $5-15 per tank.`,
        severity: 'info',
      });
    }

    return insights;
  }

  // ── Fuel Stop Recommendations ─────────────────────────────────────────

  /** Recommend fuel stops along the route */
  private async recommendFuelStops(
    stops: OptimizedStop[],
    mpg: number,
    _totalGallons: number
  ): Promise<FuelStopRecommendation[]> {
    const recommendations: FuelStopRecommendation[] = [];
    
    // Recommend fuel stop every ~250 miles or when tank likely low
    let milesSinceLastFuel = 0;
    const tankCapacity = 50; // gallons for hauler
    const fuelRange = tankCapacity * mpg * 0.75; // 75% of full range for safety

    for (let i = 1; i < stops.length; i++) {
      const currentStop = stops[i]!;
      milesSinceLastFuel += currentStop.distanceFromPrevious;

      if (milesSinceLastFuel >= fuelRange * 0.6 || 
          (i === Math.floor(stops.length / 2) && milesSinceLastFuel > 100)) {
        // Find nearby fuel stations
        try {
          if (currentStop.latitude && currentStop.longitude) {
            const fuelPlaces = await googleMapsService.findNearbyPlaces(
              { lat: currentStop.latitude, lng: currentStop.longitude },
              8000, // 5 mile radius
              'gas_station'
            );

            if (fuelPlaces.length > 0) {
              const place = fuelPlaces[0]!;
              const state = this.extractState(currentStop.address);
              recommendations.push({
                name: place.name || 'Fuel Station',
                address: place.vicinity || currentStop.address,
                latitude: currentStop.latitude,
                longitude: currentStop.longitude,
                estimatedPrice: FUEL_PRICES[state] ?? FUEL_PRICES['default']!,
                distanceFromRoute: 0.5, // approximate
                afterStopIndex: i - 1,
                reason: milesSinceLastFuel > 200 
                  ? `${Math.round(milesSinceLastFuel)} miles since last fill — time to refuel`
                  : 'Strategic mid-route fuel stop',
              });
              milesSinceLastFuel = 0;
            }
          }
        } catch (error) {
          logger.warn('Could not find fuel stops', { error });
        }
      }
    }

    return recommendations;
  }

  // ── Benji Tips Generator ──────────────────────────────────────────────

  /** Generate contextual Benji tips based on route analysis */
  private generateBenjiTips(
    stops: OptimizedStop[],
    savings: RouteSavings,
    insights: CarolinaInsight[],
    departureTime: Date,
    vehicleType: string
  ): string[] {
    const tips: string[] = [];

    // Savings tip
    if (savings.distanceSaved > 5) {
      tips.push(
        `🎯 I optimized your route to save ${savings.distanceSaved} miles and $${savings.fuelCostSaved.toFixed(2)} in fuel. That's a ${savings.percentImprovement}% improvement!`
      );
    }

    // Time tip
    if (savings.timeSaved > 15) {
      tips.push(
        `⏱️ You'll save about ${Math.round(savings.timeSaved)} minutes compared to the original order.`
      );
    }

    // Empty miles tip
    if (savings.emptyMilesSaved > 10) {
      tips.push(
        `🚛 Reduced deadhead (empty) miles by ${savings.emptyMilesSaved} miles by grouping pickups strategically.`
      );
    }

    // Early departure tip
    const hour = departureTime.getHours();
    if (hour >= 7 && hour <= 9) {
      tips.push(
        `☀️ Pro tip: Starting 30 minutes earlier (before 6:30 AM) could save you 15-20 min by avoiding Charlotte metro rush hour.`
      );
    }

    // Multi-stop efficiency
    if (stops.length >= 6) {
      tips.push(
        `📦 With ${stops.length} stops today, I've arranged pickups and deliveries to minimize backtracking. Follow the numbered order for best results.`
      );
    }

    // Vehicle-specific tip
    if (vehicleType === 'car_hauler_loaded' || vehicleType === 'enclosed_loaded') {
      tips.push(
        `🔧 Loaded hauler tip: Maintain 60-65 mph on I-85/I-40 for optimal fuel economy. Higher speeds drop MPG significantly with a loaded trailer.`
      );
    }

    // SC fuel tip
    const hasSC = insights.some(i => i.title.includes('SC') || i.description.includes('South Carolina'));
    if (hasSC) {
      tips.push(
        `⛽ Your route passes through SC — fill up there! Fuel is typically $0.20-0.30/gal cheaper than NC.`
      );
    }

    // Weekend tip
    const day = departureTime.getDay();
    if (day === 0 || day === 6) {
      tips.push(
        `📅 Weekend advantage: Traffic is lighter on Carolina interstates. Great day for long hauls!`
      );
    }

    // If no specific tips, add general Benji advice
    if (tips.length === 0) {
      tips.push(
        `✅ Your route looks good! I've arranged stops in the most efficient order. Drive safe and check back if conditions change.`
      );
    }

    return tips.slice(0, 5); // max 5 tips
  }

  // ── Helper Methods ────────────────────────────────────────────────────

  /** Calculate naive (original order) route distance */
  private calculateNaiveDistance(matrix: number[][], n: number): number {
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
      total += matrix[i]?.[i + 1] ?? 0;
    }
    return total;
  }

  /** Calculate time saved in minutes */
  private calculateTimeSaved(
    matrix: number[][], 
    optimizedOrder: number[], 
    n: number
  ): number {
    // Naive time: sequential order at avg 45mph
    let naiveMeters = 0;
    for (let i = 0; i < n - 1; i++) {
      naiveMeters += matrix[i]?.[i + 1] ?? 0;
    }
    
    // Optimized time
    let optMeters = 0;
    for (let i = 0; i < optimizedOrder.length - 1; i++) {
      const from = optimizedOrder[i]!;
      const to = optimizedOrder[i + 1]!;
      optMeters += matrix[from]?.[to] ?? 0;
    }

    // Convert meters to minutes at avg 45 mph (72.4 km/h)
    const naiveMinutes = (naiveMeters / 1000) / 72.4 * 60;
    const optMinutes = (optMeters / 1000) / 72.4 * 60;

    return Math.round(naiveMinutes - optMinutes);
  }

  /** Calculate empty miles saved by grouping pickups/deliveries */
  private calculateEmptyMilesSaved(
    stops: RouteStop[], 
    order: number[], 
    matrix: number[][]
  ): number {
    // Count transitions between pickup→pickup (good) vs delivery→pickup (deadhead)
    let emptyMiles = 0;
    for (let i = 0; i < order.length - 1; i++) {
      const curIdx = order[i]!;
      const nextIdx = order[i + 1]!;
      const current = stops[curIdx];
      const next = stops[nextIdx];
      if (current?.type === 'delivery' && next?.type === 'pickup') {
        emptyMiles += (matrix[curIdx]?.[nextIdx] ?? 0) / 1609.34;
      }
    }
    
    // Naive empty miles
    let naiveEmpty = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      if (stops[i]?.type === 'delivery' && stops[i + 1]?.type === 'pickup') {
        naiveEmpty += (matrix[i]?.[i + 1] ?? 0) / 1609.34;
      }
    }

    return Math.max(0, Math.round((naiveEmpty - emptyMiles) * 10) / 10);
  }

  /** Get regional fuel price based on address state */
  private getRegionalFuelPrice(address: string): number {
    const state = this.extractState(address);
    return FUEL_PRICES[state] ?? FUEL_PRICES['default'] ?? 3.25;
  }

  /** Extract state abbreviation from address */
  private extractState(address: string): string {
    const statePattern = /\b(NC|SC|VA|GA|TN|FL|AL|WV|MD|KY)\b/i;
    const match = address.match(statePattern);
    return match?.[1] ? match[1].toUpperCase() : 'default';
  }

  /** Identify which Carolina corridors a route segment uses */
  private identifyCorridors(fromAddress: string, toAddress: string): string[] {
    const corridors: string[] = [];
    const combined = `${fromAddress} ${toAddress}`.toLowerCase();

    for (const [corridor, info] of Object.entries(CAROLINA_CORRIDORS)) {
      const matchCount = info.cities.filter(city => 
        combined.includes(city.toLowerCase())
      ).length;
      if (matchCount >= 1) {
        corridors.push(corridor);
      }
    }

    return corridors;
  }

  /** Get traffic warning for a specific segment at a given time */
  private getTrafficWarning(
    fromAddress: string, toAddress: string, time: Date
  ): string | null {
    const hour = time.getHours() + time.getMinutes() / 60;
    const combined = `${fromAddress} ${toAddress}`.toLowerCase();

    for (const [metro, zone] of Object.entries(METRO_TRAFFIC_ZONES)) {
      const metroLower = metro.toLowerCase();
      if (combined.includes(metroLower) || 
          combined.includes(metroLower.split('-')[0]!) ||
          combined.includes(metroLower.split(' ')[0]!)) {
        
        const inMorningPeak = hour >= zone.morningPeak.start && hour <= zone.morningPeak.end;
        const inEveningPeak = hour >= zone.eveningPeak.start && hour <= zone.eveningPeak.end;

        if (inMorningPeak || inEveningPeak) {
          const period = inMorningPeak ? 'morning' : 'evening';
          return `${metro} ${period} rush hour — expect ${zone.peakDelay}% longer travel time. Hotspots: ${zone.hotspots.slice(0, 2).join(', ')}`;
        }
      }
    }

    return null;
  }

  /** Get current traffic insights */
  private getTrafficInsightsNow(): string {
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const warnings: string[] = [];

    for (const [metro, zone] of Object.entries(METRO_TRAFFIC_ZONES)) {
      const inMorningPeak = hour >= zone.morningPeak.start && hour <= zone.morningPeak.end;
      const inEveningPeak = hour >= zone.eveningPeak.start && hour <= zone.eveningPeak.end;

      if (inMorningPeak || inEveningPeak) {
        warnings.push(`${metro}: Active rush hour (+${zone.peakDelay}% delay)`);
      }
    }

    if (warnings.length > 0) {
      return `Current traffic conditions:\n${warnings.join('\n')}\n\nI can reroute you around these areas if needed.`;
    }

    return "Traffic looks clear across the Carolinas right now! Great time to cover miles.";
  }

  /** Get weather insight for a location */
  private getWeatherInsight(_location: string): string {
    const month = new Date().getMonth();
    if (month >= 11 || month <= 2) {
      return 'Winter conditions — watch for ice on mountain passes (I-40 west, I-26 Saluda Grade). Check NCDOT 511 for road conditions.';
    } else if (month >= 5 && month <= 8) {
      return 'Summer heat advisory possible — monitor tire pressure on loaded trailers. Afternoon thunderstorms likely 2-6 PM.';
    } else if (month >= 3 && month <= 4) {
      return 'Spring weather — occasional rain showers. Good driving conditions overall.';
    }
    return 'Fall weather — excellent driving conditions. Watch for reduced visibility in morning fog near rivers and lowlands.';
  }

  /** Generate FMCSA-compliant break schedule */
  private generateBreakSchedule(
    stops: OptimizedStop[], 
    _legs: RouteLeg[]
  ): BreakRecommendation[] {
    const breaks: BreakRecommendation[] = [];
    let drivingMinutes = 0;
    let totalOnDuty = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]!;
      drivingMinutes += stop.durationFromPrevious;
      totalOnDuty += stop.durationFromPrevious + (stop.estimatedDuration || 0);

      // FMCSA 30-min break after 8 hours driving
      if (drivingMinutes >= BREAK_RULES.maxDrivingBeforeBreak) {
        breaks.push({
          afterStopIndex: i,
          suggestedLocation: stop.address,
          type: 'short_break',
          duration: BREAK_RULES.requiredBreakDuration,
          reason: 'FMCSA required 30-minute break after 8 hours of driving',
        });
        drivingMinutes = 0;
      }

      // Meal break every 4-5 hours
      if (totalOnDuty >= 300 && totalOnDuty % 300 < 30 && i > 0) {
        breaks.push({
          afterStopIndex: i,
          suggestedLocation: stop.address,
          type: 'meal',
          duration: 45,
          reason: 'Recommended meal break to stay alert and energized',
        });
      }
    }

    return breaks;
  }

  /** Build Benji daily summary message */
  private buildDailySummary(
    route: OptimizedRoute,
    shipmentCount: number,
    earnings: number,
    breaks: BreakRecommendation[]
  ): string {
    const { summary, savings } = route;
    
    let msg = `Good ${this.getTimeOfDay()}! Here's your daily plan:\n\n`;
    msg += `📦 ${shipmentCount} shipment${shipmentCount > 1 ? 's' : ''} | `;
    msg += `${summary.totalStops} stops | `;
    msg += `${summary.totalDistance} miles\n`;
    msg += `⏱️ Estimated ${Math.round(summary.totalDuration / 60 * 10) / 10} hours `;
    msg += `(${new Date(summary.estimatedStartTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} → `;
    msg += `${new Date(summary.estimatedEndTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})\n`;
    msg += `⛽ Fuel cost: ~$${summary.totalFuelCost.toFixed(2)}\n`;
    
    if (earnings > 0) {
      msg += `💰 Estimated earnings: $${earnings.toFixed(2)}\n`;
    }

    if (savings.percentImprovement > 0) {
      msg += `\n🎯 Route optimization saved you ${savings.distanceSaved} miles & $${savings.fuelCostSaved.toFixed(2)} in fuel!`;
    }

    if (breaks.length > 0) {
      msg += `\n\n🛑 ${breaks.length} break${breaks.length > 1 ? 's' : ''} scheduled per FMCSA regulations.`;
    }

    msg += `\n\nDrive safe out there! 🚛`;
    return msg;
  }

  /** Get time of day greeting */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  /** Calculate route efficiency score (0-100) */
  private calculateEfficiencyScore(
    savings: RouteSavings,
    stopCount: number,
    totalMiles: number,
    totalMinutes: number
  ): number {
    let score = 70; // base score

    // Improvement bonus (max +15)
    score += Math.min(15, savings.percentImprovement * 1.5);

    // Distance efficiency: fewer miles per stop is better (max +10)
    const milesPerStop = totalMiles / Math.max(1, stopCount);
    if (milesPerStop < 50) score += 10;
    else if (milesPerStop < 100) score += 5;

    // Time efficiency: reasonable mph average (max +5)
    const avgMph = totalMiles / (totalMinutes / 60);
    if (avgMph >= 40 && avgMph <= 55) score += 5;
    else if (avgMph >= 30) score += 2;

    return Math.min(100, Math.round(score));
  }
}

export const routeOptimizationService = new RouteOptimizationService();
