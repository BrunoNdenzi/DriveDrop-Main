import { NextRequest, NextResponse } from 'next/server'

// Backend API URL (use environment variable in production)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

/**
 * Calculate distance between two addresses using Google Maps Distance Matrix API
 */
async function calculateDistance(origin: string, destination: string): Promise<number> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured')
    throw new Error('Google Maps API key not configured')
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${GOOGLE_MAPS_API_KEY}`

  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error('Failed to calculate distance')
  }

  const data = await response.json()

  if (data.status !== 'OK' || !data.rows[0]?.elements[0]) {
    throw new Error('Could not calculate distance between addresses')
  }

  const element = data.rows[0].elements[0]
  
  if (element.status !== 'OK') {
    throw new Error(`Distance calculation failed: ${element.status}`)
  }

  // Return distance in miles
  const distanceInMeters = element.distance.value
  const distanceInMiles = distanceInMeters * 0.000621371 // Convert meters to miles
  
  return Math.round(distanceInMiles)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pickupAddress, deliveryAddress, vehicleType, shippingSpeed } = body

    // Validate input
    if (!pickupAddress || !deliveryAddress || !vehicleType) {
      return NextResponse.json(
        { error: 'Missing required fields: pickupAddress, deliveryAddress, and vehicleType are required' },
        { status: 400 }
      )
    }

    // Calculate distance using Google Maps API
    let distance: number
    try {
      distance = await calculateDistance(pickupAddress, deliveryAddress)
      console.log(`Calculated distance: ${distance} miles from ${pickupAddress} to ${deliveryAddress}`)
    } catch (distanceError) {
      console.error('Distance calculation error:', distanceError)
      return NextResponse.json(
        { 
          error: 'Failed to calculate distance between addresses',
          details: distanceError instanceof Error ? distanceError.message : 'Unknown error'
        },
        { status: 400 }
      )
    }

    // Map website vehicle types to backend format
    const vehicleTypeMap: Record<string, string> = {
      'sedan': 'sedan',
      'suv': 'suv',
      'truck': 'pickup',
      'van': 'suv',
      'motorcycle': 'motorcycle',
    }

    // Prepare request for backend
    const backendRequest = {
      vehicle_type: vehicleTypeMap[vehicleType.toLowerCase()] || 'sedan',
      distance_miles: distance,
      pickup_date: new Date().toISOString(),
      delivery_date: shippingSpeed === 'express' 
        ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
        : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
      is_accident_recovery: false,
      vehicle_count: 1,
    }

    console.log('Calling backend with:', backendRequest)

    // Call backend pricing API
    const response = await fetch(`${BACKEND_API_URL}/api/v1/pricing/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendRequest),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Backend pricing error:', error)
      return NextResponse.json(
        { error: 'Failed to calculate quote from backend', details: error },
        { status: response.status }
      )
    }

    const backendData = await response.json()
    
    // Backend returns: { success: true, data: { breakdown: {...}, total: number } }
    const quote = backendData.data

    console.log('Backend quote:', quote)

    // Map backend response to website format
    return NextResponse.json({
      totalPrice: Math.round(quote.total * 100), // Convert to cents
      distance: distance,
      estimatedDays: shippingSpeed === 'express' ? 2 : quote.breakdown?.deliveryType === 'expedited' ? 2 : 5,
      breakdown: {
        basePrice: Math.round(quote.breakdown?.rawBasePrice * 100) || 0,
        fuelSurcharge: Math.round((quote.breakdown?.operatingCostTotal || 0) * 100),
        vehicleSurcharge: 0, // Included in base rate
        speedSurcharge: shippingSpeed === 'express' ? Math.round((quote.breakdown?.deliveryTypeMultiplier || 1.25 - 1) * quote.breakdown?.rawBasePrice * 100) : 0,
      },
      backendBreakdown: quote.breakdown, // Include full breakdown for debugging
    })
  } catch (error) {
    console.error('Quote calculation error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate quote', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
