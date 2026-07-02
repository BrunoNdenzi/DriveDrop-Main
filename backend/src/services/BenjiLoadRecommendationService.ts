import { supabase } from '../lib/supabase';
import { haversineDistance, calculateRouteFit, type GeoPoint } from '@benji/core/math/geo';
import { ROUTE_FIT_STRATEGY } from '@benji/core/constants/route';
import {
  RECOMMENDATION_WEIGHTS,
  DRIVER_EARNINGS_SPLIT,
  BEST_MATCH_THRESHOLD,
  GOOD_MATCH_THRESHOLD,
  CONSIDER_THRESHOLD,
} from '@benji/core/constants/scoring';

interface LoadRecommendation {
  load: any
  match_score: number
  confidence: number
  reasons: string[]
  estimated_earnings: number
  distance_to_pickup: number
  route_fit: number
  priority: 'best' | 'good' | 'consider'
}

interface RecommendationResponse {
  driver_id: string
  driver_name: string
  best_match: LoadRecommendation | null
  good_matches: LoadRecommendation[]
  consider: LoadRecommendation[]
  total_available: number
  personalized_insights: string[]
}

export class BenjiLoadRecommendationService {
  /**
   * Get personalized load recommendations for a driver
   */
  async getRecommendations(driverId: string): Promise<RecommendationResponse> {
    try {
      // Get driver profile
      const { data: driver, error: driverError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, rating, is_verified')
        .eq('id', driverId)
        .single()

      if (driverError || !driver) {
        throw new Error('Driver not found')
      }

      // Compute full_name from first_name + last_name
      const driverWithName = {
        ...driver,
        full_name: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.email || 'Driver'
      }

      // Get available loads (unassigned, pending status)
      const { data: loads, error: loadsError } = await supabase
        .from('shipments')
        .select('*')
        .is('driver_id', null)
        .in('status', ['pending'])
        .order('created_at', { ascending: false })
        .limit(100)

      if (loadsError) throw loadsError

      if (!loads || loads.length === 0) {
        return {
          driver_id: driverId,
          driver_name: driverWithName.full_name,
          best_match: null,
          good_matches: [],
          consider: [],
          total_available: 0,
          personalized_insights: [
            'No available loads at the moment',
            'Check back in a few hours for new opportunities'
          ]
        }
      }

      // Score all loads for this driver
      const scoredLoads = await Promise.all(
        loads.map((load: any) => this.scoreLoadForDriver(load, driverWithName))
      )

      // Sort by score (highest first)
      scoredLoads.sort((a, b) => b.match_score - a.match_score)

      // Categorize by priority
      const best_match = scoredLoads.find(l => l.match_score >= BEST_MATCH_THRESHOLD) ?? null
      const good_matches = scoredLoads.filter(l => l.match_score >= GOOD_MATCH_THRESHOLD && l.match_score < BEST_MATCH_THRESHOLD).slice(0, 5)
      const consider = scoredLoads.filter(l => l.match_score >= CONSIDER_THRESHOLD && l.match_score < GOOD_MATCH_THRESHOLD).slice(0, 5)

      // Generate personalized insights
      const insights = await this.generateInsights(driverWithName, scoredLoads, best_match)

      return {
        driver_id: driverId,
        driver_name: driverWithName.full_name,
        best_match,
        good_matches,
        consider,
        total_available: loads.length,
        personalized_insights: insights
      }
    } catch (error) {
      console.error('Load recommendation error:', error)
      throw new Error('Failed to generate recommendations')
    }
  }

  /**
   * Score a single load for a specific driver
   */
  private async scoreLoadForDriver(load: any, driver: any): Promise<LoadRecommendation> {
    const scores = {
      proximity: 0,
      route_fit: 0,
      earnings: 0,
      timing: 0,
      compatibility: 0
    }

    const reasons: string[] = []

    // 1. PROXIMITY SCORE (35% weight)
    // Driver doesn't have a location column — estimate from last completed delivery
    let driverLocation = { coordinates: [-97.7431, 30.2672] as [number, number] } // Default Austin, TX
    try {
      const { data: lastShipment } = await supabase
        .from('shipments')
        .select('delivery_location')
        .eq('driver_id', driver.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      
      if (lastShipment?.delivery_location?.coordinates) {
        driverLocation = lastShipment.delivery_location
      }
    } catch { /* use default */ }

    const pickupLoc = load.pickup_location || { coordinates: [-97.7431, 30.2672] }
    const distanceToPickup = haversineDistance(
      driverLocation as GeoPoint,
      pickupLoc as GeoPoint,
    )

    if (distanceToPickup < 10) {
      scores.proximity = 100
      reasons.push(`📍 Only ${distanceToPickup.toFixed(1)} miles away`)
    } else if (distanceToPickup < 25) {
      scores.proximity = 90
      reasons.push(`📍 ${distanceToPickup.toFixed(0)} miles from pickup`)
    } else if (distanceToPickup < 50) {
      scores.proximity = 75
    } else if (distanceToPickup < 100) {
      scores.proximity = 50
    } else {
      scores.proximity = 30
    }

    // 2. ROUTE FIT SCORE (30% weight)
    const routeFit = await calculateRouteFit(driver.id, load, ROUTE_FIT_STRATEGY.RECOMMENDATION)
    scores.route_fit = routeFit
    if (routeFit > 80) {
      reasons.push('✅ On your usual route')
    } else if (routeFit > 60) {
      reasons.push('🛣️ Similar to routes you\'ve done')
    }

    // 3. EARNINGS SCORE (25% weight)
    const estimatedEarnings = (load.estimated_price || 0) * DRIVER_EARNINGS_SPLIT
    const distanceKm = load.estimated_distance_km || load.distance || 100
    const distanceMiles = distanceKm * 0.621371
    const pricePerMile = distanceMiles > 0 ? (load.estimated_price || 0) / distanceMiles : 0

    if (pricePerMile > 2.5) {
      scores.earnings = 100
      reasons.push(`💰 Premium rate: $${estimatedEarnings.toFixed(0)}`)
    } else if (pricePerMile > 2.0) {
      scores.earnings = 85
      reasons.push(`💵 Good rate: $${estimatedEarnings.toFixed(0)}`)
    } else if (pricePerMile > 1.5) {
      scores.earnings = 70
      reasons.push(`💵 Fair rate: $${estimatedEarnings.toFixed(0)}`)
    } else {
      scores.earnings = 50
    }

    // 4. TIMING SCORE (5% weight)
    const loadAge = (Date.now() - new Date(load.created_at).getTime()) / (1000 * 60 * 60)
    if (loadAge < 2) {
      scores.timing = 100
      reasons.push('🔥 Just posted - act fast!')
    } else if (loadAge < 12) {
      scores.timing = 80
    } else {
      scores.timing = 60
    }

    // 5. COMPATIBILITY SCORE (5% weight)
    const vehicleInfo = `${load.vehicle_year || ''} ${load.vehicle_make || ''} ${load.vehicle_model || ''}`.trim()
    if (vehicleInfo) {
      scores.compatibility = 90
      reasons.push(`🚗 ${vehicleInfo}`)
    } else {
      scores.compatibility = 70
    }

    // Calculate weighted total
    const totalScore =
      scores.proximity     * RECOMMENDATION_WEIGHTS.proximity +
      scores.route_fit     * RECOMMENDATION_WEIGHTS.routeFit +
      scores.earnings      * RECOMMENDATION_WEIGHTS.earnings +
      scores.timing        * RECOMMENDATION_WEIGHTS.timing +
      scores.compatibility * RECOMMENDATION_WEIGHTS.compatibility

    // Confidence based on data quality
    const confidence = this.calculateConfidence(load, driver, scores)

    // Determine priority
    let priority: 'best' | 'good' | 'consider'
    if (totalScore >= BEST_MATCH_THRESHOLD) {
      priority = 'best'
    } else if (totalScore >= GOOD_MATCH_THRESHOLD) {
      priority = 'good'
    } else {
      priority = 'consider'
    }

    return {
      load,
      match_score: Math.round(totalScore),
      confidence: Math.round(confidence),
      reasons,
      estimated_earnings: Math.round(estimatedEarnings),
      distance_to_pickup: Math.round(distanceToPickup),
      route_fit: routeFit,
      priority
    }
  }

  /**
   * Generate personalized insights for driver
   */
  private async generateInsights(
    _driver: any,
    scoredLoads: LoadRecommendation[],
    bestMatch: LoadRecommendation | null
  ): Promise<string[]> {
    const insights: string[] = []

    if (bestMatch) {
      insights.push(`🎯 Found a ${bestMatch.match_score}% match load perfect for you!`)
      insights.push(`💰 You could earn $${bestMatch.estimated_earnings} today`)
    }

    // Analyze earnings potential
    const totalPotentialEarnings = scoredLoads
      .filter(l => l.match_score >= 70)
      .reduce((sum, l) => sum + l.estimated_earnings, 0)

    if (totalPotentialEarnings > 3000) {
      insights.push(`💼 ${totalPotentialEarnings.toFixed(0)} total earnings available from good matches`)
    }

    // Route insights
    const onRouteLoads = scoredLoads.filter(l => l.route_fit > 70).length
    if (onRouteLoads > 3) {
      insights.push(`🛣️ ${onRouteLoads} loads match your usual routes`)
    }

    // Timing insights
    const newLoads = scoredLoads.filter(l => 
      (Date.now() - new Date(l.load.created_at).getTime()) < 2 * 60 * 60 * 1000
    ).length
    if (newLoads > 5) {
      insights.push(`🔥 ${newLoads} new loads posted in last 2 hours`)
    }

    // Competitive insights
    insights.push('⚡ Accept quickly - top loads get claimed fast!')

    return insights
  }

  /**
   * Calculate confidence based on data quality
   */
  private calculateConfidence(load: any, driver: any, _scores: any): number {
    let confidence = 70 // Base confidence

    // Boost confidence if we have good location data
    if (load.pickup_location && load.delivery_location) {
      confidence += 10
    }

    // Boost if load has vehicle details
    if (load.vehicle_make && load.vehicle_model) {
      confidence += 10
    }

    // Boost if driver has history (check rating as proxy)
    if (driver.rating && driver.rating > 4.0) {
      confidence += 10
    }

    return Math.min(100, confidence)
  }
}

export const benjiLoadRecommendationService = new BenjiLoadRecommendationService()
