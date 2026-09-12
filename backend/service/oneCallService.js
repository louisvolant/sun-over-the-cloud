const axios = require('axios');
const API_KEY = process.env.OPENWEATHER_API_KEY;
const ONECALL_V3_API = "https://api.openweathermap.org/data/3.0/onecall";
const ONECALL_V3_TIMEMACHINE_API = "https://api.openweathermap.org/data/3.0/onecall/timemachine";
const ONECALL_V3_DAY_SUMMARY_API = "https://api.openweathermap.org/data/3.0/onecall/day_summary";
const { getWeatherOnCall, saveWeatherOnCall, getWeatherOnCallDaySummary, saveWeatherOnCallDaySummary } = require('../dao/onecallDao');

// Fetch and save current weather data (for /onecall)
async function fetchAndSaveCurrentWeather(lat, lon, units = 'metric', lang = 'en') {
  try {
    // Check if data already exists in MongoDB
    const existingData = await getWeatherOnCall(lat, lon, units, lang);
    if (existingData) {
      return { success: true, data: existingData.data };
    }

    // Fetch data from OpenWeatherMap if not in MongoDB
    const response = await axios.get(ONECALL_V3_API, {
      params: { lat, lon, appid: API_KEY, units, lang },
    });

    const data = response.data;

    // Save the new data to MongoDB
    await saveWeatherOnCall(lat, lon, units, lang, data);

    return { success: true, data };
  } catch (error) {
    const errorMsg = error.response
      ? `API Error: ${error.response.status} - ${error.response.data.message || "Failed to fetch weather data"}`
      : `Error: ${error.message}`;
    return { success: false, error: errorMsg };
  }
}

// Fetch historical weather data (for /onecalltimemachine)
async function fetchHistoricalWeather(lat, lon, date, units = 'metric', lang = 'en') {
  const timestamp = new Date(date).getTime() / 1000; // Convert to Unix timestamp in seconds

  try {
    const response = await axios.get(ONECALL_V3_TIMEMACHINE_API, {
      params: { lat, lon, dt: timestamp, appid: API_KEY, units, lang },
    });

    const data = response.data;
    return { success: true, data };
  } catch (error) {
    const errorMsg = error.response
      ? `API Error: ${error.response.status} - ${error.response.data.message || "Failed to fetch historical weather data"}`
      : `Error: ${error.message}`;
    return { success: false, error: errorMsg };
  }
}

// Fetch and save day summary data (for /onecalldaysummary)
async function fetchAndSaveDaySummary(lat, lon, date) {
  const formattedDate = date;

  try {
    // Check if data already exists in MongoDB
    const existingData = await getWeatherOnCallDaySummary(lat, lon, formattedDate);
    if (existingData) {
      return { success: true, data: existingData.data };
    }

    // Fetch data from OpenWeatherMap if not in MongoDB
    const response = await axios.get(ONECALL_V3_DAY_SUMMARY_API, {
      params: {
        lat,
        lon,
        date,
        appid: API_KEY,
        units: 'metric', // Hardcoded as per your example
        lang: 'en',      // Hardcoded as per your example
      },
    });

    const data = response.data;

    // Save the new data to MongoDB
    await saveWeatherOnCallDaySummary(lat, lon, formattedDate, data);

    return { success: true, data };
  } catch (error) {
    const errorMsg = error.response
      ? `API Error: ${error.response.status} - ${error.response.data.message || "Failed to fetch daily weather data"}`
      : `Error: ${error.message}`;
    return { success: false, error: errorMsg };
  }
}

// Fetch month summary from Open-Meteo Archive / Forecast API in a single HTTP call
async function fetchMonthSummary(lat, lon, year, month) {
  try {
    const today = new Date();
    const isCurrentMonth = (year === today.getFullYear() && month === (today.getMonth() + 1));
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

    let endDate;
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
    } catch (primaryErr) {
      console.warn(`Primary Open-Meteo endpoint (${primaryUrl}) failed, falling back to ${fallbackUrl}:`, primaryErr.message);
      response = await axios.get(fallbackUrl, { params });
    }

    const daily = response.data?.daily;
    if (!daily || !daily.time) {
      return { success: false, error: 'No daily data available from Open-Meteo' };
    }

    const dailySummaries = daily.time.map((dateStr, idx) => ({
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
  } catch (error) {
    console.error('Error in fetchMonthSummary:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  fetchAndSaveCurrentWeather,
  fetchHistoricalWeather,
  fetchAndSaveDaySummary,
  fetchMonthSummary,
};