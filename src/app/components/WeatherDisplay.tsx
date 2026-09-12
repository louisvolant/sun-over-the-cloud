// src/components/WeatherDisplay.tsx
'use client';

import { WeatherData } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/context/LanguageContext';
import {
  Sun, Cloud, Droplets, Wind, Eye, Sunrise, Sunset, CloudRain, Snowflake, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { weatherIconMap, weatherIconColorMap, weatherIconAnimationMap } from '@/lib/weatherIconMap';

interface WeatherDisplayProps {
  weatherData: WeatherData | null;
  rainFallsData: number | null;
  snowDepthData: number | null;
}

export default function WeatherDisplay({ weatherData, rainFallsData, snowDepthData }: WeatherDisplayProps) {
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
      console.debug('Error using IANA timezone:', error);
      // Fallback to UTC without offset
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date(timestamp * 1000));
    }
    console.debug(`formatTime input: timestamp=${timestamp}, timezone=${timezone}, output=${formattedTime}`);
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
      console.debug('Error formatting current time with IANA timezone:', error);
      // Fallback to UTC
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date());
    }
    console.debug(`formatCurrentTime: timezone=${timezone}, output=${formattedTime}`);
    // Use 'h' separator for French, ':' for others
    return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
  };

  // Use the timezone from weatherData, fallback to UTC
  const timezone = weatherData.timezone || 'UTC';
  console.debug('weatherData:', weatherData);
  console.debug('weatherData.timezone:', weatherData.timezone);
  console.debug('weatherData.timezone_offset:', weatherData.timezone_offset);
  console.debug('language:', language);

  const iconCode = weatherData.weather[0]?.icon || '01d';

  return (
    <div className={`p-4 md:p-5 rounded-xl mb-4 border ${darkMode ? 'bg-gray-800/90 border-gray-700 text-gray-100' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 text-gray-900'} shadow-sm transition-all`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Column: Primary Weather (max 3 lines) */}
        <div className="flex-1 min-w-0">
          {/* Line 1: Location & Time */}
          <div className="flex items-center mb-1">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center truncate">
              {weatherData.country && (
                <span className={`fi fi-${weatherData.country.toLowerCase()} mr-2 rounded shrink-0`}></span>
              )}
              <span className="truncate">{weatherData.name}</span>
              <span className="text-xs sm:text-sm ml-2 font-normal opacity-75 shrink-0">({formatCurrentTime(timezone)})</span>
            </h2>
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
            {rainFallsData !== null && rainFallsData > 0 && (
              <div className="flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{rainFallsData.toFixed(1)} {t('rain_unit')}</span>
              </div>
            )}
            {snowDepthData !== null && snowDepthData > 0 && (
              <div className="flex items-center gap-1.5">
                <Snowflake className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{snowDepthData.toFixed(1)} {t('snow_unit')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}