import config from '@config';
import { googleMapsService } from './google-maps.service';

export type PricingEvidenceStatus = 'available' | 'unavailable' | 'error';

export interface PricingEvidenceSource<T> {
  provider: 'google_maps' | 'here' | 'openweather' | 'opis' | 'eia';
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
  fuel: PricingEvidenceSource<{
    pricePerGallon: number;
    currency: 'USD';
    fuelType: 'diesel';
    geographicLevel: 'station' | 'national';
    stationName?: string;
    stationAddress?: string;
    stationLatitude?: number;
    stationLongitude?: number;
    publishedPeriod?: string;
  }>;
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

function providerCode(prefix: string, value: unknown): string {
  const normalized = String(value || 'UNKNOWN')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${normalized || 'UNKNOWN'}`;
}

function parseGoogleDuration(value: unknown): number {
  const match = /^([0-9]+(?:\.[0-9]+)?)s$/.exec(String(value || ''));
  return match?.[1] ? Number(match[1]) : Number.NaN;
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
        fuel: await this.getFuelFallback(),
      };
    }

    const [traffic, tolls, weather, fuel] = await Promise.all([
      this.getTraffic(originCoordinates, destinationCoordinates),
      this.getTolls(originCoordinates, destinationCoordinates),
      this.getWeather(originCoordinates, destinationCoordinates),
      this.getFuel(originCoordinates),
    ]);

    return {
      traffic,
      tolls,
      weather,
      fuel,
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
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.googleMaps.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: origin.latitude, longitude: origin.longitude },
            },
          },
          destination: {
            location: {
              latLng: { latitude: destination.latitude, longitude: destination.longitude },
            },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          languageCode: 'en-US',
          units: 'IMPERIAL',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = asRecord(await response.json());
      const providerError = asRecord(body?.['error']);
      if (providerError?.['status']) {
        throw new Error(providerCode('ROUTES', providerError['status']));
      }
      if (!response.ok) {
        throw new Error(providerCode('HTTP', response.status));
      }
      const routes = Array.isArray(body?.['routes']) ? body['routes'] : [];
      const route = asRecord(routes[0]);
      const normalSeconds = parseGoogleDuration(route?.['staticDuration']);
      const trafficSeconds = parseGoogleDuration(route?.['duration']);

      if (!Number.isFinite(normalSeconds)) {
        throw new Error('STATIC_DURATION_MISSING');
      }
      if (!Number.isFinite(trafficSeconds)) {
        throw new Error('TRAFFIC_DURATION_MISSING');
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
    } catch (error) {
      const errorCode = error instanceof Error
        ? providerCode('TRAFFIC', error.message)
        : 'TRAFFIC_REQUEST_FAILED';
      return failed('google_maps', startedAt, errorCode, 5);
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

  private async getFuel(origin: Coordinates): Promise<PricingLiveEvidence['fuel']> {
    const stationPrice = await this.getGoogleDieselPrice(origin);
    if (stationPrice.status === 'available') return stationPrice;
    return this.getFuelFallback(stationPrice.errorCode);
  }

  private async getGoogleDieselPrice(origin: Coordinates): Promise<PricingLiveEvidence['fuel']> {
    if (!config.googleMaps.apiKey) {
      return unavailable('google_maps', 'PROVIDER_NOT_CONFIGURED', 15);
    }

    const startedAt = Date.now();
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.googleMaps.apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.fuelOptions',
        },
        body: JSON.stringify({
          textQuery: 'diesel fuel station',
          pageSize: 10,
          locationBias: {
            circle: {
              center: origin,
              radius: 25_000,
            },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = asRecord(await response.json());
      const providerError = asRecord(body?.['error']);
      if (providerError?.['status']) {
        throw new Error(providerCode('PLACES', providerError['status']));
      }
      if (!response.ok) {
        throw new Error(providerCode('HTTP', response.status));
      }

      const places = Array.isArray(body?.['places']) ? body['places'] : [];
      for (const placeValue of places) {
        const place = asRecord(placeValue);
        const fuelOptions = asRecord(place?.['fuelOptions']);
        const fuelPrices = Array.isArray(fuelOptions?.['fuelPrices']) ? fuelOptions['fuelPrices'] : [];
        for (const fuelPriceValue of fuelPrices) {
          const fuelPrice = asRecord(fuelPriceValue);
          if (String(fuelPrice?.['type']).toUpperCase() !== 'DIESEL') continue;
          const money = asRecord(fuelPrice?.['price']);
          const units = Number(money?.['units']);
          const nanos = Number(money?.['nanos'] ?? 0);
          const pricePerGallon = units + nanos / 1_000_000_000;
          if (!Number.isFinite(pricePerGallon) || pricePerGallon <= 0) continue;

          const displayName = asRecord(place?.['displayName']);
          const location = asRecord(place?.['location']);
          const providerObservedAt = new Date(String(fuelPrice?.['updateTime'] || ''));
          const observedAt = Number.isNaN(providerObservedAt.getTime()) ? new Date() : providerObservedAt;
          return {
            provider: 'google_maps',
            status: 'available',
            observedAt: observedAt.toISOString(),
            freshUntil: expiresAt(observedAt, 60),
            latencyMs: Date.now() - startedAt,
            evidence: {
              pricePerGallon,
              currency: 'USD',
              fuelType: 'diesel',
              geographicLevel: 'station',
              stationName: String(displayName?.['text'] || 'Fuel station'),
              stationAddress: String(place?.['formattedAddress'] || ''),
              stationLatitude: Number(location?.['latitude']),
              stationLongitude: Number(location?.['longitude']),
            },
          };
        }
      }
      return unavailable('google_maps', 'DIESEL_PRICE_NOT_AVAILABLE', 15);
    } catch (error) {
      const errorCode = error instanceof Error
        ? providerCode('FUEL', error.message)
        : 'FUEL_REQUEST_FAILED';
      return failed('google_maps', startedAt, errorCode, 15);
    }
  }

  private async getFuelFallback(primaryErrorCode?: string): Promise<PricingLiveEvidence['fuel']> {
    if (!config.eia.apiKey) {
      return unavailable('eia', primaryErrorCode || 'PROVIDER_NOT_CONFIGURED', 60);
    }

    const startedAt = Date.now();
    try {
      const url = new URL(`${config.eia.baseUrl}/petroleum/pri/gnd/data/`);
      url.searchParams.set('api_key', config.eia.apiKey);
      url.searchParams.set('frequency', 'weekly');
      url.searchParams.set('data[0]', 'value');
      url.searchParams.set('facets[series][]', 'EMD_EPD2D_PTE_NUS_DPG');
      url.searchParams.set('sort[0][column]', 'period');
      url.searchParams.set('sort[0][direction]', 'desc');
      url.searchParams.set('offset', '0');
      url.searchParams.set('length', '1');

      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = asRecord(await response.json());
      const responseBody = asRecord(body?.['response']);
      const rows = Array.isArray(responseBody?.['data']) ? responseBody['data'] : [];
      const row = asRecord(rows[0]);
      const pricePerGallon = Number(row?.['value']);
      const publishedPeriod = String(row?.['period'] || '');
      if (!response.ok || !Number.isFinite(pricePerGallon) || pricePerGallon <= 0 || !publishedPeriod) {
        throw new Error('EIA_RESPONSE_INVALID');
      }

      const observedAt = new Date(`${publishedPeriod}T00:00:00.000Z`);
      return {
        provider: 'eia',
        status: 'available',
        observedAt: observedAt.toISOString(),
        freshUntil: expiresAt(observedAt, 8 * 24 * 60),
        latencyMs: Date.now() - startedAt,
        evidence: {
          pricePerGallon,
          currency: 'USD',
          fuelType: 'diesel',
          geographicLevel: 'national',
          publishedPeriod,
        },
      };
    } catch (error) {
      const errorCode = error instanceof Error
        ? providerCode('EIA', error.message)
        : 'EIA_REQUEST_FAILED';
      return failed('eia', startedAt, errorCode, 60);
    }
  }
}

export const pricingLiveEvidenceService = new PricingLiveEvidenceService();