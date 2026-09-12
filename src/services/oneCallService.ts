// src/services/oneCallService.ts
import axios from 'axios';
import { WeatherOnCallDaySummaryModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';

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

    let response;
    try {
      response = await axios.get(primaryUrl, { params });
    } catch (err) {
      response = await axios.get(fallbackUrl, { params });
    }

    const daily = response.data?.daily;
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
  } catch (error: any) {
    console.error('Error fetching day summary from Open-Meteo:', error.message);
    return { success: false, error: error.message };
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

    let response;
    try {
      response = await axios.get(primaryUrl, { params });
    } catch (primaryErr: any) {
      console.warn(`Primary Open-Meteo endpoint (${primaryUrl}) failed, falling back to ${fallbackUrl}:`, primaryErr.message);
      response = await axios.get(fallbackUrl, { params });
    }

    const daily = response.data?.daily;
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
  } catch (error: any) {
    console.error('Error in fetchMonthSummary:', error.message);
    return { success: false, error: error.message };
  }
}
