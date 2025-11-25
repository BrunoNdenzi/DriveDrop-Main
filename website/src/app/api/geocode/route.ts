import { NextResponse } from 'next/server';

/**
 * Geocode API endpoint - Converts address to lat/lng coordinates
 * POST /api/geocode
 * Body: { address: string }
 * Returns: { lat: number, lng: number } or { error: string }
 */
export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      return NextResponse.json(
        { error: 'Geocoding service not configured' },
        { status: 500 }
      );
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    const response = await fetch(geocodeUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      
      return NextResponse.json({
        lat,
        lng,
        formatted_address: data.results[0].formatted_address,
      });
    }

    // Handle specific error cases
    if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      );
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      return NextResponse.json(
        { error: 'Geocoding quota exceeded' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Geocoding failed: ${data.status}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
