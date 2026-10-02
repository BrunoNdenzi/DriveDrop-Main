import { describe, expect, it } from 'vitest'
import { assignStopTags } from './stop-tags'

describe('assignStopTags', () => {
  it('pairs each pickup with its delivery by shipment', () => {
    const tags = assignStopTags([
      { id: 'o', type: 'current_location' },
      { id: 'p-a', type: 'pickup', shipmentId: 'A' },
      { id: 'p-b', type: 'pickup', shipmentId: 'B' },
      { id: 'd-b', type: 'delivery', shipmentId: 'B' },
      { id: 'd-a', type: 'delivery', shipmentId: 'A' },
    ])

    expect(tags.get('p-a')).toBe('P1')
    expect(tags.get('p-b')).toBe('P2')
    expect(tags.get('d-b')).toBe('D2')
    expect(tags.get('d-a')).toBe('D1')
    expect(tags.has('o')).toBe(false)
  })

  it('accepts referenceId and numbers unpaired stops separately', () => {
    const tags = assignStopTags([
      { id: 'p1', type: 'pickup', referenceId: 'X' },
      { id: 'd1', type: 'delivery', referenceId: 'X' },
      { id: 'd2', type: 'delivery' },
      { id: 'f', type: 'fuel' },
    ])

    expect(tags.get('p1')).toBe('P1')
    expect(tags.get('d1')).toBe('D1')
    expect(tags.get('d2')).toBe('D2')
    expect(tags.has('f')).toBe(false)
  })
})
