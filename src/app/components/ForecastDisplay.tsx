// src/components/ForecastDisplay.tsx
'use client';
import { useEffect, useCallback, useRef, useState } from 'react';
import { ForecastData, WeatherData } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/context/LanguageContext';
import { getForecast } from '@/lib/weather_api';
import { weatherIconMap, weatherIconColorMap, weatherIconAnimationMap } from '@/lib/weatherIconMap';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ForecastDisplayProps {
  weatherData: WeatherData | null;
  forecastData: ForecastData | null;
  setForecastData: (data: ForecastData | null) => void;
  setError: (error: string | null) => void;
}

export default function ForecastDisplay({ weatherData, forecastData, setForecastData, setError }: ForecastDisplayProps) {
  const { darkMode } = useTheme();
  const { language, t, tWeather } = useLanguage();
  const isFetchingRef = useRef(false); // Track if a fetch is in progress

  const handleShowForecast = useCallback(async () => {
    if (!weatherData || isFetchingRef.current) {
      console.debug('Skipping handleShowForecast: no weatherData or fetch in progress');
      return;
    }
    console.debug('Calling getForecast with lat:', weatherData.coord.lat, 'lon:', weatherData.coord.lon);
    isFetchingRef.current = true; // Set flag to prevent duplicate calls
    try {
      const data = await getForecast(weatherData.coord.lat.toString(), weatherData.coord.lon.toString());
      console.debug('Forecast data received:', data);
      setForecastData(data);
      setError(null);
    } catch (error) {
      console.debug('Error fetching forecast:', error);
      setError(t('failed_to_fetch_forecast'));
    } finally {
      isFetchingRef.current = false; // Reset flag after fetch completes
    }
  }, [weatherData, setForecastData, setError, t]);

  const getOrdinalSuffix = (day: number): string => {
    if (language === 'en') {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }
    return '';
  };

  const formatDateDisplay = (date: Date, currentDate: Date): string => {
    const today = new Date(currentDate.setHours(0, 0, 0, 0));
    const forecastDate = new Date(date.setHours(0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const currentHour = currentDate.getHours();

    if (forecastDate.getTime() === today.getTime()) {
      return currentHour >= 18 ? t('tonight_forecast') : t('today_forecast');
    } else if (forecastDate.getTime() === tomorrow.getTime()) {
      return t('tomorrow_forecast');
    } else {
      const dayNameRaw = date.toLocaleDateString(language === 'en' ? 'en-US' : (language === 'fr' ? 'fr-FR' : 'es-ES'), { weekday: 'long' });
      const dayName = dayNameRaw ? dayNameRaw.charAt(0).toUpperCase() + dayNameRaw.slice(1) : '';
      const day = date.getDate();
      const monthRaw = date.toLocaleDateString(language === 'en' ? 'en-US' : (language === 'fr' ? 'fr-FR' : 'es-ES'), { month: 'long' });
      const month = monthRaw ? monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1) : '';
      return `${dayName} ${day}${getOrdinalSuffix(day)} ${month}`;
    }
  };

  // Format time to the location's timezone with dynamic separator
  const formatForecastTime = (timestamp: number, timezone: string) => {
    let formattedTime;
    try {
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone || 'UTC', // Fallback to UTC
        hour12: false, // 24-hour format
      }).format(new Date(timestamp * 1000));
    } catch (error) {
      console.debug('Error in formatForecastTime:', error);
      // Fallback to UTC
      formattedTime = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(new Date(timestamp * 1000));
    }
    console.debug(`formatForecastTime: timestamp=${timestamp}, timezone=${timezone}, output=${formattedTime}`);
    // Use 'h' separator for French, ':' for others
    return language === 'fr' ? formattedTime.replace(':', 'h') : formattedTime;
  };

  const groupForecastByDay = (forecast: ForecastData, timezone: string) => {
    const currentDate = new Date();
    // Adjust current time to the location's timezone
    const currentLocalTime = new Date(
      currentDate.toLocaleString('en-US', { timeZone: timezone || 'UTC' })
    );
    console.debug('timezone:', timezone);
    console.debug('currentLocalTime:', currentLocalTime);
    const grouped: { [key: string]: { dt: number; main: { temp: number }; weather: { description: string; icon: string }[] }[] } = {};
    const dateLabels: { [key: string]: string } = {};

    forecast.list.forEach((item) => {
      const date = new Date(item.dt * 1000);
      // Adjust forecast time to the location's timezone
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone || 'UTC' }));
      console.debug('item.dt:', item.dt, 'localDate:', localDate);
      // Only include future times
      if (localDate.getTime() >= currentLocalTime.getTime()) {
        const dateKey = localDate.toLocaleDateString();
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
          dateLabels[dateKey] = formatDateDisplay(localDate, currentLocalTime);
        }
        grouped[dateKey].push(item);
      }
    });

    return { grouped, dateLabels };
  };

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const isDayExpanded = (dateKey: string, index: number) => {
    if (expandedDays[dateKey] !== undefined) {
      return expandedDays[dateKey];
    }
    // Only current/first day is expanded by default
    return index === 0;
  };

  const toggleDay = (dateKey: string, index: number) => {
    const currentState = isDayExpanded(dateKey, index);
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !currentState,
    }));
  };

  useEffect(() => {
    console.debug('useEffect triggered: weatherData=', !!weatherData, 'forecastData=', !!forecastData);
    if (weatherData && !forecastData && !isFetchingRef.current) {
      handleShowForecast();
    }
  }, [weatherData, forecastData, handleShowForecast]);

  if (!forecastData) return null;

  return (
    <div className="mb-4">
      <div className={`p-4 sm:p-6 rounded-xl shadow-xs mb-4 border ${darkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white border-gray-200/80'} text-gray-950 dark:text-gray-100`}>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">{t('weather_forecast_title')}</h2>
        <div className="flex flex-col gap-3">
          {(() => {
            const timezone = weatherData?.timezone || 'UTC';
            const { grouped, dateLabels } = groupForecastByDay(forecastData, timezone);
            return Object.entries(grouped).map(([dateKey, items], index) => {
              const temps = items.map((i) => i.main.temp);
              const minTemp = Math.min(...temps);
              const maxTemp = Math.max(...temps);
              const expanded = isDayExpanded(dateKey, index);

              // Find the best representative weather icon for the day:
              // Prioritize midday hours (11h-16h) if available, otherwise median item
              const middayItem =
                items.find((i) => {
                  const localHours = new Date(
                    new Date(i.dt * 1000).toLocaleString('en-US', { timeZone: timezone })
                  ).getHours();
                  return localHours >= 11 && localHours <= 16;
                }) || items[Math.floor(items.length / 2)] || items[0];

              const dayIcon = middayItem?.weather[0]?.icon || '01d';
              const dayDescription = middayItem?.weather[0]?.description || '';

              return (
                <div key={dateKey} className="flex flex-col border-b border-gray-200/70 dark:border-gray-700/60 last:border-b-0 pb-3 last:pb-0">
                  {/* Clickable Header Row */}
                  <div
                    onClick={() => toggleDay(dateKey, index)}
                    className="flex items-center justify-between flex-wrap gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none transition-colors"
                    role="button"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {dateLabels[dateKey]}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-gray-100/90 dark:bg-gray-700/80 shadow-2xs border border-gray-200/60 dark:border-gray-600/60">
                      <div className="flex items-center gap-1.5" title={tWeather(dayDescription)}>
                        <i
                          className={`wi ${weatherIconMap[dayIcon] || 'wi-day-sunny'} text-xl ${
                            weatherIconColorMap[dayIcon] || 'text-amber-500'
                          }`}
                        />
                        <span className="capitalize text-xs text-gray-600 dark:text-gray-300 hidden sm:inline font-normal">
                          {tWeather(dayDescription)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold tracking-tight">
                        <span className="text-blue-600 dark:text-blue-400">{minTemp.toFixed(1)}°C</span>
                        <span className="text-gray-300 dark:text-gray-500 font-light">/</span>
                        <span className="text-red-500 dark:text-red-400">{maxTemp.toFixed(1)}°C</span>
                      </div>
                    </div>
                  </div>

                  {/* Hourly Forecast (expanded only) */}
                  {expanded && (
                    <div className="overflow-x-auto scroll-smooth pt-3 pb-1">
                      <div className="flex flex-row gap-2">
                        {items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className={`flex flex-col items-center min-w-[100px] p-1 border-r-[0.5px] last:border-r-0 ${
                              darkMode ? 'border-gray-600' : 'border-gray-300'
                            }`}
                          >
                            <span className="text-xs font-medium mb-1">{formatForecastTime(item.dt, timezone)}</span>
                            <div className={`flex-shrink-0 rounded-full p-1 mb-1 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                              <i
                                className={`wi ${weatherIconMap[item.weather[0].icon]} text-3xl ${
                                  weatherIconColorMap[item.weather[0].icon]
                                } ${weatherIconAnimationMap[item.weather[0].icon] || ''}`}
                              />
                            </div>
                            <span className="text-xs font-medium mb-1">{item.main.temp.toFixed(1)}°C</span>
                            <span className="text-[10px] text-center capitalize">
                              {tWeather(item.weather[0].description)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}