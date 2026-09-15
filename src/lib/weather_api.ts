import axios from 'axios';

const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

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
  console.log('Fetching data from:', url);
  const response = await api.get(url);
  return response.data;
}

export const getWeatherAndSnow = async (latitude: number, longitude: number) => {
  try {
    const url = `/api/onecall?lat=${latitude}&lon=${longitude}`;
    const response = await api.get(url);

    const currentData = response.data?.current;
    const dailyData = response.data?.daily;

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
      timezone: response.data?.timezone,
      timezone_offset: response.data?.timezone_offset
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

export const getForecast = async (latitude: string, longitude: string) => {
  const url = `/api/forecast?lat=${latitude}&lon=${longitude}`;
  const response = await api.get(url);
  return response.data;
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