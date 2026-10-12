export interface StopProof {
  photos: string[];
  signature?: string;
  receiverName?: string;
  notes?: string;
  capturedAt: string;
}

export const MAX_PROOF_PHOTOS = 10;

// Checks the file's own header rather than trusting the name or type the browser sent.
export function detectImageType(buffer: Buffer): { extension: 'jpg' | 'png' | 'webp'; contentType: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', contentType: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: 'png', contentType: 'image/png' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { extension: 'webp', contentType: 'image/webp' };
  return null;
}

export function safePathPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'stop';
}

const cleanText = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
  return trimmed || undefined;
};

// New photos are added to the ones already saved; a new signature or text replaces the old.
export function mergeProof(
  existing: StopProof | undefined,
  uploaded: { photos: string[]; signature?: string | undefined },
  fields: { receiverName?: unknown; notes?: unknown },
  now: Date = new Date(),
): StopProof {
  const photos = [...(existing?.photos ?? []), ...uploaded.photos].slice(-MAX_PROOF_PHOTOS);
  const receiverName = cleanText(fields.receiverName, 120) ?? existing?.receiverName;
  const notes = cleanText(fields.notes, 1000) ?? existing?.notes;
  const signature = uploaded.signature ?? existing?.signature;
  return {
    photos,
    ...(signature ? { signature } : {}),
    ...(receiverName ? { receiverName } : {}),
    ...(notes ? { notes } : {}),
    capturedAt: now.toISOString(),
  };
}

export interface EtaStop {
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  plannedArrival?: string | undefined;
  plannedServiceMinutes?: number | undefined;
  arrivedAt?: string | undefined;
  completedAt?: string | undefined;
}

// Shifts the planned arrival by however late (or early) the driver has been at the last stop finished, and never promises a time in the past.
export function estimateStopEta(stop: EtaStop, progress: EtaStop[], now: Date = new Date()): { estimatedArrival: string | null; delayMinutes: number | null } {
  if (stop.status === 'completed' || stop.status === 'arrived') {
    const reached = stop.arrivedAt ?? stop.completedAt;
    return { estimatedArrival: reached ?? null, delayMinutes: null };
  }
  const planned = stop.plannedArrival ? new Date(stop.plannedArrival).getTime() : Number.NaN;
  if (!Number.isFinite(planned)) return { estimatedArrival: null, delayMinutes: null };

  let delayMs = 0;
  let latest = Number.NEGATIVE_INFINITY;
  for (const item of progress) {
    if (item.status !== 'completed' || !item.completedAt || !item.plannedArrival) continue;
    const completed = new Date(item.completedAt).getTime();
    const expected = new Date(item.plannedArrival).getTime() + (item.plannedServiceMinutes ?? 0) * 60_000;
    if (!Number.isFinite(completed) || !Number.isFinite(expected) || completed < latest) continue;
    latest = completed;
    delayMs = completed - expected;
  }

  const eta = Math.max(now.getTime(), planned + delayMs);
  return { estimatedArrival: new Date(eta).toISOString(), delayMinutes: Math.round((eta - planned) / 60_000) };
}

export function stopsAhead(stop: { order: number }, progress: Array<{ order: number; status: string }>): number {
  return progress.filter(item => item.order < stop.order && (item.status === 'pending' || item.status === 'arrived')).length;
}
