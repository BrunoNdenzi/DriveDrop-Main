interface TaggableStop {
  id: string
  type: string
  shipmentId?: string | undefined
  referenceId?: string | undefined
}

// A shipment keeps one number across its pickup and delivery, in the order the route first reaches it.
export function assignStopTags(stops: TaggableStop[]): Map<string, string> {
  const tags = new Map<string, string>()
  const numbers = new Map<string, number>()
  let next = 0

  for (const stop of stops) {
    if (stop.type !== 'pickup' && stop.type !== 'delivery') continue
    const key = stop.shipmentId || stop.referenceId || `solo:${stop.id}`
    let number = numbers.get(key)
    if (number === undefined) {
      number = ++next
      numbers.set(key, number)
    }
    tags.set(stop.id, `${stop.type === 'pickup' ? 'P' : 'D'}${number}`)
  }

  return tags
}
