// src/app/components/FavoriteCardComponent.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FavoriteLocation, WeatherData, ForecastData, PrecipitationData } from '@/lib/types';
import { getWeatherAndSnow, getForecast } from '@/lib/weather_api';
import {
  getLocalWeather,
  saveLocalWeather,
  getCoordKey,
  getAdjustedWeatherForNow,
} from '@/lib/localWeatherDb';
import { weatherIconMap, weatherIconColorMap } from '@/lib/weatherIconMap';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from './ThemeProvider';
import WeatherDisplay from './WeatherDisplay';
import ForecastDisplay from './ForecastDisplay';
import GraphsDisplay from './GraphsDisplay';
import { Trash2, ChevronDown, ChevronUp, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';

interface FavoriteCardComponentProps {
  favorite: FavoriteLocation;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: (id: string) => void;
  isOrganizing?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onTouchStartHandle?: (e: React.TouchEvent<HTMLDivElement>) => void;
}

export default function FavoriteCardComponent({
  favorite,
  isExpanded,
  onToggleExpand,
  onRemove,
  isOrganizing = false,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStartHandle,
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
  const coordKey = getCoordKey(favorite.latitude, favorite.longitude);

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
        }
      })
      .catch((err) => {
        console.debug('Error reading favorite from local DB:', err);
      });

    // Background fetch for fresh live weather
    const fetchCurrentWeather = async () => {
      try {
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
          setIsLoadingWeather(false);

          // Update IndexedDB
          saveLocalWeather(coordKey, {
            location: {
              name: favorite.location_name,
              country: favorite.country_code,
              lat: favorite.latitude,
              lon: favorite.longitude,
            },
            weather: wData,
            rainFalls,
            snowDepth,
            forecast: forecastData,
          }).catch((saveErr) => console.debug('Failed saving favorite to local DB:', saveErr));
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
  }, [coordKey, favorite.latitude, favorite.longitude, favorite.location_name, favorite.country_code]);

  // 2. Fetch forecast data when card is expanded (with local cache support)
  const fetchForecast = useCallback(async () => {
    if (hasFetchedForecastRef.current || isLoadingForecast) return;
    try {
      // If we don't have forecast yet, show loading spinner
      if (!forecastData) {
        setIsLoadingForecast(true);
      }
      setForecastError(null);
      const data = await getForecast(
        favorite.latitude.toString(),
        favorite.longitude.toString()
      );
      setForecastData(data);
      hasFetchedForecastRef.current = true;

      // Update local IndexedDB with fresh forecast
      if (weatherData) {
        saveLocalWeather(coordKey, {
          location: {
            name: favorite.location_name,
            country: favorite.country_code,
            lat: favorite.latitude,
            lon: favorite.longitude,
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
  }, [favorite.latitude, favorite.longitude, isLoadingForecast, forecastData, weatherData, coordKey, rainFallsData, snowDepthData, favorite.location_name, favorite.country_code, t]);

  useEffect(() => {
    if (isExpanded && !hasFetchedForecastRef.current) {
      fetchForecast();
    }
  }, [isExpanded, fetchForecast]);

  const handleHeaderClick = () => {
    // When in organizing mode, avoid collapsing/expanding so reordering is smooth
    if (isOrganizing) return;
    onToggleExpand();
  };

  const iconCode = weatherData?.weather[0]?.icon || '01d';

  return (
    <div
      draggable={isOrganizing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      data-favorite-id={favorite._id}
      className={`border rounded-xl mb-3 transition-all duration-200 shadow-xs ${
        isDragOver
          ? 'border-blue-500 ring-2 ring-blue-400/50 bg-blue-50/50 dark:bg-blue-950/40 scale-[1.01]'
          : darkMode
          ? 'bg-gray-800/90 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-blue-200'
      } ${isOrganizing ? 'cursor-grab active:cursor-grabbing border-dashed' : ''}`}
    >
      {/* Clickable Card Header */}
      <div
        onClick={handleHeaderClick}
        className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 select-none ${
          isOrganizing ? '' : 'cursor-pointer'
        }`}
        role="button"
        aria-expanded={isExpanded}
      >
        {/* Left: Drag Handle (in organizing mode) + Location Name & Flag */}
        <div className="flex items-center gap-2 min-w-0">
          {isOrganizing && (
            <div
              onTouchStart={onTouchStartHandle}
              className="p-1 -ml-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 cursor-grab active:cursor-grabbing touch-none"
              title={t('move_up')}
            >
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          {favorite.country_code && (
            <span className={`fi fi-${favorite.country_code.toLowerCase()} rounded shrink-0`}></span>
          )}
          <span className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
            {favorite.location_name}
          </span>
        </div>

        {/* Right: Organizing up/down actions OR Weather Summary & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isOrganizing ? (
            <div className="flex items-center gap-1">
              {onMoveUp && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp();
                  }}
                  disabled={isFirst}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    isFirst
                      ? 'opacity-30 cursor-not-allowed border-transparent text-gray-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title={t('move_up')}
                  aria-label={t('move_up')}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown();
                  }}
                  disabled={isLast}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    isLast
                      ? 'opacity-30 cursor-not-allowed border-transparent text-gray-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title={t('move_down')}
                  aria-label={t('move_down')}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
              {/* Delete button still accessible during organizing */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(favorite._id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                title={t('remove_button')}
                aria-label={t('remove_button')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {isLoadingWeather && !weatherData ? (
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
            </>
          )}
        </div>
      </div>

      {/* Expanded Forecast Details (only when expanded and not in organizing mode) */}
      {isExpanded && !isOrganizing && (
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
          {isLoadingForecast && !forecastData ? (
            <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
              <span>{t('loading_forecast')}</span>
            </div>
          ) : (
            <>
              {forecastError && !forecastData && (
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
