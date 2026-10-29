import axios from 'axios';
import { debugLog } from './logger';

const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

// ---------------------------------------------------------------------------
// Request scheduling
// ---------------------------------------------------------------------------
//
// The mobile carousel and the hidden desktop favorite cards mount at the same
// time and request the same locations. On top of that, every mount asks for
// both current weather and the forecast, so a 5-location PWA used to fire ~20
// upstream requests within a second (MET Norway is rate-limited per client).
// Late requests then failed, which is why only the first slides received their
// `minutely_15` rain slots.
//
// Requests now go through one small scheduler:
//  - identical coordinates share a single in-flight request (deduplication),
//  - queued jobs are executed by priority (lower runs first), so the visible
//    carousel slide is refreshed before the off-screen ones,
//  - a small gap between upstream calls avoids sending a burst,
//  - resolved results are kept for a few seconds so a component mounting just
//    after the request completed reuses it instead of fetching again.

const REQUEST_GAP_MS = 120;
const RESULT_CACHE_TTL_MS = 15_000;

/** Lower numbers run first. The visible carousel slide uses 0. */
export const WEATHER_REQUEST_PRIORITY = {
  visible: 0,
  perSlide: 100,
  forecastOffset: 10,
  default: 100,
};

function weatherRequestKey(latitude: number, longitude: number) {
  return `onecall:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function forecastRequestKey(latitude: number, longitude: number) {
  return `forecast:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

/**
 * Raises the priority of a still-queued request for this location. Called when
 * the user swipes to another carousel slide, so that slide's refresh jumps
 * ahead of the pending off-screen ones even if its job was already enqueued.
 */
export function prioritizeWeatherRequest(latitude: number, longitude: number, priority: number) {
  const weatherJob = pendingJobs.get(weatherRequestKey(latitude, longitude));
  if (weatherJob && weatherJob.expiresAt === undefined && priority < weatherJob.priority) {
    weatherJob.priority = priority;
  }

  const forecastJob = pendingJobs.get(forecastRequestKey(latitude, longitude));
  const forecastPriority = priority + WEATHER_REQUEST_PRIORITY.forecastOffset;
  if (
    forecastJob &&
    forecastJob.expiresAt === undefined &&
    forecastPriority < forecastJob.priority
  ) {
    forecastJob.priority = forecastPriority;
  }
}

interface WeatherRequestOptions {
  /** Scheduler priority; lower numbers are executed first. */
  priority?: number;
}

interface ScheduledJob<T> {
  key: string;
  priority: number;
  order: number;
  run: () => Promise<T>;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  expiresAt?: number;
}

const pendingJobs = new Map<string, ScheduledJob<unknown>>();
const jobQueue: ScheduledJob<unknown>[] = [];
let jobSequence = 0;
let isPumping = false;
let lastJobStartedAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function scheduleRequest<T>(key: string, priority: number, run: () => Promise<T>): Promise<T> {
  const now = Date.now();

  // Drop resolved entries whose short reuse window has elapsed.
  for (const [cachedKey, cachedJob] of pendingJobs) {
    if (cachedJob.expiresAt !== undefined && cachedJob.expiresAt <= now) {
      pendingJobs.delete(cachedKey);
    }
  }

  const existing = pendingJobs.get(key);

  if (existing && (existing.expiresAt === undefined || existing.expiresAt > now)) {
    // Another component already asked for the same location: share its request
    // and let the most urgent caller raise the priority of a queued job.
    if (priority < existing.priority && existing.expiresAt === undefined) {
      existing.priority = priority;
    }
    return existing.promise as Promise<T>;
  }

  if (existing) {
    pendingJobs.delete(key);
  }

  let resolveJob!: (value: T) => void;
  let rejectJob!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveJob = resolve;
    rejectJob = reject;
  });

  const job: ScheduledJob<T> = {
    key,
    priority,
    order: jobSequence++,
    run,
    promise,
    resolve: resolveJob,
    reject: rejectJob,
  };

  pendingJobs.set(key, job as ScheduledJob<unknown>);
  jobQueue.push(job as ScheduledJob<unknown>);
  void pumpQueue();
  return promise;
}

async function pumpQueue() {
  if (isPumping) return;
  isPumping = true;

  try {
    while (jobQueue.length > 0) {
      // Lowest priority first, then insertion order (stable).
      jobQueue.sort((a, b) => a.priority - b.priority || a.order - b.order);
      const job = jobQueue.shift();
      if (!job) break;

      // Ignore jobs whose cache entry was replaced in the meantime.
      if (pendingJobs.get(job.key) !== job) continue;

      const wait = Math.max(0, lastJobStartedAt + REQUEST_GAP_MS - Date.now());
      if (wait > 0) await sleep(wait);
      lastJobStartedAt = Date.now();

      try {
        const value = await job.run();
        job.resolve(value);
        // Keep the resolved request briefly so late mounts reuse it.
        job.expiresAt = Date.now() + RESULT_CACHE_TTL_MS;
      } catch (error) {
        job.reject(error);
        pendingJobs.delete(job.key);
      }
    }
  } finally {
    isPumping = false;
    // A job may have been enqueued between the last loop check and this point.
    if (jobQueue.length > 0) void pumpQueue();
  }
}

// ---------------------------------------------------------------------------
// Distance helper
// ---------------------------------------------------------------------------

// Function to calculate distance between two lat/lon points (in kilometers)
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export async function search(city: string) {
  const url = '/api/search?city=' + encodeURIComponent(city);
  debugLog('Fetching data from:', url);
  const response = await api.get(url);
  return response.data;
}

export const getWeatherAndSnow = async (
  latitude: number,
  longitude: number,
  options: WeatherRequestOptions = {}
) => {
  try {
    const key = weatherRequestKey(latitude, longitude);
    const data = await scheduleRequest(
      key,
      options.priority ?? WEATHER_REQUEST_PRIORITY.default,
      async () => {
        const url = `/api/onecall?lat=${latitude}&lon=${longitude}`;
        const response = await api.get(url);
        return response.data;
      }
    );

    const currentData = data?.current;
    const dailyData = data?.daily;

    if (!currentData || !dailyData || dailyData.length === 0) {
      console.warn('No current or daily forecast data available.');
      return { weather: null, snowDepth: null };
    }

    const weatherData = {
      name: '',
      main: {
        temp: currentData.temp,
        feels_like: currentData.feels_like,
        humidity: currentData.humidity,
        pressure: currentData.pressure,
      },
      weather: [{
        description: currentData.weather[0].description,
        icon: currentData.weather[0].icon,
      }],
      wind: { speed: currentData.wind_speed, deg: currentData.wind_deg },
      clouds: { all: currentData.clouds },
      visibility: currentData.visibility,
      coord: { lat: latitude, lon: longitude },
      sys: { sunrise: currentData.sunrise, sunset: currentData.sunset },
      timezone: data?.timezone,
      timezone_offset: data?.timezone_offset,
      minutely_15: Array.isArray(data?.minutely_15) ? data.minutely_15 : [],
    };

    const rainFalls = dailyData[0].rain ?? null;
    const snowDepthMm = dailyData[0].snow ?? null;
    const snowDepth = snowDepthMm !== null ? snowDepthMm / 10 : null;

    return { weather: weatherData, rainFalls, snowDepth };
  } catch (error) {
    console.error('Error fetching weather and snow data:', error);
    return { weather: null, snowDepth: null };
  }
};

export const getForecast = async (
  latitude: string,
  longitude: string,
  options: WeatherRequestOptions = {}
) => {
  const key = forecastRequestKey(Number(latitude), Number(longitude));
  return scheduleRequest(
    key,
    options.priority ?? WEATHER_REQUEST_PRIORITY.default + WEATHER_REQUEST_PRIORITY.forecastOffset,
    async () => {
      const url = `/api/forecast?lat=${latitude}&lon=${longitude}`;
      const response = await api.get(url);
      return response.data;
    }
  );
};

export const getOneCallMonthSummary = async (latitude: string, longitude: string, year: number, month: number) => {
  const url = `/api/onecallmonthsummary?lat=${latitude}&lon=${longitude}&year=${year}&month=${month}`;
  const response = await api.get(url);
  return response.data;
};

export const fetchCachedFavorites = async () => {
  try {
    const response = await api.get('/api/cached-favorites');
    return response.data;
  } catch (error) {
    console.error('Error fetching cached favorites:', error);
    return [];
  }
};
