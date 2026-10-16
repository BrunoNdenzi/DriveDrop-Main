// Where a trip that was already under way picks up: index 0 is the start, finished stops are skipped, the first unfinished one is next.
export function resumePosition(stopIds: string[], finishedIds: string[], legCount: number) {
  const finished = new Set(finishedIds)
  const hasOrigin = stopIds.length > 1
  const completedStops = stopIds.map((_, index) => index).filter(index => (hasOrigin && index === 0) || finished.has(stopIds[index]!))
  const firstPending = stopIds.findIndex((_, index) => index > 0 && !completedStops.includes(index))
  const currentStopIndex = firstPending === -1 ? Math.max(0, stopIds.length - 1) : firstPending
  return {
    completedStops,
    currentStopIndex,
    currentLeg: Math.max(0, Math.min(currentStopIndex - 1, legCount - 1)),
    allDone: firstPending === -1,
  }
}
