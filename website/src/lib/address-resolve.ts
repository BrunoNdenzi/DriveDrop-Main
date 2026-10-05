export interface ResolvedAddress {
  address: string
  latitude: number
  longitude: number
  // City or area centre rather than a street address.
  approximate: boolean
}

// Resolves typed text to a US address with coordinates; null means Google found nothing.
export async function geocodeUsAddress(text: string): Promise<ResolvedAddress | null> {
  try {
    const { results } = await new google.maps.Geocoder().geocode({ address: text, componentRestrictions: { country: 'US' } })
    const best = results[0]
    if (!best) return null
    const type = best.geometry.location_type
    return {
      address: best.formatted_address,
      latitude: best.geometry.location.lat(),
      longitude: best.geometry.location.lng(),
      approximate: type === google.maps.GeocoderLocationType.APPROXIMATE || type === google.maps.GeocoderLocationType.GEOMETRIC_CENTER,
    }
  } catch (error) {
    if ((error as { code?: string }).code === google.maps.GeocoderStatus.ZERO_RESULTS) return null
    throw error
  }
}
