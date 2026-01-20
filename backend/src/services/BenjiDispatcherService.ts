import { supabase } from '../lib/supabase'

interface Load {
  id: string
  client_id: string
  pickup_address: string
  delivery_address: string
  pickup_location: { coordinates: [number, number] }
  delivery_location: { coordinates: [number, number] }
  estimated_price: number
  estimated_distance_km: number
  created_at: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_year?: number
}

interface Driver {
  id: string
  full_name: string
  email: string
  phone_number: string
  location?: { coordinates: [number, number] }
  rating?: number
  completed_shipments?: number
  preferred_routes?: string[]
}

interface DriverLoadMatch {
  load: Load
  driver: Driver
  score: number
  confidence: number
  reasons: string[]
  estimated_earnings: number
  route_fit: number
  distance_to_pickup: number
}

interface DispatchAnalysis {
  unassigned_loads: number
  available_drivers: number
  optimal_matches: DriverLoadMatch[]
  efficiency_score: number
  estimated_revenue: number
  estimated_fuel_savings: number
  time_saved_hours: number
}

export class BenjiDispatcherService {
  /**
   * Analyze all unassigned loads and available drivers
   * Returns dispatch recommendations with confidence scores
   */
  async analyzeDispatchOpportunities(): Promise<DispatchAnalysis> {
    try {
      // Get unassigned loads (status = 'pending' or 'quoted', no driver assigned)
      const { data: loads, error: loadsError } = await supabase
        .from('shipments')
        .select('*')
        .is('driver_id', null)
        .in('status', ['pending', 'quoted'])
        .order('created_at', { ascending: true })

      if (loadsError) throw loadsError

      // Get available drivers (role = driver, status active)
      const { data: drivers, error: driversError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('status', 'active')

      if (driversError) throw driversError

      // Calculate optimal matches
      const matches = await this.calculateOptimalMatches(loads || [], drivers || [])

      // Calculate aggregate metrics
      const efficiency_score = this.calculateEfficiencyScore(matches)
      const estimated_revenue = matches.reduce((sum, m) => sum + m.load.estimated_price, 0)
      const estimated_fuel_savings = this.calculateFuelSavings(matches)
      const time_saved_hours = matches.length * 0.25 // 15 min per assignment manually

      return {
        unassigned_loads: loads?.length || 0,
        available_drivers: drivers?.length || 0,
        optimal_matches: matches,
        efficiency_score,
        estimated_revenue,
        estimated_fuel_savings,
        time_saved_hours
      }
    } catch (error) {
      console.error('Benji Dispatcher Analysis Error:', error)
      throw new Error('Failed to analyze dispatch opportunities')
    }
  }

  /**
   * Calculate optimal driver-load matches using multi-factor scoring
   */
  private async calculateOptimalMatches(
    loads: any[],
    drivers: any[]
  ): Promise<DriverLoadMatch[]> {
    const matches: DriverLoadMatch[] = []
    const assignedDrivers = new Set<string>()

    // Sort loads by priority (higher price, older first)
    const sortedLoads = [...loads].sort((a, b) => {
      const priceDiff = b.estimated_price - a.estimated_price
      if (Math.abs(priceDiff) > 100) return priceDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    for (const load of sortedLoads) {
      // Find best available driver for this load
      let bestMatch: DriverLoadMatch | null = null
      let bestScore = 0

      for (const driver of drivers) {
        // Skip if driver already assigned in this batch
        if (assignedDrivers.has(driver.id)) continue

        const match = await this.scoreDriverLoadMatch(load, driver)
        
        if (match.score > bestScore && match.confidence > 60) {
          bestScore = match.score
          bestMatch = match
        }
      }

      if (bestMatch) {
        matches.push(bestMatch)
        assignedDrivers.add(bestMatch.driver.id)
      }
    }

    return matches
  }

  /**
   * Score a single driver-load match (0-100)
   */
  private async scoreDriverLoadMatch(load: any, driver: any): Promise<DriverLoadMatch> {
    const scores = {
      proximity: 0,
      route_fit: 0,
      earnings: 0,
      experience: 0,
      rating: 0
    }

    const reasons: string[] = []

    // 1. PROXIMITY SCORE (40% weight) - How close is driver to pickup?
    const distanceToPickup = this.calculateDistance(
      driver.location || { coordinates: [-97.7431, 30.2672] }, // Austin default
      load.pickup_location
    )

    if (distanceToPickup < 10) {
      scores.proximity = 100
      reasons.push(`Only ${distanceToPickup.toFixed(1)}mi from pickup`)
    } else if (distanceToPickup < 50) {
      scores.proximity = 80 - (distanceToPickup / 5)
      reasons.push(`${distanceToPickup.toFixed(0)}mi from pickup`)
    } else if (distanceToPickup < 100) {
      scores.proximity = 40
    } else {
      scores.proximity = 20
    }

    // 2. ROUTE FIT SCORE (25% weight) - Is this on driver's usual routes?
    const routeFit = await this.calculateRouteFit(driver.id, load)
    scores.route_fit = routeFit
    if (routeFit > 80) {
      reasons.push('On your usual route')
    }

    // 3. EARNINGS SCORE (20% weight) - Is price fair/above market?
    const pricePerMile = load.estimated_price / load.estimated_distance_km / 0.621371
    if (pricePerMile > 2.5) {
      scores.earnings = 100
      reasons.push('Premium rate (above market)')
    } else if (pricePerMile > 2.0) {
      scores.earnings = 80
      reasons.push('Good rate')
    } else if (pricePerMile > 1.5) {
      scores.earnings = 60
    } else {
      scores.earnings = 40
    }

    // 4. EXPERIENCE SCORE (10% weight) - Driver's track record
    const completedShipments = driver.completed_shipments || 0
    if (completedShipments > 100) {
      scores.experience = 100
      reasons.push('Experienced driver (100+ shipments)')
    } else if (completedShipments > 50) {
      scores.experience = 80
    } else if (completedShipments > 20) {
      scores.experience = 60
    } else {
      scores.experience = 40
    }

    // 5. RATING SCORE (5% weight)
    const rating = driver.rating || 4.0
    scores.rating = rating * 20 // 5-star = 100
    if (rating >= 4.8) {
      reasons.push('5-star rated driver')
    }

    // Calculate weighted total score
    const totalScore = 
      scores.proximity * 0.40 +
      scores.route_fit * 0.25 +
      scores.earnings * 0.20 +
      scores.experience * 0.10 +
      scores.rating * 0.05

    // Calculate confidence (how sure are we about this match?)
    const confidence = Math.min(100, totalScore + (reasons.length * 5))

    return {
      load,
      driver,
      score: Math.round(totalScore),
      confidence: Math.round(confidence),
      reasons,
      estimated_earnings: load.estimated_price * 0.80, // 80% to driver, 20% platform fee
      route_fit: routeFit,
      distance_to_pickup: distanceToPickup
    }
  }

  /**
   * Calculate how well this load fits driver's historical routes
   */
  private async calculateRouteFit(driverId: string, load: any): Promise<number> {
    try {
      // Get driver's past shipments
      const { data: pastShipments } = await supabase
        .from('shipments')
        .select('pickup_address, delivery_address, pickup_location, delivery_location')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .limit(20)

      if (!pastShipments || pastShipments.length === 0) {
        return 50 // Neutral score for new drivers
      }

      let similarRoutes = 0
      let totalRoutes = pastShipments.length

      for (const past of pastShipments) {
        // Check if pickup/delivery cities match
        const pickupMatch = this.areCitiesNear(
          load.pickup_location,
          past.pickup_location
        )
        const deliveryMatch = this.areCitiesNear(
          load.delivery_location,
          past.delivery_location
        )

        if (pickupMatch && deliveryMatch) {
          similarRoutes += 2 // Exact route match
        } else if (pickupMatch || deliveryMatch) {
          similarRoutes += 1 // Partial match
        }
      }

      const fitScore = (similarRoutes / (totalRoutes * 2)) * 100
      return Math.min(100, fitScore * 1.2) // Boost by 20%
    } catch (error) {
      return 50 // Default neutral score on error
    }
  }

  /**
   * Auto-assign loads to recommended drivers
   */
  async autoAssignLoads(matches: DriverLoadMatch[]): Promise<{
    success: number
    failed: number
    assignments: any[]
  }> {
    const assignments: any[] = []
    let success = 0
    let failed = 0

    for (const match of matches) {
      try {
        // Update shipment with driver assignment
        const { error } = await supabase
          .from('shipments')
          .update({
            driver_id: match.driver.id,
            status: 'assigned',
            updated_at: new Date().toISOString()
          })
          .eq('id', match.load.id)
          .is('driver_id', null) // Safety check - only if not already assigned

        if (error) {
          console.error('Assignment failed:', error)
          failed++
          continue
        }

        // Create tracking event
        await supabase
          .from('tracking_events')
          .insert({
            shipment_id: match.load.id,
            event_type: 'assigned',
            created_by: match.driver.id,
            notes: `Auto-assigned by Benji AI (${match.confidence}% confidence)`
          })

        assignments.push({
          load_id: match.load.id,
          driver_id: match.driver.id,
          driver_name: match.driver.full_name,
          confidence: match.confidence,
          score: match.score
        })

        success++
      } catch (error) {
        console.error('Auto-assignment error:', error)
        failed++
      }
    }

    return {
      success,
      failed,
      assignments
    }
  }

  /**
   * Calculate Haversine distance between two points (in miles)
   */
  private calculateDistance(
    point1: { coordinates: [number, number] },
    point2: { coordinates: [number, number] }
  ): number {
    const [lon1, lat1] = point1.coordinates
    const [lon2, lat2] = point2.coordinates

    const R = 3958.8 // Earth's radius in miles
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

  /**
   * Check if two locations are within same city/region (within 30 miles)
   */
  private areCitiesNear(
    loc1: { coordinates: [number, number] },
    loc2: { coordinates: [number, number] }
  ): boolean {
    const distance = this.calculateDistance(loc1, loc2)
    return distance < 30 // Within 30 miles = same city
  }

  /**
   * Calculate overall efficiency score (0-100)
   */
  private calculateEfficiencyScore(matches: DriverLoadMatch[]): number {
    if (matches.length === 0) return 0

    const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length
    const avgConfidence = matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length
    
    return Math.round((avgScore + avgConfidence) / 2)
  }

  /**
   * Estimate fuel savings from optimal routing
   */
  private calculateFuelSavings(matches: DriverLoadMatch[]): number {
    // Estimate $0.50 per mile saved by optimizing routes
    const totalMilesSaved = matches.reduce((sum, m) => {
      // Optimal assignment saves ~10% distance on average
      return sum + (m.load.estimated_distance_km * 0.621371 * 0.10)
    }, 0)

    return Math.round(totalMilesSaved * 0.50)
  }
}

export const benjiDispatcherService = new BenjiDispatcherService()
