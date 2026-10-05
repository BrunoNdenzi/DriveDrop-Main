export interface ReplanSide {
  stops: Array<{ id: string }>
  endTime?: string | undefined
}

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// Plain-language result of a re-plan: did the order change, and does the driver finish earlier or later than planned.
// Only stops present in both plans are compared, because the new plan starts from the driver's position.
export function describeReplan(previous: ReplanSide, next: ReplanSide): string {
  const previousIds = new Set(previous.stops.map(stop => stop.id))
  const nextIds = new Set(next.stops.map(stop => stop.id))
  const before = previous.stops.filter(stop => nextIds.has(stop.id)).map(stop => stop.id)
  const after = next.stops.filter(stop => previousIds.has(stop.id)).map(stop => stop.id)
  const moved = after.filter((id, index) => id !== before[index]).length

  const order = moved === 0 ? 'Stops are in the same order.' : `${moved} stop${moved === 1 ? '' : 's'} moved.`

  const nextEnd = next.endTime ? new Date(next.endTime).getTime() : NaN
  const previousEnd = previous.endTime ? new Date(previous.endTime).getTime() : NaN
  if (Number.isNaN(nextEnd)) return `Re-planned from your position. ${order}`

  const finish = `Finish about ${clock(next.endTime!)}`
  if (Number.isNaN(previousEnd)) return `Re-planned from your position. ${order} ${finish}.`

  const minutes = Math.round((nextEnd - previousEnd) / 60_000)
  const against = Math.abs(minutes) < 3
    ? 'on schedule'
    : minutes < 0
      ? `${Math.abs(minutes)} min earlier than planned`
      : `${minutes} min later than planned`
  return `Re-planned from your position. ${order} ${finish} (${against}).`
}
