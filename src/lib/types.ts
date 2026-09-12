// src/lib/types.ts

export interface CachedFavoriteLocation {
  location_name: string;
  lat: number;
  lon: number;
  country: string;
}

export interface FavoriteLocation {
  _id: string;
  location_name: string;
  longitude: number;
  latitude: number;
  country_code: string;
  user_id?: string;
  __v?: number;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
  local_names?: { [key: string]: string };
  location_name?: string;
}

export interface WeatherData {
  name: string;
  country?: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  weather: { description: string }[];
  wind: { speed: number; deg: number };
  clouds: { all: number };
  visibility: number;
  coord: { lat: number; lon: number };
  timezone: string;
  timezone_offset: number;
  sys: { sunrise: number; sunset: number };
}

export interface PrecipitationData {
  date: string;
  precipitation: number;
  humidity: number;
  cloudCover: number;
}

export interface ForecastData {
  list: {
    dt: number;
    main: { temp: number };
    weather: {
      id: number;
      main: string;
      description: string;
      icon: string;
    }[];
  }[];
}

export interface DailySummaryApiResponse {
  date: string;
  precipitation?: {
    total: number;
  };
  humidity?: {
    afternoon: number;
  };
  cloud_cover?: {
    afternoon: number;
  };
}
