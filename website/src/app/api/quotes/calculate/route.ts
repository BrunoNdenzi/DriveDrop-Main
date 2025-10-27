import { NextRequest, NextResponse } from 'next/server'

// Backend API URL (use environment variable in production)
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pickupAddress, deliveryAddress, vehicleType, shippingSpeed, distance } = body

    // Validate input
    if (!pickupAddress || !deliveryAddress || !vehicleType || !distance) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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
      distance_miles: Math.round(distance),
      pickup_date: new Date().toISOString(),
      delivery_date: shippingSpeed === 'express' 
        ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
        : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
      is_accident_recovery: false,
      vehicle_count: 1,
    }

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
        { error: 'Failed to calculate quote from backend' },
        { status: response.status }
      )
    }

    const backendData = await response.json()
    
    // Backend returns: { success: true, data: { breakdown: {...}, total: number } }
    const quote = backendData.data

    // Map backend response to website format
    return NextResponse.json({
      totalPrice: Math.round(quote.total * 100), // Convert to cents
      distance: Math.round(distance),
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
