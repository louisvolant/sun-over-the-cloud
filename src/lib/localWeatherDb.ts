// src/lib/localWeatherDb.ts
'use client';

import { WeatherData, ForecastData, FavoriteLocation } from './types';

export interface LocalCachedWeather {
  key: string;
  location: {
    name: string;
    country?: string;
    lat: number;
    lon: number;
    location_name?: string;
  };
  weather: WeatherData | null;
  rainFalls: number | null;
  snowDepth: number | null;
  forecast: ForecastData | null;
  savedAt: number; // timestamp in milliseconds
}

const DB_NAME = 'sun_over_the_cloud_pwa_db';
const DB_VERSION = 1;
const WEATHER_STORE = 'weather_cache';
const FAVORITES_STORE = 'favorites_cache';

export const LAST_LOCATION_WEATHER_KEY = 'last_selected_weather';

/**
 * Open IndexedDB database connection safely with schema initialization.
 */
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(WEATHER_STORE)) {
          db.createObjectStore(WEATHER_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.debug('IndexedDB open error:', err);
        resolve(null);
      };

      request.onblocked = () => {
        console.debug('IndexedDB open blocked');
        resolve(null);
      };
    } catch (e) {
      console.debug('IndexedDB unsupported or failed to open:', e);
      resolve(null);
    }
  });
}

/**
 * Helper to generate a normalized key from coordinates.
 */
export function getCoordKey(lat: number, lon: number): string {
  return `coord_${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

/**
 * Filters forecast items so only forecast entries from the current hour onwards are kept.
 * Expired past hours from previous days or earlier hours today are discarded.
 */
export function filterForecastFromNow(forecast: ForecastData | null): ForecastData | null {
  if (!forecast || !Array.isArray(forecast.list) || forecast.list.length === 0) {
    return null;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  // Keep forecast entries from 1 hour in the past onwards (covers the ongoing hour)
  const minDt = nowSec - 3600;
  const filteredList = forecast.list.filter((item) => item.dt >= minDt);

  if (filteredList.length === 0) {
    return null;
  }

  return {
    ...forecast,
    list: filteredList,
  };
}

/**
 * Evaluates cached weather and forecast data against the current time.
 * If data was saved yesterday or hours ago, expired forecast hours are filtered out.
 * If cached current weather is older than 2 hours, attempts to reconstruct current
 * conditions from the forecast prediction for the current hour.
 * If data is too old (no future forecasts left), stale weather is rejected.
 */
export function getAdjustedWeatherForNow(cached: LocalCachedWeather | null): {
  weather: WeatherData | null;
  forecast: ForecastData | null;
  rainFalls: number | null;
  snowDepth: number | null;
  isStale: boolean;
} {
  if (!cached) {
    return {
      weather: null,
      forecast: null,
      rainFalls: null,
      snowDepth: null,
      isStale: true,
    };
  }

  const filteredForecast = filterForecastFromNow(cached.forecast);
  const now = Date.now();
  const ageMs = now - (cached.savedAt || 0);
  // Stale threshold: 2 hours
  const isStale = ageMs > 2 * 3600 * 1000;

  // 1. Fresh cache: Return directly
  if (!isStale && cached.weather) {
    return {
      weather: cached.weather,
      forecast: filteredForecast,
      rainFalls: cached.rainFalls,
      snowDepth: cached.snowDepth,
      isStale: false,
    };
  }

  // 2. Cache is older than 2 hours (e.g. from yesterday or earlier today):
  let adjustedWeather: WeatherData | null = cached.weather ? { ...cached.weather } : null;

  if (filteredForecast && filteredForecast.list.length > 0) {
    const nowSec = Math.floor(now / 1000);
    // Find the forecast slot closest to the current time
    let closestItem = filteredForecast.list[0];
    let minDiff = Math.abs(closestItem.dt - nowSec);

    for (const item of filteredForecast.list) {
      const diff = Math.abs(item.dt - nowSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestItem = item;
      }
    }

    // If the closest forecast prediction is within 3 hours of current time,
    // update current weather temp and condition to reflect the prediction for now
    if (minDiff <= 3 * 3600 && adjustedWeather) {
      adjustedWeather = {
        ...adjustedWeather,
        main: {
          ...adjustedWeather.main,
          temp: closestItem.main.temp,
          feels_like: closestItem.main.temp, // Fallback feels like to predicted temp
        },
        weather: closestItem.weather && closestItem.weather.length > 0
          ? [
              {
                description: closestItem.weather[0].description,
                icon: closestItem.weather[0].icon,
              },
            ]
          : adjustedWeather.weather,
      };
    }
  } else {
    // If no future forecast data remains (e.g. cache is older than multi-day forecast window),
    // do not show past week's weather.
    adjustedWeather = null;
  }

  return {
    weather: adjustedWeather,
    forecast: filteredForecast,
    rainFalls: isStale ? null : cached.rainFalls,
    snowDepth: isStale ? null : cached.snowDepth,
    isStale: true,
  };
}

/**
 * Save weather and forecast record to IndexedDB.
 */
export async function saveLocalWeather(
  key: string,
  payload: {
    location: { name: string; country?: string; lat: number; lon: number; location_name?: string };
    weather: WeatherData | null;
    rainFalls: number | null;
    snowDepth: number | null;
    forecast: ForecastData | null;
  }
): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(WEATHER_STORE, 'readwrite');
      const store = tx.objectStore(WEATHER_STORE);
      const getReq = store.get(key);

      getReq.onsuccess = () => {
        const existing = getReq.result as LocalCachedWeather | undefined;
        const record: LocalCachedWeather = {
          key,
          location: payload.location,
          weather: payload.weather !== null ? payload.weather : (existing?.weather || null),
          rainFalls: payload.rainFalls !== null ? payload.rainFalls : (existing?.rainFalls ?? null),
          snowDepth: payload.snowDepth !== null ? payload.snowDepth : (existing?.snowDepth ?? null),
          forecast: payload.forecast !== null ? payload.forecast : (existing?.forecast || null),
          savedAt: Date.now(),
        };
        store.put(record);
      };

      getReq.onerror = () => {
        const record: LocalCachedWeather = {
          key,
          ...payload,
          savedAt: Date.now(),
        };
        store.put(record);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve weather and forecast record from IndexedDB by key.
 */
export async function getLocalWeather(key: string): Promise<LocalCachedWeather | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(WEATHER_STORE, 'readonly');
      const store = tx.objectStore(WEATHER_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve((request.result as LocalCachedWeather) || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save user favorites list to IndexedDB.
 */
export async function saveLocalFavorites(favorites: FavoriteLocation[]): Promise<void> {
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FAVORITES_STORE, 'readwrite');
      const store = tx.objectStore(FAVORITES_STORE);
      store.put({
        key: 'user_favorites',
        favorites,
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve user favorites list from IndexedDB.
 */
export async function getLocalFavorites(): Promise<FavoriteLocation[] | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(FAVORITES_STORE, 'readonly');
      const store = tx.objectStore(FAVORITES_STORE);
      const request = store.get('user_favorites');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result && Array.isArray(result.favorites) ? result.favorites : null);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Append a single favorite to the IndexedDB cache without waiting for a server
 * round-trip. The dedicated /search page uses it right after a successful add
 * so the location is immediately visible on the home carousel and in the
 * account list, even if the background `/api/favorites` refresh is slow or
 * temporarily unavailable.
 */
export async function addLocalFavorite(favorite: FavoriteLocation): Promise<void> {
  const current = (await getLocalFavorites()) || [];
  const alreadyCached = current.some(
    (f) =>
      f._id === favorite._id ||
      (Math.abs(f.latitude - favorite.latitude) < 0.0001 &&
        Math.abs(f.longitude - favorite.longitude) < 0.0001),
  );
  if (alreadyCached) return;
  await saveLocalFavorites([...current, favorite]);
}

export async function deleteLocalWeather(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(WEATHER_STORE, 'readwrite');
      const store = tx.objectStore(WEATHER_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
