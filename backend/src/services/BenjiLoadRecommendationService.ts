import { supabase } from '../lib/supabase'

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
        .select('*')
        .eq('id', driverId)
        .single()

      if (driverError || !driver) {
        throw new Error('Driver not found')
      }

      // Get available loads (unassigned, pending/quoted status)
      const { data: loads, error: loadsError } = await supabase
        .from('shipments')
        .select('*')
        .is('driver_id', null)
        .in('status', ['pending', 'quoted'])
        .order('created_at', { ascending: false })
        .limit(100)

      if (loadsError) throw loadsError

      if (!loads || loads.length === 0) {
        return {
          driver_id: driverId,
          driver_name: driver.full_name,
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
        loads.map((load: any) => this.scoreLoadForDriver(load, driver))
      )

      // Sort by score (highest first)
      scoredLoads.sort((a, b) => b.match_score - a.match_score)

      // Categorize by priority
      const best_match = scoredLoads.find(l => l.match_score >= 85) || null
      const good_matches = scoredLoads.filter(l => l.match_score >= 70 && l.match_score < 85).slice(0, 5)
      const consider = scoredLoads.filter(l => l.match_score >= 50 && l.match_score < 70).slice(0, 5)

      // Generate personalized insights
      const insights = await this.generateInsights(driver, scoredLoads, best_match)

      return {
        driver_id: driverId,
        driver_name: driver.full_name,
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
    const distanceToPickup = this.calculateDistance(
      driver.location || { coordinates: [-97.7431, 30.2672] },
      load.pickup_location
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
    const routeFit = await this.calculateRouteFit(driver.id, load)
    scores.route_fit = routeFit
    if (routeFit > 80) {
      reasons.push('✅ On your usual route')
    } else if (routeFit > 60) {
      reasons.push('🛣️ Similar to routes you\'ve done')
    }

    // 3. EARNINGS SCORE (25% weight)
    const estimatedEarnings = load.estimated_price * 0.80 // 80% to driver
    const pricePerMile = load.estimated_price / (load.estimated_distance_km * 0.621371)

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
      scores.proximity * 0.35 +
      scores.route_fit * 0.30 +
      scores.earnings * 0.25 +
      scores.timing * 0.05 +
      scores.compatibility * 0.05

    // Confidence based on data quality
    const confidence = this.calculateConfidence(load, driver, scores)

    // Determine priority
    let priority: 'best' | 'good' | 'consider'
    if (totalScore >= 85) {
      priority = 'best'
    } else if (totalScore >= 70) {
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
   * Calculate route fit based on driver's history
   */
  private async calculateRouteFit(driverId: string, load: any): Promise<number> {
    try {
      const { data: pastShipments } = await supabase
        .from('shipments')
        .select('pickup_address, delivery_address, pickup_location, delivery_location')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .limit(20)

      if (!pastShipments || pastShipments.length === 0) {
        return 50 // Neutral for new drivers
      }

      let similarRoutes = 0
      for (const past of pastShipments) {
        const pickupMatch = this.areCitiesNear(load.pickup_location, past.pickup_location)
        const deliveryMatch = this.areCitiesNear(load.delivery_location, past.delivery_location)

        if (pickupMatch && deliveryMatch) {
          similarRoutes += 2
        } else if (pickupMatch || deliveryMatch) {
          similarRoutes += 1
        }
      }

      return Math.min(100, (similarRoutes / pastShipments.length) * 75)
    } catch (error) {
      return 50
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

    // Boost if driver has history
    if (driver.completed_shipments > 20) {
      confidence += 10
    }

    return Math.min(100, confidence)
  }

  /**
   * Calculate distance between two points (in miles)
   */
  private calculateDistance(
    point1: { coordinates: [number, number] },
    point2: { coordinates: [number, number] }
  ): number {
    const [lon1, lat1] = point1.coordinates
    const [lon2, lat2] = point2.coordinates

    const R = 3958.8 // Earth radius in miles
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  private areCitiesNear(
    loc1: { coordinates: [number, number] },
    loc2: { coordinates: [number, number] }
  ): boolean {
    const distance = this.calculateDistance(loc1, loc2)
    return distance < 30
  }
}

export const benjiLoadRecommendationService = new BenjiLoadRecommendationService()
