// src/app/components/FavoriteCardComponent.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FavoriteLocation, WeatherData, ForecastData, PrecipitationData } from '@/lib/types';
import { getWeatherAndSnow, getForecast } from '@/lib/weather_api';
import { weatherIconMap, weatherIconColorMap } from '@/lib/weatherIconMap';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from './ThemeProvider';
import WeatherDisplay from './WeatherDisplay';
import ForecastDisplay from './ForecastDisplay';
import GraphsDisplay from './GraphsDisplay';
import { Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface FavoriteCardComponentProps {
  favorite: FavoriteLocation;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: (id: string) => void;
}

export default function FavoriteCardComponent({
  favorite,
  isExpanded,
  onToggleExpand,
  onRemove,
}: FavoriteCardComponentProps) {
  const { darkMode } = useTheme();
  const { t, tWeather } = useLanguage();

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

  // 1. Fetch current weather on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCurrentWeather = async () => {
      try {
        setIsLoadingWeather(true);
        const { weather, rainFalls, snowDepth } = await getWeatherAndSnow(
          favorite.latitude,
          favorite.longitude
        );
        if (isMounted && weather) {
          const wData = weather as WeatherData;
          wData.name = favorite.location_name;
          wData.country = favorite.country_code;
          setWeatherData(wData);
          setRainFallsData(rainFalls);
          setSnowDepthData(snowDepth);
        }
      } catch (err) {
        console.error('Error fetching favorite current weather:', err);
      } finally {
        if (isMounted) {
          setIsLoadingWeather(false);
        }
      }
    };

    fetchCurrentWeather();
    return () => {
      isMounted = false;
    };
  }, [favorite.latitude, favorite.longitude, favorite.location_name, favorite.country_code]);

  // 2. Fetch forecast data when card is expanded (lazy load)
  const fetchForecast = useCallback(async () => {
    if (hasFetchedForecastRef.current || isLoadingForecast) return;
    try {
      setIsLoadingForecast(true);
      setForecastError(null);
      const data = await getForecast(
        favorite.latitude.toString(),
        favorite.longitude.toString()
      );
      setForecastData(data);
      hasFetchedForecastRef.current = true;
    } catch (err) {
      console.error('Error fetching favorite forecast:', err);
      setForecastError(t('failed_to_fetch_forecast'));
    } finally {
      setIsLoadingForecast(false);
    }
  }, [favorite.latitude, favorite.longitude, isLoadingForecast, t]);

  useEffect(() => {
    if (isExpanded && !forecastData && !hasFetchedForecastRef.current) {
      fetchForecast();
    }
  }, [isExpanded, forecastData, fetchForecast]);

  const iconCode = weatherData?.weather[0]?.icon || '01d';

  return (
    <div
      className={`border rounded-xl mb-3 transition-all duration-200 shadow-xs ${
        darkMode
          ? 'bg-gray-800/90 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-blue-200'
      }`}
    >
      {/* Clickable Card Header */}
      <div
        onClick={onToggleExpand}
        className="p-3.5 sm:p-4 cursor-pointer flex items-center justify-between gap-3 select-none"
        role="button"
        aria-expanded={isExpanded}
      >
        {/* Left: Location Name & Flag */}
        <div className="flex items-center gap-2 min-w-0">
          {favorite.country_code && (
            <span className={`fi fi-${favorite.country_code.toLowerCase()} rounded shrink-0`}></span>
          )}
          <span className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
            {favorite.location_name}
          </span>
        </div>

        {/* Right: Weather Summary & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {isLoadingWeather ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          ) : weatherData ? (
            <div className="flex items-center gap-2">
              <i
                className={`wi ${weatherIconMap[iconCode] || 'wi-day-sunny'} text-2xl ${
                  weatherIconColorMap[iconCode] || 'text-amber-500'
                }`}
              />
              <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                {weatherData.main.temp.toFixed(1)}°C
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize hidden sm:inline max-w-[130px] truncate">
                {tWeather(weatherData.weather[0]?.description || '')}
              </span>
            </div>
          ) : null}

          {/* Remove Favorite Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(favorite._id);
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={t('remove_button')}
            aria-label={t('remove_button')}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Expand/Collapse Chevron */}
          <div className="text-gray-400 dark:text-gray-500">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Forecast Details */}
      {isExpanded && (
        <div className="border-t border-gray-200/80 dark:border-gray-700/80 p-3 sm:p-5 pt-4 bg-gray-50/50 dark:bg-gray-900/40 rounded-b-xl">
          {/* Detailed Current Weather Conditions */}
          {weatherData && (
            <WeatherDisplay
              weatherData={weatherData}
              rainFallsData={rainFallsData}
              snowDepthData={snowDepthData}
            />
          )}

          {/* Forecast Section */}
          {isLoadingForecast ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
              <span>{t('loading_forecast')}</span>
            </div>
          ) : (
            <>
              {forecastError && (
                <div className="text-red-500 text-sm mb-4 text-center">{forecastError}</div>
              )}
              {forecastData && (
                <ForecastDisplay
                  weatherData={weatherData}
                  forecastData={forecastData}
                  setForecastData={setForecastData}
                  setError={setForecastError}
                />
              )}
            </>
          )}

          {/* Graphs Section (keeps button to view monthly graphs) */}
          {weatherData && (
            <>
              {graphsError && (
                <div className="text-red-500 text-sm mb-4 text-center">{graphsError}</div>
              )}
              <GraphsDisplay
                weatherData={weatherData}
                precipitationData={precipitationData}
                setPrecipitationData={setPrecipitationData}
                isLoadingPrecipitation={isLoadingPrecipitation}
                setIsLoadingPrecipitation={setIsLoadingPrecipitation}
                showGraphs={showGraphs}
                setShowGraphs={setShowGraphs}
                setError={setGraphsError}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
