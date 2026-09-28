// src/lib/cache.ts
//
// Cache layer backed by Cloudflare KV. Used for data that is global, cheap to
// recompute and safe to lose: geocoding results and Open-Meteo day summaries.
// Values are stored as JSON with an explicit TTL, so entries expire on their own.
import { getEnv } from './cloudflare';

const GEOCODE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DAY_SUMMARY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const geocodeKey = (lang: string, city: string) => `geocode:${lang}:${city.trim().toLowerCase()}`;
const daySummaryKey = (lat: number, lon: number, date: string) => `daysummary:${lat}:${lon}:${date}`;

export async function getGeocodeCache<T>(lang: string, city: string): Promise<T | null> {
  return getEnv().CACHE.get<T>(geocodeKey(lang, city), 'json');
}

export async function setGeocodeCache<T>(lang: string, city: string, data: T): Promise<void> {
  await getEnv().CACHE.put(geocodeKey(lang, city), JSON.stringify(data), {
    expirationTtl: GEOCODE_TTL_SECONDS,
  });
}

export async function getDaySummaryCache<T>(
  lat: number,
  lon: number,
  date: string
): Promise<T | null> {
  return getEnv().CACHE.get<T>(daySummaryKey(lat, lon, date), 'json');
}

export async function setDaySummaryCache<T>(
  lat: number,
  lon: number,
  date: string,
  data: T
): Promise<void> {
  await getEnv().CACHE.put(daySummaryKey(lat, lon, date), JSON.stringify(data), {
    expirationTtl: DAY_SUMMARY_TTL_SECONDS,
  });
}
