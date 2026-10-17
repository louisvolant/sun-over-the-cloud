// src/services/metNorwayService.ts
import * as SunCalc from 'suncalc';
import tzLookup from 'tz-lookup';
import { MinutelyCastSlot } from '@/lib/types';

const MET_API_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_USER_AGENT = 'SunOverTheCloud/1.0 (https://github.com/louisvolant/sun-over-the-cloud; contact@sunoverthecloud.com)';
// Bound the outbound call so a slow MET Norway response can never make a
// Worker handler hang (axios used to rely on the Node.js http stack and hang
// until the runtime cancelled the request).
const MET_TIMEOUT_MS = 10_000;
const MINUTELY_15_CACHE_TTL_MS = 10 * 60 * 1000;

// Minimal typings for the MET Norway timeseries fields consumed by this service.
interface MetInstantDetails {
  air_temperature?: number;
  relative_humidity?: number;
  wind_speed?: number;
  wind_from_direction?: number;
  air_pressure_at_sea_level?: number;
  cloud_area_fraction?: number;
}

interface MetHoursBlock {
  summary?: { symbol_code?: string };
  details?: { precipitation_amount?: number };
}

interface MetTimeseriesPoint {
  time: string;
  data?: {
    instant?: { details?: MetInstantDetails };
    next_1_hours?: MetHoursBlock;
    next_6_hours?: MetHoursBlock;
    next_12_hours?: MetHoursBlock;
  };
}

interface CachedEntry {
  data: unknown;
  expiresAt: number;
  lastModified?: string;
}

const metCache = new Map<string, CachedEntry>();

/**
 * Calculate Steadman apparent temperature (feels like) based on air temperature, humidity, and wind speed.
 */
export function calculateFeelsLike(temp: number | null | undefined, humidity: number | null | undefined, windSpeed: number | null | undefined): number {
  if (temp == null) return 0;
  const rh = humidity ?? 50;
  const ws = windSpeed ?? 0;
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
  const at = temp + 0.33 * e - 0.70 * ws - 4.0;
  return Math.round(at * 10) / 10;
}

/**
 * Calculate UTC offset in seconds for a given IANA timezone.
 */
export function getTimezoneOffsetSeconds(timeZone: string): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
    return (tzDate.getTime() - utcDate.getTime()) / 1000;
  } catch {
    return 0;
  }
}

/**
 * Map MET Norway weather symbol_code to OpenWeather-compatible condition info.
 */
export function mapMetSymbolToWeather(symbolCode?: string) {
  if (!symbolCode) {
    return { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' };
  }

  const isNight = symbolCode.includes('_night');
  const baseCode = symbolCode.replace(/_(day|night|polartwilight)$/, '');

  switch (baseCode) {
    case 'clearsky':
      return { id: 800, main: 'Clear', description: 'clear sky', icon: isNight ? '01n' : '01d' };
    case 'fair':
      return { id: 801, main: 'Clouds', description: 'few clouds', icon: isNight ? '02n' : '02d' };
    case 'partlycloudy':
      return { id: 802, main: 'Clouds', description: 'scattered clouds', icon: isNight ? '03n' : '03d' };
    case 'cloudy':
      return { id: 804, main: 'Clouds', description: 'overcast clouds', icon: isNight ? '04n' : '04d' };
    case 'lightrainshowers':
      return { id: 520, main: 'Rain', description: 'light intensity shower rain', icon: isNight ? '09n' : '09d' };
    case 'rainshowers':
      return { id: 521, main: 'Rain', description: 'shower rain', icon: isNight ? '09n' : '09d' };
    case 'heavyrainshowers':
      return { id: 522, main: 'Rain', description: 'heavy intensity shower rain', icon: isNight ? '09n' : '09d' };
    case 'lightrain':
      return { id: 500, main: 'Rain', description: 'light rain', icon: isNight ? '10n' : '10d' };
    case 'rain':
      return { id: 501, main: 'Rain', description: 'moderate rain', icon: isNight ? '10n' : '10d' };
    case 'heavyrain':
      return { id: 502, main: 'Rain', description: 'heavy intensity rain', icon: isNight ? '10n' : '10d' };
    case 'lightrainandthunder':
    case 'lightrainshowersandthunder':
      return { id: 200, main: 'Thunderstorm', description: 'thunderstorm with light rain', icon: isNight ? '11n' : '11d' };
    case 'rainandthunder':
    case 'rainshowersandthunder':
      return { id: 201, main: 'Thunderstorm', description: 'thunderstorm with rain', icon: isNight ? '11n' : '11d' };
    case 'heavyrainandthunder':
    case 'heavyrainshowersandthunder':
      return { id: 202, main: 'Thunderstorm', description: 'thunderstorm with heavy rain', icon: isNight ? '11n' : '11d' };
    case 'lightsnow':
      return { id: 600, main: 'Snow', description: 'light snow', icon: isNight ? '13n' : '13d' };
    case 'snow':
      return { id: 601, main: 'Snow', description: 'snow', icon: isNight ? '13n' : '13d' };
    case 'heavysnow':
      return { id: 602, main: 'Snow', description: 'heavy snow', icon: isNight ? '13n' : '13d' };
    case 'lightsnowshowers':
    case 'snowshowers':
    case 'heavysnowshowers':
      return { id: 621, main: 'Snow', description: 'shower snow', icon: isNight ? '13n' : '13d' };
    case 'sleet':
    case 'lightsleet':
    case 'heavysleet':
    case 'sleetshowers':
      return { id: 611, main: 'Snow', description: 'sleet', icon: isNight ? '13n' : '13d' };
    case 'fog':
      return { id: 741, main: 'Fog', description: 'fog', icon: isNight ? '50n' : '50d' };
    default:
      if (baseCode.includes('thunder')) {
        return { id: 211, main: 'Thunderstorm', description: 'thunderstorm', icon: isNight ? '11n' : '11d' };
      }
      if (baseCode.includes('snow') || baseCode.includes('sleet')) {
        return { id: 601, main: 'Snow', description: 'snow', icon: isNight ? '13n' : '13d' };
      }
      if (baseCode.includes('rain')) {
        return { id: 500, main: 'Rain', description: 'light rain', icon: isNight ? '10n' : '10d' };
      }
      return { id: 800, main: 'Clear', description: 'clear sky', icon: isNight ? '01n' : '01d' };
  }
}

/**
 * Fetch raw Locationforecast 2.0 data from MET Norway with strict User-Agent and Expires caching.
 */
export async function fetchLocationForecast(latitude: number, longitude: number) {
  const lat = Number(latitude.toFixed(4));
  const lon = Number(longitude.toFixed(4));
  const cacheKey = `${lat},${lon}`;

  const cached = metCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt && now < cached.expiresAt) {
    return cached.data;
  }

  const userAgent = process.env.MET_NO_USER_AGENT || DEFAULT_USER_AGENT;
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'application/json',
  };

  if (cached && cached.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  try {
    // Use native fetch instead of axios: axios relies on the Node.js http stack
    // and can hang on Cloudflare Workers until the runtime cancels the request
    // ("Worker's code had hung"). AbortSignal.timeout keeps the whole call
    // bounded, and 304 is treated as a valid response like before.
    const query = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    const response = await fetch(`${MET_API_URL}?${query.toString()}`, {
      headers,
      signal: AbortSignal.timeout(MET_TIMEOUT_MS),
    });

    if (!response.ok && response.status !== 304) {
      throw new Error(`MET Norway responded with status ${response.status}`);
    }

    const expiresHeader = response.headers.get('expires');
    const newExpiresAt = expiresHeader ? new Date(expiresHeader).getTime() : now + 30 * 60 * 1000;

    if (response.status === 304 && cached) {
      cached.expiresAt = newExpiresAt;
      return cached.data;
    }

    const lastModifiedHeader = response.headers.get('last-modified');
    const forecastData = await response.json();

    metCache.set(cacheKey, {
      data: forecastData,
      expiresAt: newExpiresAt,
      lastModified: lastModifiedHeader || undefined,
    });

    return forecastData;
  } catch (error: unknown) {
    if (cached && cached.data) {
      console.warn(`MET Norway request failed (${error instanceof Error ? error.message : error}), returning stale cache for ${cacheKey}`);
      return cached.data;
    }
    throw error;
  }
}

const minutely15Cache = new Map<string, { data: MinutelyCastSlot[]; expiresAt: number }>();

/**
 * Fetch 15-minute high-resolution precipitation slots from Open-Meteo for the upcoming hours.
 * Best-effort: returns an empty array if the upstream request fails so /api/onecall never breaks.
 */
export async function fetchMinutely15Precipitation(latitude: number, longitude: number): Promise<MinutelyCastSlot[]> {
  const lat = Number(latitude.toFixed(4));
  const lon = Number(longitude.toFixed(4));
  const cacheKey = `m15_${lat},${lon}`;
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  const cached = minutely15Cache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.data.filter((slot) => slot.dt + 900 > nowSec);
  }

  try {
    const query = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      minutely_15: 'precipitation,rain,snowfall',
      forecast_minutely_15: '12',
      timeformat: 'unixtime',
    });

    const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${query.toString()}`, {
      signal: AbortSignal.timeout(MET_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo minutely_15 responded with status ${response.status}`);
    }

    const payload = await response.json();
    const minutely = payload?.minutely_15;
    const times: number[] = Array.isArray(minutely?.time) ? minutely.time : [];
    const precipArr: number[] = Array.isArray(minutely?.precipitation) ? minutely.precipitation : [];
    const rainArr: number[] = Array.isArray(minutely?.rain) ? minutely.rain : [];
    const snowArr: number[] = Array.isArray(minutely?.snowfall) ? minutely.snowfall : [];

    const slots: MinutelyCastSlot[] = times.map((dt, index) => ({
      dt,
      precipitation: Number(precipArr[index] ?? 0),
      rain: Number(rainArr[index] ?? 0),
      snowfall: Number(snowArr[index] ?? 0),
    }));

    minutely15Cache.set(cacheKey, {
      data: slots,
      expiresAt: now + MINUTELY_15_CACHE_TTL_MS,
    });

    return slots.filter((slot) => slot.dt + 900 > nowSec);
  } catch (error: unknown) {
    if (cached && cached.data) {
      return cached.data.filter((slot) => slot.dt + 900 > nowSec);
    }
    console.warn(`Open-Meteo minutely_15 fetch failed for ${cacheKey}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get current weather, next-24h rain/snow summary, and 15-minute precipitation slots compatible with /api/onecall.
 */
export async function getCurrentWeather(latitude: number, longitude: number) {
  const lat = Number(latitude.toFixed(4));
  const lon = Number(longitude.toFixed(4));

  const [forecast, minutely15Slots] = await Promise.all([
    fetchLocationForecast(lat, lon),
    fetchMinutely15Precipitation(lat, lon),
  ]);
  const timeseries = (forecast?.properties?.timeseries ?? []) as MetTimeseriesPoint[];

  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather timeseries data received from MET Norway');
  }

  const currentPoint = timeseries[0];
  const instant = currentPoint.data?.instant?.details;

  const symbolCode =
    currentPoint.data?.next_1_hours?.summary?.symbol_code ||
    currentPoint.data?.next_6_hours?.summary?.symbol_code ||
    currentPoint.data?.next_12_hours?.summary?.symbol_code;

  const weatherInfo = mapMetSymbolToWeather(symbolCode);

  const temp = instant?.air_temperature ?? 0;
  const humidity = instant?.relative_humidity ?? 0;
  const windSpeed = instant?.wind_speed ?? 0;
  const feelsLike = calculateFeelsLike(temp, humidity, windSpeed);

  let timezone = 'UTC';
  try {
    timezone = tzLookup(lat, lon);
  } catch (err: unknown) {
    console.warn(`Timezone lookup failed for lat=${lat}, lon=${lon}:`, err instanceof Error ? err.message : err);
  }
  const timezoneOffset = getTimezoneOffsetSeconds(timezone);

  const sunTimes = SunCalc.getTimes(new Date(), lat, lon);
  const sunrise = sunTimes.sunrise ? Math.floor(sunTimes.sunrise.getTime() / 1000) : 0;
  const sunset = sunTimes.sunset ? Math.floor(sunTimes.sunset.getTime() / 1000) : 0;

  let rainTotal = 0;
  let snowTotal = 0;
  const next24hPoints = timeseries.slice(0, 24);
  for (const point of next24hPoints) {
    const p1 = point.data?.next_1_hours;
    const precip = p1?.details?.precipitation_amount || 0;
    const sCode = p1?.summary?.symbol_code || '';
    if (sCode.includes('snow') || sCode.includes('sleet')) {
      snowTotal += precip;
    } else {
      rainTotal += precip;
    }
  }

  return {
    current: {
      temp,
      feels_like: feelsLike,
      humidity,
      pressure: instant?.air_pressure_at_sea_level ?? 1013,
      weather: [
        {
          id: weatherInfo.id,
          main: weatherInfo.main,
          description: weatherInfo.description,
          icon: weatherInfo.icon,
        },
      ],
      wind_speed: windSpeed,
      wind_deg: instant?.wind_from_direction ?? 0,
      clouds: Math.round(instant?.cloud_area_fraction ?? 0),
      visibility: 10000,
      sunrise,
      sunset,
    },
    daily: [
      {
        rain: rainTotal > 0 ? Math.round(rainTotal * 10) / 10 : null,
        snow: snowTotal > 0 ? Math.round(snowTotal * 10) / 10 : null,
      },
    ],
    minutely_15: minutely15Slots.slice(0, 8),
    timezone,
    timezone_offset: timezoneOffset,
  };
}

/**
 * Get multi-day forecast compatible with /api/forecast list format.
 */
export async function getForecast(latitude: number, longitude: number) {
  const lat = Number(latitude.toFixed(4));
  const lon = Number(longitude.toFixed(4));

  const forecast = await fetchLocationForecast(lat, lon);
  const timeseries = (forecast?.properties?.timeseries ?? []) as MetTimeseriesPoint[];

  if (!timeseries || timeseries.length === 0) {
    throw new Error('No forecast data received from MET Norway');
  }

  const list = timeseries.map((item) => {
    const dt = Math.floor(new Date(item.time).getTime() / 1000);
    const instant = item.data?.instant?.details;
    const symbolCode =
      item.data?.next_1_hours?.summary?.symbol_code ||
      item.data?.next_6_hours?.summary?.symbol_code ||
      item.data?.next_12_hours?.summary?.symbol_code;

    const weatherInfo = mapMetSymbolToWeather(symbolCode);

    return {
      dt,
      main: {
        temp: instant?.air_temperature ?? 0,
      },
      weather: [
        {
          id: weatherInfo.id,
          main: weatherInfo.main,
          description: weatherInfo.description,
          icon: weatherInfo.icon,
        },
      ],
    };
  });

  return { list };
}
