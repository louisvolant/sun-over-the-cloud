// src/hooks/useLocationWeather.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WeatherData, ForecastData, PrecipitationData } from '@/lib/types';
import { getWeatherAndSnow, getForecast } from '@/lib/weather_api';
import {
  getLocalWeather,
  saveLocalWeather,
  getCoordKey,
  getAdjustedWeatherForNow,
} from '@/lib/localWeatherDb';
import { useLanguage } from '@/context/LanguageContext';

interface UseLocationWeatherOptions {
  latitude: number;
  longitude: number;
  locationName: string;
  countryCode?: string;
}

/**
 * Dev comment:
 * Shared data hook for a single geographic location. It owns the full
 * weather/forecast data lifecycle for one place:
 *
 *  1. On mount (or when coordinates change), read the last cached snapshot
 *     from IndexedDB for an instantaneous render (PWA stale-while-revalidate).
 *  2. In parallel, fetch live weather + forecast and update both the UI and
 *     the IndexedDB cache.
 *  3. Expose a lazy `fetchForecast` fallback used when a view (e.g. an
 *     expanded favorite card) needs the forecast but it is not loaded yet.
 *
 * This logic used to live inside FavoriteCardComponent. It was extracted so
 * the mobile swipeable location carousel can render the exact same expanded
 * weather view per location without duplicating fetch/cache code.
 */
export default function useLocationWeather({
  latitude,
  longitude,
  locationName,
  countryCode = '',
}: UseLocationWeatherOptions) {
  const { t } = useLanguage();

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [rainFallsData, setRainFallsData] = useState<number | null>(null);
  const [snowDepthData, setSnowDepthData] = useState<number | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [precipitationData, setPrecipitationData] = useState<PrecipitationData[]>([]);
  const [isLoadingPrecipitation, setIsLoadingPrecipitation] = useState(false);
  const [showGraphs, setShowGraphs] = useState(false);
  const [graphsError, setGraphsError] = useState<string | null>(null);

  const hasFetchedForecastRef = useRef(false);
  const forecastDataRef = useRef<ForecastData | null>(null);
  const coordKey = getCoordKey(latitude, longitude);

  // 1. Check local IndexedDB immediately on mount for instantaneous rendering
  useEffect(() => {
    let isMounted = true;

    getLocalWeather(coordKey)
      .then((cached) => {
        if (!isMounted || !cached) return;
        const adjusted = getAdjustedWeatherForNow(cached);
        if (adjusted.weather) {
          setWeatherData(adjusted.weather);
          setRainFallsData(adjusted.rainFalls);
          setSnowDepthData(adjusted.snowDepth);
          setIsLoadingWeather(false);
        }
        if (adjusted.forecast) {
          setForecastData(adjusted.forecast);
          forecastDataRef.current = adjusted.forecast;
        }
      })
      .catch((err) => {
        console.debug('Error reading favorite from local DB:', err);
      });

    // Background fetch for fresh live weather AND forecast in parallel
    const fetchLiveWeatherAndForecast = async () => {
      try {
        const [weatherRes, forecastRes] = await Promise.allSettled([
          getWeatherAndSnow(latitude, longitude),
          getForecast(latitude.toString(), longitude.toString()),
        ]);

        if (!isMounted) return;

        let wData: WeatherData | null = null;
        let rFalls: number | null = null;
        let sDepth: number | null = null;
        let fData: ForecastData | null = null;

        if (weatherRes.status === 'fulfilled' && weatherRes.value?.weather) {
          wData = weatherRes.value.weather as WeatherData;
          wData.name = locationName;
          wData.country = countryCode;
          rFalls = weatherRes.value.rainFalls;
          sDepth = weatherRes.value.snowDepth;
          setWeatherData(wData);
          setRainFallsData(rFalls);
          setSnowDepthData(sDepth);
          setIsLoadingWeather(false);
        }

        if (forecastRes.status === 'fulfilled' && forecastRes.value) {
          fData = forecastRes.value;
          setForecastData(fData);
          forecastDataRef.current = fData;
          hasFetchedForecastRef.current = true;
        }

        // Update IndexedDB with both live weather and forecast
        saveLocalWeather(coordKey, {
          location: {
            name: locationName,
            country: countryCode,
            lat: latitude,
            lon: longitude,
          },
          weather: wData,
          rainFalls: rFalls,
          snowDepth: sDepth,
          forecast: fData || forecastDataRef.current,
        }).catch((saveErr) => console.debug('Failed saving favorite to local DB:', saveErr));
      } catch (err) {
        console.error('Error fetching favorite data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingWeather(false);
        }
      }
    };

    fetchLiveWeatherAndForecast();
    return () => {
      isMounted = false;
    };
  }, [coordKey, latitude, longitude, locationName, countryCode]);

  // 2. Fallback fetch of forecast data when a view needs it and it is not available yet
  const fetchForecast = useCallback(async () => {
    if (forecastDataRef.current || hasFetchedForecastRef.current || isLoadingForecast) return;
    try {
      if (!forecastData) {
        setIsLoadingForecast(true);
      }
      setForecastError(null);
      const data = await getForecast(latitude.toString(), longitude.toString());
      setForecastData(data);
      forecastDataRef.current = data;
      hasFetchedForecastRef.current = true;

      // Update local IndexedDB with fresh forecast
      if (weatherData) {
        saveLocalWeather(coordKey, {
          location: {
            name: locationName,
            country: countryCode,
            lat: latitude,
            lon: longitude,
          },
          weather: weatherData,
          rainFalls: rainFallsData,
          snowDepth: snowDepthData,
          forecast: data,
        }).catch((err) => console.debug('Failed updating forecast in local DB:', err));
      }
    } catch (err) {
      console.error('Error fetching favorite forecast:', err);
      if (!forecastData) {
        setForecastError(t('failed_to_fetch_forecast'));
      }
    } finally {
      setIsLoadingForecast(false);
    }
  }, [latitude, longitude, isLoadingForecast, forecastData, weatherData, coordKey, rainFallsData, snowDepthData, locationName, countryCode, t]);

  /**
   * Trigger the lazy forecast fetch only when no forecast is available yet.
   * Used by views that load the forecast on demand (e.g. expanded cards).
   */
  const maybeFetchForecast = useCallback(() => {
    if (!forecastData && !hasFetchedForecastRef.current) {
      fetchForecast();
    }
  }, [fetchForecast, forecastData]);

  return {
    weatherData,
    rainFallsData,
    snowDepthData,
    isLoadingWeather,
    forecastData,
    setForecastData,
    isLoadingForecast,
    forecastError,
    setForecastError,
    precipitationData,
    setPrecipitationData,
    isLoadingPrecipitation,
    setIsLoadingPrecipitation,
    showGraphs,
    setShowGraphs,
    graphsError,
    setGraphsError,
    fetchForecast,
    maybeFetchForecast,
  };
}

export type LocationWeatherState = ReturnType<typeof useLocationWeather>;
