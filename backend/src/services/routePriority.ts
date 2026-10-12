export interface PriorityStop {
  type: string;
  shipmentId?: string | undefined;
  doFirst?: boolean | undefined;
}

// The stops that must open the route, in order. A delivery marked "do first" pulls its own pickup in ahead of it,
// since the load has to be on board before it can be delivered. Index 0 is the origin and is never part of it.
export function buildPriorityPrefix(stops: PriorityStop[]): number[] {
  const prefix: number[] = [];
  const add = (index: number) => {
    if (index > 0 && !prefix.includes(index)) prefix.push(index);
  };

  stops.forEach((stop, index) => {
    if (index === 0 || !stop.doFirst) return;
    if (stop.type === 'delivery' && stop.shipmentId) {
      const pickup = stops.findIndex(candidate => candidate.type === 'pickup' && candidate.shipmentId === stop.shipmentId);
      if (pickup > 0) add(pickup);
    }
    add(index);
  });
  return prefix;
}

// How the new order differs from the most efficient one, for a plain-language note to the dispatcher.
export function describePriorityCost(extraMiles: number, firstLabels: string[]): string | null {
  if (firstLabels.length === 0) return null;
  const list = firstLabels.length > 3 ? `${firstLabels.slice(0, 3).join(', ')} and ${firstLabels.length - 3} more` : firstLabels.join(', ');
  if (extraMiles < 0.5) return `Priority stops are done first (${list}) at almost no extra driving.`;
  return `Priority stops are done first (${list}). That adds about ${extraMiles.toFixed(1)} mi compared with the most efficient order.`;
}
