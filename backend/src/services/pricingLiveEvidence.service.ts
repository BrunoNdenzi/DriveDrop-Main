import config from '@config';
import { googleMapsService } from './google-maps.service';

export type PricingEvidenceStatus = 'available' | 'unavailable' | 'error';

export interface PricingEvidenceSource<T> {
  provider: 'google_maps' | 'here' | 'openweather' | 'opis';
  status: PricingEvidenceStatus;
  observedAt: string;
  freshUntil: string;
  latencyMs: number;
  evidence?: T;
  errorCode?: string;
}

export interface PricingLiveEvidence {
  traffic: PricingEvidenceSource<{
    normalDurationSeconds: number;
    trafficDurationSeconds: number;
    delaySeconds: number;
    delayPercent: number;
  }>;
  tolls: PricingEvidenceSource<{
    currency: string;
    estimatedAmount: number;
    tollCount: number;
  }>;
  weather: PricingEvidenceSource<{
    condition: string;
    temperatureFahrenheit: number;
    windSpeedMph: number;
    precipitationOneHourInches: number;
  }>;
  fuel: PricingEvidenceSource<Record<string, never>>;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

const TIMEOUT_MS = 4000;

function expiresAt(observedAt: Date, minutes: number): string {
  return new Date(observedAt.getTime() + minutes * 60_000).toISOString();
}

function unavailable<T>(
  provider: PricingEvidenceSource<T>['provider'],
  errorCode: string,
  freshnessMinutes: number
): PricingEvidenceSource<T> {
  const observedAt = new Date();
  return {
    provider,
    status: 'unavailable',
    observedAt: observedAt.toISOString(),
    freshUntil: expiresAt(observedAt, freshnessMinutes),
    latencyMs: 0,
    errorCode,
  };
}

function failed<T>(
  provider: PricingEvidenceSource<T>['provider'],
  startedAt: number,
  errorCode: string,
  freshnessMinutes: number
): PricingEvidenceSource<T> {
  const observedAt = new Date();
  return {
    provider,
    status: 'error',
    observedAt: observedAt.toISOString(),
    freshUntil: expiresAt(observedAt, freshnessMinutes),
    latencyMs: Date.now() - startedAt,
    errorCode,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined;
}

class PricingLiveEvidenceService {
  async collect(origin: string, destination: string): Promise<PricingLiveEvidence> {
    let originCoordinates: Coordinates;
    let destinationCoordinates: Coordinates;

    try {
      const [originResult, destinationResult] = await Promise.all([
        googleMapsService.geocodeAddress(origin),
        googleMapsService.geocodeAddress(destination),
      ]);
      originCoordinates = originResult;
      destinationCoordinates = destinationResult;
    } catch {
      return {
        traffic: unavailable('google_maps', 'GEOCODING_UNAVAILABLE', 5),
        tolls: unavailable('here', 'GEOCODING_UNAVAILABLE', 5),
        weather: unavailable('openweather', 'GEOCODING_UNAVAILABLE', 5),
        fuel: this.getFuelAvailability(),
      };
    }

    const [traffic, tolls, weather] = await Promise.all([
      this.getTraffic(originCoordinates, destinationCoordinates),
      this.getTolls(originCoordinates, destinationCoordinates),
      this.getWeather(originCoordinates, destinationCoordinates),
    ]);

    return {
      traffic,
      tolls,
      weather,
      fuel: this.getFuelAvailability(),
    };
  }

  private async getTraffic(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<PricingLiveEvidence['traffic']> {
    if (!config.googleMaps.apiKey) {
      return unavailable('google_maps', 'PROVIDER_NOT_CONFIGURED', 5);
    }

    const startedAt = Date.now();
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', `${origin.latitude},${origin.longitude}`);
      url.searchParams.set('destinations', `${destination.latitude},${destination.longitude}`);
      url.searchParams.set('departure_time', 'now');
      url.searchParams.set('traffic_model', 'best_guess');
      url.searchParams.set('units', 'imperial');
      url.searchParams.set('key', config.googleMaps.apiKey);

      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = asRecord(await response.json());
      const rows = Array.isArray(body?.['rows']) ? body['rows'] : [];
      const firstRow = asRecord(rows[0]);
      const elements = Array.isArray(firstRow?.['elements']) ? firstRow['elements'] : [];
      const element = asRecord(elements[0]);
      const duration = asRecord(element?.['duration']);
      const durationInTraffic = asRecord(element?.['duration_in_traffic']);
      const normalSeconds = Number(duration?.['value']);
      const trafficSeconds = Number(durationInTraffic?.['value']);

      if (!response.ok || !Number.isFinite(normalSeconds) || !Number.isFinite(trafficSeconds)) {
        throw new Error('TRAFFIC_RESPONSE_INVALID');
      }

      const observedAt = new Date();
      const delaySeconds = Math.max(0, trafficSeconds - normalSeconds);
      return {
        provider: 'google_maps',
        status: 'available',
        observedAt: observedAt.toISOString(),
        freshUntil: expiresAt(observedAt, 15),
        latencyMs: Date.now() - startedAt,
        evidence: {
          normalDurationSeconds: normalSeconds,
          trafficDurationSeconds: trafficSeconds,
          delaySeconds,
          delayPercent: normalSeconds > 0 ? (delaySeconds / normalSeconds) * 100 : 0,
        },
      };
    } catch {
      return failed('google_maps', startedAt, 'TRAFFIC_REQUEST_FAILED', 5);
    }
  }

  private async getTolls(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<PricingLiveEvidence['tolls']> {
    if (!config.here.apiKey) {
      return unavailable('here', 'PROVIDER_NOT_CONFIGURED', 15);
    }

    const startedAt = Date.now();
    try {
      const url = new URL(`${config.here.routingBaseUrl}/routes`);
      url.searchParams.set('transportMode', 'truck');
      url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
      url.searchParams.set('destination', `${destination.latitude},${destination.longitude}`);
      url.searchParams.set('return', 'summary,tolls');
      url.searchParams.set('currency', 'USD');
      url.searchParams.set('apikey', config.here.apiKey);

      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = asRecord(await response.json());
      const routes = Array.isArray(body?.['routes']) ? body['routes'] : [];
      const route = asRecord(routes[0]);
      const sections = Array.isArray(route?.['sections']) ? route['sections'] : [];
      const tolls = sections.flatMap(sectionValue => {
        const section = asRecord(sectionValue);
        return Array.isArray(section?.['tolls']) ? section['tolls'] : [];
      });
      let estimatedAmount = 0;
      for (const tollValue of tolls) {
        const toll = asRecord(tollValue);
        const fares = Array.isArray(toll?.['fares']) ? toll['fares'] : [];
        for (const fareValue of fares) {
          const fare = asRecord(fareValue);
          const price = asRecord(fare?.['price']);
          const value = Number(price?.['value']);
          if (Number.isFinite(value)) estimatedAmount += value;
        }
      }

      if (!response.ok || !route) {
        throw new Error('TOLL_RESPONSE_INVALID');
      }

      const observedAt = new Date();
      return {
        provider: 'here',
        status: 'available',
        observedAt: observedAt.toISOString(),
        freshUntil: expiresAt(observedAt, 60),
        latencyMs: Date.now() - startedAt,
        evidence: { currency: 'USD', estimatedAmount, tollCount: tolls.length },
      };
    } catch {
      return failed('here', startedAt, 'TOLL_REQUEST_FAILED', 15);
    }
  }

  private async getWeather(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<PricingLiveEvidence['weather']> {
    if (!config.openWeather.apiKey) {
      return unavailable('openweather', 'PROVIDER_NOT_CONFIGURED', 15);
    }

    const startedAt = Date.now();
    try {
      const latitude = (origin.latitude + destination.latitude) / 2;
      const longitude = (origin.longitude + destination.longitude) / 2;
      const url = new URL(`${config.openWeather.baseUrl}/weather`);
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('units', 'imperial');
      url.searchParams.set('appid', config.openWeather.apiKey);

      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = asRecord(await response.json());
      const weather = Array.isArray(body?.['weather']) ? asRecord(body['weather'][0]) : undefined;
      const main = asRecord(body?.['main']);
      const wind = asRecord(body?.['wind']);
      const rain = asRecord(body?.['rain']);
      const snow = asRecord(body?.['snow']);
      const temperature = Number(main?.['temp']);
      const windSpeed = Number(wind?.['speed']);

      if (!response.ok || !weather || !Number.isFinite(temperature) || !Number.isFinite(windSpeed)) {
        throw new Error('WEATHER_RESPONSE_INVALID');
      }

      const observedAt = new Date();
      const precipitation = Number(rain?.['1h'] ?? snow?.['1h'] ?? 0);
      return {
        provider: 'openweather',
        status: 'available',
        observedAt: observedAt.toISOString(),
        freshUntil: expiresAt(observedAt, 30),
        latencyMs: Date.now() - startedAt,
        evidence: {
          condition: String(weather['main'] || 'unknown'),
          temperatureFahrenheit: temperature,
          windSpeedMph: windSpeed,
          precipitationOneHourInches: Number.isFinite(precipitation) ? precipitation / 25.4 : 0,
        },
      };
    } catch {
      return failed('openweather', startedAt, 'WEATHER_REQUEST_FAILED', 15);
    }
  }

  private getFuelAvailability(): PricingLiveEvidence['fuel'] {
    return unavailable(
      'opis',
      config.opis.enabled ? 'PRODUCT_CONTRACT_NOT_CONFIGURED' : 'PROVIDER_NOT_ENABLED',
      60
    );
  }
}

export const pricingLiveEvidenceService = new PricingLiveEvidenceService();