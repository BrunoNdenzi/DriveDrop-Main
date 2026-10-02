import { describe, expect, it } from 'vitest'
import { googleMapsDirectionsUrl } from './external-nav'

describe('googleMapsDirectionsUrl', () => {
  it('uses the last stop as destination and earlier stops as waypoints', () => {
    const url = new URL(googleMapsDirectionsUrl([
      { address: 'A', lat: 35.1, lng: -80.8 },
      { address: '2 Main St, Charlotte, NC' },
      { address: 'C', lat: 35.3, lng: -80.7 },
    ])!)

    expect(url.searchParams.get('destination')).toBe('35.3,-80.7')
    expect(url.searchParams.get('waypoints')).toBe('35.1,-80.8|2 Main St, Charlotte, NC')
    expect(url.searchParams.get('travelmode')).toBe('driving')
  })

  it('omits waypoints for one stop and caps the list at ten', () => {
    expect(new URL(googleMapsDirectionsUrl([{ address: 'Only' }])!).searchParams.has('waypoints')).toBe(false)

    const many = Array.from({ length: 14 }, (_, index) => ({ address: `Stop ${index}` }))
    const url = new URL(googleMapsDirectionsUrl(many)!)
    expect(url.searchParams.get('waypoints')!.split('|')).toHaveLength(9)
    expect(url.searchParams.get('destination')).toBe('Stop 9')
  })

  it('returns null when there is nothing to navigate to', () => {
    expect(googleMapsDirectionsUrl([])).toBeNull()
    expect(googleMapsDirectionsUrl([{ address: '  ' }])).toBeNull()
  })
})
