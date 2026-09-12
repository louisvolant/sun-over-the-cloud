// src/components/ForecastDisplay.tsx
'use client';
import { useEffect, useCallback, useRef } from 'react';
import { ForecastData, WeatherData } from '@/lib/types';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/context/LanguageContext';
import { getForecast } from '@/lib/weather_api';
import { weatherIconMap, weatherIconColorMap, weatherIconAnimationMap } from '@/lib/weatherIconMap';

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
      const dayName = date.toLocaleDateString(language === 'en' ? 'en-US' : (language === 'fr' ? 'fr-FR' : 'es-ES'), { weekday: 'long' });
      const day = date.getDate();
      const month = date.toLocaleDateString(language === 'en' ? 'en-US' : (language === 'fr' ? 'fr-FR' : 'es-ES'), { month: 'long' });
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

  useEffect(() => {
    console.debug('useEffect triggered: weatherData=', !!weatherData, 'forecastData=', !!forecastData);
    if (weatherData && !forecastData && !isFetchingRef.current) {
      handleShowForecast();
    }
  }, [weatherData, forecastData, handleShowForecast]);

  return (
    <div className="mb-4">
      <button
        onClick={handleShowForecast}
        className={`w-full p-2 mb-4 bg-green-500 text-white rounded hover:bg-green-700 dark:bg-green-600 dark:hover:bg-blue-500 ${
          !weatherData ? 'opacity-75 cursor-not-allowed' : ''
        }`}
        disabled={!weatherData}
      >
        {t('weather_forecast_button')}
      </button>

      {forecastData && (
        <div className={`p-6 rounded-lg shadow-md mb-4 ${darkMode ? 'bg-gray-900' : 'bg-green-50'} text-gray-950 dark:text-gray-100`}>
          <h2 className="text-2xl font-semibold mb-3">{t('weather_forecast_title')}</h2>
          <div className="flex flex-col gap-6">
            {(() => {
              const timezone = weatherData?.timezone || 'UTC';
              const { grouped, dateLabels } = groupForecastByDay(forecastData, timezone);
              return Object.entries(grouped).map(([dateKey, items]) => (
                <div key={dateKey} className="flex flex-col">
                  <h3 className="text-lg font-medium mb-2">{dateLabels[dateKey]}</h3>
                  <div className="overflow-x-auto scroll-smooth">
                    <div className="flex flex-row gap-2">
                      {items.map((item, index) => (
                        <div
                          key={index}
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
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}