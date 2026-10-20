// src/components/WeatherDisplay.tsx
'use client';

import { WeatherData } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/context/LanguageContext';
import {
  Sun, Cloud, Droplets, Wind, Eye, Sunrise, Sunset, CloudRain, Snowflake, ChevronDown, ChevronUp, Star, Loader2
} from 'lucide-react';
import { useState } from 'react';
import { weatherIconMap, weatherIconColorMap, weatherIconAnimationMap } from '@/lib/weatherIconMap';
import { debugLog } from '@/lib/logger';

interface WeatherDisplayProps {
  weatherData: WeatherData | null;
  rainFallsData: number | null;
  snowDepthData: number | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isFavoriteLoading?: boolean;
  /** Render the favorite action as a compact icon-only star (used on mobile carousel slides). */
  favoriteIconOnly?: boolean;
}

export default function WeatherDisplay({
  weatherData,
  rainFallsData,
  snowDepthData,
  isFavorite = false,
  onToggleFavorite,
  isFavoriteLoading = false,
  favoriteIconOnly = false,
}: WeatherDisplayProps) {
  const { darkMode } = useTheme();
  const { t, tWeather, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!weatherData) return null;

  // Format time to the location's timezone using the IANA timezone
  const formatTime = (timestamp: number, timezone: string) => {
    let formattedTime;
    try {
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC', // Fallback to UTC
        hour12: false, // 24-hour format
      }).format(new Date(timestamp * 1000));
    } catch (error) {
      debugLog('Error using IANA timezone:', error);
      // Fallback to UTC without offset
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date(timestamp * 1000));
    }
    debugLog(`formatTime input: timestamp=${timestamp}, timezone=${timezone}, output=${formattedTime}`);
    // Use 'h' separator for French, ':' for others
    return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
  };

  // Format current time in the location's timezone
  const formatCurrentTime = (timezone: string) => {
    let formattedTime;
    try {
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC', // Fallback to UTC
        hour12: false, // 24-hour format
      }).format(new Date());
    } catch (error) {
      debugLog('Error formatting current time with IANA timezone:', error);
      // Fallback to UTC
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date());
    }
    debugLog(`formatCurrentTime: timezone=${timezone}, output=${formattedTime}`);
    // Use 'h' separator for French, ':' for others
    return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
  };

  // Use the timezone from weatherData, fallback to UTC
  const timezone = weatherData.timezone || 'UTC';
  debugLog('weatherData:', weatherData);
  debugLog('weatherData.timezone:', weatherData.timezone);
  debugLog('weatherData.timezone_offset:', weatherData.timezone_offset);
  debugLog('language:', language);

  const iconCode = weatherData.weather[0]?.icon || '01d';

  // Select the next 4 upcoming 15-minute slots whose 15-min window has not ended yet
  const nowSec = Math.floor(Date.now() / 1000);
  const rawMinutelySlots = Array.isArray(weatherData.minutely_15) ? weatherData.minutely_15 : [];
  const nextFourMinutelySlots = rawMinutelySlots
    .filter((slot) => slot.dt + 900 > nowSec)
    .slice(0, 4);
  const hasUpcomingRain =
    nextFourMinutelySlots.length > 0 &&
    nextFourMinutelySlots.some(
      (slot) => (slot.precipitation ?? 0) > 0 || (slot.rain ?? 0) > 0 || (slot.snowfall ?? 0) > 0
    );
  const nextHourTotal = nextFourMinutelySlots.reduce(
    (total, slot) => total + (slot.precipitation ?? slot.rain ?? 0),
    0
  );

  return (
    <div className={`p-4 md:p-5 rounded-xl mb-4 border ${darkMode ? 'bg-gray-800/90 border-gray-700 text-gray-100' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 text-gray-900'} shadow-sm transition-all`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Column: Primary Weather (max 3 lines) */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Location & Time and Favorite Action Button */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center truncate min-w-0">
              {weatherData.country && (
                <span className={`fi fi-${weatherData.country.toLowerCase()} mr-2 rounded shrink-0`}></span>
              )}
              <span className="truncate">{weatherData.name}</span>
              <span className="text-xs sm:text-sm ml-2 font-normal opacity-75 shrink-0">({formatCurrentTime(timezone)})</span>
            </h2>

            {onToggleFavorite &&
              (favoriteIconOnly ? (
                // Icon-only star, pushed flush to the right of the location line.
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={isFavoriteLoading}
                  className={`-mr-2 shrink-0 rounded-full p-2 transition-colors ${
                    isFavorite
                      ? 'text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      : 'text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700'
                  } ${isFavoriteLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  title={isFavorite ? t('remove_button') : t('add_button')}
                  aria-label={isFavorite ? t('remove_button') : t('add_button')}
                >
                  {isFavoriteLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={isFavoriteLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium rounded-lg border transition-all shrink-0 ${
                    isFavorite
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                      : 'bg-white dark:bg-gray-700 border-blue-400 text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-600'
                  } ${isFavoriteLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  title={isFavorite ? t('remove_button') : t('add_button')}
                >
                  {isFavoriteLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-500' : 'text-blue-500'}`} />
                  )}
                  <span>{isFavorite ? t('in_favorites') : t('add_to_favorites')}</span>
                </button>
              ))}
          </div>

          {/* Line 2: Weather Icon & Temperature */}
          <div className="flex items-center gap-3 my-1">
            <div className={`p-2 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${darkMode ? 'bg-gray-900/80 border border-gray-700' : 'bg-white border border-blue-200/70'}`}>
              <i
                className={`wi ${weatherIconMap[iconCode] || 'wi-day-sunny'} text-3xl sm:text-4xl ${
                  weatherIconColorMap[iconCode] || 'text-amber-500'
                } ${weatherIconAnimationMap[iconCode] || ''}`}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight">
                {weatherData.main.temp.toFixed(1)}{t('celsius_short')}
              </span>
              <span className="text-xs sm:text-sm opacity-80">
                ({weatherData.main.feels_like.toFixed(1)}{t('celsius_short')} {t('feels_like')})
              </span>
            </div>
          </div>

          {/* Line 3: Weather Description & Mobile Expand button */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="capitalize text-sm font-medium opacity-90 truncate">
              {tWeather(weatherData.weather[0]?.description || '')}
            </div>
            {/* Mobile expand button */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="md:hidden flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-gray-700/80 px-2 py-0.5 rounded-full shrink-0"
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? t('less_details') : t('more_details')}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Right Column: Detailed Conditions (desktop side-column, mobile accordion) */}
        <div className={`${isExpanded ? 'block' : 'hidden md:block'} border-t md:border-t-0 md:border-l border-gray-200/80 dark:border-gray-700/80 md:pl-6 pt-3 md:pt-0 shrink-0`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            {weatherData.wind.speed > 0 && (
              <div className="flex items-center gap-1.5" title={t('wind_speed_unit')}>
                <Wind className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{weatherData.wind.speed} {t('wind_speed_unit')} ({weatherData.wind.deg}°)</span>
              </div>
            )}
            {weatherData.main.humidity && (
              <div className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>{weatherData.main.humidity}{t('humidity_unit')}</span>
              </div>
            )}
            {weatherData.clouds.all > 0 && (
              <div className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{weatherData.clouds.all}{t('clouds_unit')}</span>
              </div>
            )}
            {weatherData.visibility && (
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{(weatherData.visibility / 1000).toFixed(0)} {t('visibility_unit')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Sunrise className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{formatTime(weatherData.sys.sunrise, timezone)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sunset className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{formatTime(weatherData.sys.sunset, timezone)}</span>
            </div>
            {rainFallsData !== null && rainFallsData >= 0.05 && (
              <div
                className="flex items-center gap-1.5"
                data-testid="rain-next-24h"
                title={t('rain_next_24h_hint')}
              >
                <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  {t('rain_next_24h_label')}{' '}
                  <span className="font-semibold">{rainFallsData.toFixed(1)} {t('rain_unit')}</span>
                </span>
              </div>
            )}
            {snowDepthData !== null && snowDepthData >= 0.05 && (
              <div
                className="flex items-center gap-1.5"
                data-testid="snow-next-24h"
                title={t('snow_next_24h_hint')}
              >
                <Snowflake className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  {t('snow_next_24h_label')}{' '}
                  <span className="font-semibold">{snowDepthData.toFixed(1)} {t('snow_unit')}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Next-hour 15-minute precipitation forecast (only rendered when rain/snow is expected) */}
      {hasUpcomingRain && (
        <div
          data-testid="next-hour-precipitation"
          className="mt-3 pt-3 border-t border-gray-200/80 dark:border-gray-700/80"
        >
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
            <span>{t('rain_next_hour_title')}</span>
            <span className="opacity-60" aria-hidden="true">·</span>
            <span
              className="font-semibold"
              data-testid="next-hour-rain-total"
              title={t('rain_next_hour_total_hint')}
            >
              {nextHourTotal.toFixed(1)} {t('rain_unit')}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {nextFourMinutelySlots.map((slot) => {
              const amount = slot.precipitation ?? slot.rain ?? 0;
              const isRainingSlot = amount > 0;
              const slotStart = formatTime(slot.dt, timezone);
              const slotEnd = formatTime(slot.dt + 900, timezone);
              const slotRange = t('rain_slot_time_range', {
                start: slotStart,
                end: slotEnd,
              });
              const intensityPct = isRainingSlot
                ? Math.min(100, Math.max(20, Math.round((amount / 2.0) * 100)))
                : 0;

              return (
                <div
                  key={slot.dt}
                  data-testid="next-hour-rain-slot"
                  title={`${slotRange} · ${amount.toFixed(1)} ${t('rain_unit')}`}
                  className={`flex flex-col items-center rounded-lg px-2 py-1.5 border text-xs transition-colors ${
                    isRainingSlot
                      ? darkMode
                        ? 'bg-blue-950/40 border-blue-800/70 text-blue-200'
                        : 'bg-blue-100/70 border-blue-200 text-blue-900'
                      : darkMode
                        ? 'bg-gray-900/50 border-gray-700/70 text-gray-400'
                        : 'bg-white/70 border-gray-200/70 text-gray-500'
                  }`}
                >
                  <span className="font-medium">{slotStart}</span>
                  <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden my-1">
                    {isRainingSlot && (
                      <div
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all"
                        style={{ width: `${intensityPct}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold">
                    {amount.toFixed(1)} {t('rain_unit')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}