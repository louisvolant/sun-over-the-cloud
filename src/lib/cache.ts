// src/lib/cache.ts
//
// Cache layer backed by Cloudflare KV. Used for data that is global, cheap to
// recompute and safe to lose: geocoding results and Open-Meteo day summaries.
// Values are stored as JSON with an explicit TTL, so entries expire on their own.
import { getEnv } from './cloudflare';

const GEOCODE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DAY_SUMMARY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MONTH_SUMMARY_PAST_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MONTH_SUMMARY_CURRENT_TTL_SECONDS = 60 * 60 * 2; // 2 hours

const geocodeKey = (lang: string, city: string) => `geocode:${lang}:${city.trim().toLowerCase()}`;
const daySummaryKey = (lat: number, lon: number, date: string) => `daysummary:${lat}:${lon}:${date}`;
const monthSummaryKey = (lat: number, lon: number, year: number, month: number) =>
  `monthsummary:${lat.toFixed(3)}:${lon.toFixed(3)}:${year}-${String(month).padStart(2, '0')}`;

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

export async function getMonthSummaryCache<T>(
  lat: number,
  lon: number,
  year: number,
  month: number
): Promise<T | null> {
  return getEnv().CACHE.get<T>(monthSummaryKey(lat, lon, year, month), 'json');
}

export async function setMonthSummaryCache<T>(
  lat: number,
  lon: number,
  year: number,
  month: number,
  isCurrentMonth: boolean,
  data: T
): Promise<void> {
  await getEnv().CACHE.put(monthSummaryKey(lat, lon, year, month), JSON.stringify(data), {
    expirationTtl: isCurrentMonth
      ? MONTH_SUMMARY_CURRENT_TTL_SECONDS
      : MONTH_SUMMARY_PAST_TTL_SECONDS,
  });
}
