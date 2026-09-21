import config from '@config';

export interface CommercialVehicleProfile {
  heightFeet?: number | undefined;
  widthFeet?: number | undefined;
  lengthFeet?: number | undefined;
  grossWeightPounds?: number | undefined;
  axleCount?: number | undefined;
  hazmatTypes?: string[] | undefined;
}

export interface CommercialDirectionsResult {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  startAddress: string;
  endAddress: string;
  polyline: string;
}

const HAZMAT_TYPES = new Set([
  'explosive',
  'gas',
  'flammable',
  'combustible',
  'organic',
  'poison',
  'radioactive',
  'corrosive',
  'poisonousInhalation',
  'harmfulToWater',
  'other',
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function positiveNumber(value: number | undefined, field: string, maximum: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`${field} must be greater than zero and no more than ${maximum}`);
  }
  return value;
}

export class CommercialRoutingService {
  validateProfile(profile: CommercialVehicleProfile): CommercialVehicleProfile {
    const heightFeet = positiveNumber(profile.heightFeet, 'commercialVehicle.heightFeet', 20);
    const widthFeet = positiveNumber(profile.widthFeet, 'commercialVehicle.widthFeet', 20);
    const lengthFeet = positiveNumber(profile.lengthFeet, 'commercialVehicle.lengthFeet', 150);
    const grossWeightPounds = positiveNumber(profile.grossWeightPounds, 'commercialVehicle.grossWeightPounds', 500_000);
  const axleCount = positiveNumber(profile.axleCount, 'commercialVehicle.axleCount', 20);
    if (axleCount !== undefined && !Number.isInteger(axleCount)) {
      throw new Error('commercialVehicle.axleCount must be an integer');
    }
    const hazmatTypes = [...new Set(profile.hazmatTypes ?? [])];
    const unsupportedHazmat = hazmatTypes.find(type => !HAZMAT_TYPES.has(type));
    if (unsupportedHazmat) throw new Error(`Unsupported hazmat type: ${unsupportedHazmat}`);
    if (!heightFeet && !widthFeet && !lengthFeet && !grossWeightPounds && !axleCount && hazmatTypes.length === 0) {
      throw new Error('commercialVehicle must include at least one dimension, weight, axle, or hazmat restriction');
    }
    return {
      ...(heightFeet !== undefined ? { heightFeet } : {}),
      ...(widthFeet !== undefined ? { widthFeet } : {}),
      ...(lengthFeet !== undefined ? { lengthFeet } : {}),
      ...(grossWeightPounds !== undefined ? { grossWeightPounds } : {}),
      ...(axleCount !== undefined ? { axleCount } : {}),
      ...(hazmatTypes.length > 0 ? { hazmatTypes } : {}),
    };
  }

  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    profileInput: CommercialVehicleProfile,
    avoidHighways: boolean
  ): Promise<CommercialDirectionsResult> {
    if (!config.here.apiKey) {
      throw new Error('Commercial truck routing is unavailable because HERE_API_KEY is not configured');
    }
    const profile = this.validateProfile(profileInput);
    const url = new URL(`${config.here.routingBaseUrl}/routes`);
    url.searchParams.set('transportMode', 'truck');
    url.searchParams.set('routingMode', 'fast');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('return', 'summary,polyline');
    url.searchParams.set('apikey', config.here.apiKey);
    if (avoidHighways) url.searchParams.set('avoid[features]', 'controlledAccessHighway');
    if (profile.heightFeet !== undefined) url.searchParams.set('vehicle[height]', String(Math.round(profile.heightFeet * 30.48)));
    if (profile.widthFeet !== undefined) url.searchParams.set('vehicle[width]', String(Math.round(profile.widthFeet * 30.48)));
    if (profile.lengthFeet !== undefined) url.searchParams.set('vehicle[length]', String(Math.round(profile.lengthFeet * 30.48)));
    if (profile.grossWeightPounds !== undefined) url.searchParams.set('vehicle[grossWeight]', String(Math.round(profile.grossWeightPounds * 0.453592)));
    if (profile.axleCount !== undefined) url.searchParams.set('vehicle[axleCount]', String(profile.axleCount));
    if (profile.hazmatTypes?.length) url.searchParams.set('vehicle[shippedHazardousGoods]', profile.hazmatTypes.join(','));

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = asRecord(await response.json());
    const routes = Array.isArray(body?.['routes']) ? body['routes'] : [];
    const route = asRecord(routes[0]);
    const sections = Array.isArray(route?.['sections']) ? route['sections'] : [];
    if (!response.ok || sections.length === 0) {
      const title = asRecord(body?.['error'])?.['title'];
      throw new Error(`No compliant commercial-truck route found${title ? `: ${String(title)}` : ''}`);
    }

    let distance = 0;
    let duration = 0;
    let polyline = '';
    for (const sectionValue of sections) {
      const section = asRecord(sectionValue);
      const summary = asRecord(section?.['summary']);
      distance += Number(summary?.['length'] ?? 0);
      duration += Number(summary?.['duration'] ?? 0);
      if (!polyline && typeof section?.['polyline'] === 'string') polyline = section['polyline'];
    }
    if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('Commercial routing provider returned an invalid route summary');
    }

    return {
      distance: { text: `${(distance / 1609.34).toFixed(1)} mi`, value: distance },
      duration: { text: `${Math.round(duration / 60)} min`, value: duration },
      startAddress: `${origin.lat},${origin.lng}`,
      endAddress: `${destination.lat},${destination.lng}`,
      polyline,
    };
  }
}

export const commercialRoutingService = new CommercialRoutingService();
