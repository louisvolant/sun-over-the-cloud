// service/metNorwayService.js
const axios = require('axios');
const SunCalc = require('suncalc');
const tzLookup = require('tz-lookup');

const MET_API_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const DEFAULT_USER_AGENT = 'SunOverTheCloud/1.0 (https://github.com/louisvolant/sun-over-the-cloud; contact@sunoverthecloud.com)';

// In-memory cache holding MET Norway raw forecast data
// Key: "lat,lon" -> { data, expiresAt, lastModified }
const metCache = new Map();

/**
 * Calculate Steadman apparent temperature (feels like) based on air temperature, humidity, and wind speed.
 */
function calculateFeelsLike(temp, humidity, windSpeed) {
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
function getTimezoneOffsetSeconds(timeZone) {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
    return (tzDate.getTime() - utcDate.getTime()) / 1000;
  } catch (err) {
    return 0;
  }
}

/**
 * Map MET Norway weather symbol_code to OpenWeather-compatible condition info.
 */
function mapMetSymbolToWeather(symbolCode) {
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
async function fetchLocationForecast(latitude, longitude) {
  // MET Norway recommends rounding coordinates to max 4 decimal digits to maximize cache hits
  const lat = Number(parseFloat(latitude).toFixed(4));
  const lon = Number(parseFloat(longitude).toFixed(4));
  const cacheKey = `${lat},${lon}`;

  const cached = metCache.get(cacheKey);
  const now = Date.now();

  // If cached and still before the Expires time, return memory cache immediately
  if (cached && cached.expiresAt && now < cached.expiresAt) {
    return cached.data;
  }

  const userAgent = process.env.MET_NO_USER_AGENT || DEFAULT_USER_AGENT;
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'application/json',
  };

  if (cached && cached.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  try {
    const response = await axios.get(MET_API_URL, {
      params: { lat, lon },
      headers,
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    });

    const expiresHeader = response.headers['expires'];
    const newExpiresAt = expiresHeader ? new Date(expiresHeader).getTime() : now + 30 * 60 * 1000;

    if (response.status === 304 && cached) {
      cached.expiresAt = newExpiresAt;
      return cached.data;
    }

    const lastModifiedHeader = response.headers['last-modified'];
    const forecastData = response.data;

    metCache.set(cacheKey, {
      data: forecastData,
      expiresAt: newExpiresAt,
      lastModified: lastModifiedHeader,
    });

    return forecastData;
  } catch (error) {
    // If upstream MET fails but we have stale cached data, return it as fallback
    if (cached && cached.data) {
      console.warn(`MET Norway request failed (${error.message}), returning stale cache for ${cacheKey}`);
      return cached.data;
    }
    throw error;
  }
}

/**
 * Get current weather and next-24h rain/snow summary compatible with /api/onecall.
 */
async function getCurrentWeather(latitude, longitude) {
  const lat = Number(parseFloat(latitude).toFixed(4));
  const lon = Number(parseFloat(longitude).toFixed(4));

  const forecast = await fetchLocationForecast(lat, lon);
  const timeseries = forecast?.properties?.timeseries;

  if (!timeseries || timeseries.length === 0) {
    throw new Error('No weather timeseries data received from MET Norway');
  }

  const currentPoint = timeseries[0];
  const instant = currentPoint.data?.instant?.details || {};

  // Find symbol code from the shortest available summary window
  const symbolCode =
    currentPoint.data?.next_1_hours?.summary?.symbol_code ||
    currentPoint.data?.next_6_hours?.summary?.symbol_code ||
    currentPoint.data?.next_12_hours?.summary?.symbol_code;

  const weatherInfo = mapMetSymbolToWeather(symbolCode);

  // Calculate feels_like
  const temp = instant.air_temperature ?? 0;
  const humidity = instant.relative_humidity ?? 0;
  const windSpeed = instant.wind_speed ?? 0;
  const feelsLike = calculateFeelsLike(temp, humidity, windSpeed);

  // Determine timezone and offset
  let timezone = 'UTC';
  try {
    timezone = tzLookup(lat, lon);
  } catch (err) {
    console.warn(`Timezone lookup failed for lat=${lat}, lon=${lon}:`, err.message);
  }
  const timezoneOffset = getTimezoneOffsetSeconds(timezone);

  // Calculate sunrise and sunset using SunCalc
  const sunTimes = SunCalc.getTimes(new Date(), lat, lon);
  const sunrise = Math.floor(sunTimes.sunrise.getTime() / 1000);
  const sunset = Math.floor(sunTimes.sunset.getTime() / 1000);

  // Sum next 24h precipitation to provide rain/snow estimates
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

  const response = {
    current: {
      temp,
      feels_like: feelsLike,
      humidity,
      pressure: instant.air_pressure_at_sea_level ?? 1013,
      weather: [
        {
          id: weatherInfo.id,
          main: weatherInfo.main,
          description: weatherInfo.description,
          icon: weatherInfo.icon,
        },
      ],
      wind_speed: windSpeed,
      wind_deg: instant.wind_from_direction ?? 0,
      clouds: Math.round(instant.cloud_area_fraction ?? 0),
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
    timezone,
    timezone_offset: timezoneOffset,
  };

  return response;
}

/**
 * Get multi-day forecast compatible with /api/forecast list format.
 */
async function getForecast(latitude, longitude) {
  const lat = Number(parseFloat(latitude).toFixed(4));
  const lon = Number(parseFloat(longitude).toFixed(4));

  const forecast = await fetchLocationForecast(lat, lon);
  const timeseries = forecast?.properties?.timeseries;

  if (!timeseries || timeseries.length === 0) {
    throw new Error('No forecast data received from MET Norway');
  }

  const list = timeseries.map((item) => {
    const dt = Math.floor(new Date(item.time).getTime() / 1000);
    const instant = item.data?.instant?.details || {};
    const symbolCode =
      item.data?.next_1_hours?.summary?.symbol_code ||
      item.data?.next_6_hours?.summary?.symbol_code ||
      item.data?.next_12_hours?.summary?.symbol_code;

    const weatherInfo = mapMetSymbolToWeather(symbolCode);

    return {
      dt,
      main: {
        temp: instant.air_temperature ?? 0,
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

module.exports = {
  fetchLocationForecast,
  getCurrentWeather,
  getForecast,
  calculateFeelsLike,
  mapMetSymbolToWeather,
};
