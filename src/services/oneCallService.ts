// src/services/oneCallService.ts
import { WeatherOnCallDaySummaryModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

// Bound the outbound HTTP calls so a slow Open-Meteo endpoint can never make a
// Worker handler hang (the former axios calls relied on the Node.js http stack
// and hung until the runtime cancelled the request).
const OPEN_METEO_TIMEOUT_MS = 10_000;

/**
 * Native-fetch replacement for the former axios.get calls. Axios relies on the
 * Node.js http stack and can hang on Cloudflare Workers ("Worker's code had
 * hung"), so all outbound HTTP must use fetch with AbortSignal.timeout. Throws
 * on non-2xx so the primary/fallback logic behaves exactly as before.
 */
async function fetchOpenMeteo(url: string, params: Record<string, string | number>): Promise<Response> {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
  const response = await fetch(`${url}?${query.toString()}`, {
    signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo responded with status ${response.status}`);
  }
  return response;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Fetch and save single day summary data (used by cron scheduler) powered by Open-Meteo.
 */
export async function fetchAndSaveDaySummary(lat: number, lon: number, date: string) {
  try {
    await connectToDatabase();
    const existingData = await WeatherOnCallDaySummaryModel.findOne({
      latitude: lat,
      longitude: lon,
      date,
    });

    if (existingData) {
      return { success: true, data: existingData.data };
    }

    const primaryUrl = 'https://api.open-meteo.com/v1/forecast';
    const fallbackUrl = 'https://archive-api.open-meteo.com/v1/archive';
    const params = {
      latitude: lat,
      longitude: lon,
      start_date: date,
      end_date: date,
      daily: 'precipitation_sum,relative_humidity_2m_mean,cloud_cover_mean',
      timezone: 'auto',
    };

    let response: Response;
    try {
      response = await fetchOpenMeteo(primaryUrl, params);
    } catch {
      response = await fetchOpenMeteo(fallbackUrl, params);
    }

    const payload = await response.json();
    const daily = payload?.daily;
    const data = {
      date,
      precipitation: {
        total: daily?.precipitation_sum ? (daily.precipitation_sum[0] ?? 0) : 0,
      },
      humidity: {
        afternoon: daily?.relative_humidity_2m_mean ? Math.round(daily.relative_humidity_2m_mean[0] ?? 0) : 0,
      },
      cloud_cover: {
        afternoon: daily?.cloud_cover_mean ? Math.round(daily.cloud_cover_mean[0] ?? 0) : 0,
      },
    };

    const newDoc = new WeatherOnCallDaySummaryModel({
      latitude: lat,
      longitude: lon,
      date,
      data,
    });
    await newDoc.save();

    return { success: true, data };
  } catch (error: unknown) {
    console.error('Error fetching day summary from Open-Meteo:', errorMessage(error));
    return { success: false, error: errorMessage(error) };
  }
}

/**
 * Fetch month summary from Open-Meteo Archive / Forecast API in a single HTTP call.
 */
export async function fetchMonthSummary(lat: number, lon: number, year: number, month: number) {
  try {
    const today = new Date();
    const isCurrentMonth = (year === today.getFullYear() && month === (today.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

    let endDate: string;
    if (isCurrentMonth) {
      endDate = today.toISOString().split('T')[0];
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    const now = new Date();
    const targetDate = new Date(year, month - 1, 1);
    const monthsDifference = (now.getFullYear() - targetDate.getFullYear()) * 12 + (now.getMonth() - targetDate.getMonth());
    const useForecast = monthsDifference <= 1;

    const primaryUrl = useForecast
      ? 'https://api.open-meteo.com/v1/forecast'
      : 'https://archive-api.open-meteo.com/v1/archive';
    const fallbackUrl = useForecast
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const params = {
      latitude: lat,
      longitude: lon,
      start_date: startDate,
      end_date: endDate,
      daily: 'precipitation_sum,relative_humidity_2m_mean,cloud_cover_mean',
      timezone: 'auto',
    };

    let response: Response;
    try {
      response = await fetchOpenMeteo(primaryUrl, params);
    } catch (primaryErr: unknown) {
      console.warn(`Primary Open-Meteo endpoint (${primaryUrl}) failed, falling back to ${fallbackUrl}:`, errorMessage(primaryErr));
      response = await fetchOpenMeteo(fallbackUrl, params);
    }

    const payload = await response.json();
    const daily = payload?.daily;
    if (!daily || !daily.time) {
      return { success: false, error: 'No daily data available from Open-Meteo' };
    }

    const dailySummaries = daily.time.map((dateStr: string, idx: number) => ({
      date: dateStr,
      precipitation: {
        total: daily.precipitation_sum ? (daily.precipitation_sum[idx] ?? 0) : 0,
      },
      humidity: {
        afternoon: daily.relative_humidity_2m_mean ? Math.round(daily.relative_humidity_2m_mean[idx] ?? 0) : 0,
      },
      cloud_cover: {
        afternoon: daily.cloud_cover_mean ? Math.round(daily.cloud_cover_mean[idx] ?? 0) : 0,
      },
    }));

    return { success: true, data: dailySummaries };
  } catch (error: unknown) {
    console.error('Error in fetchMonthSummary:', errorMessage(error));
    return { success: false, error: errorMessage(error) };
  }
}