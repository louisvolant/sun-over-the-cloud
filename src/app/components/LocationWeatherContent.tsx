// src/app/components/LocationWeatherContent.tsx
'use client';

import { WeatherData, ForecastData, PrecipitationData } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { Loader2 } from 'lucide-react';
import WeatherDisplay from './WeatherDisplay';
import ForecastDisplay from './ForecastDisplay';
import GraphsDisplay from './GraphsDisplay';

interface LocationWeatherContentProps {
  weatherData: WeatherData | null;
  rainFallsData: number | null;
  snowDepthData: number | null;
  isLoadingWeather: boolean;
  forecastData: ForecastData | null;
  setForecastData: (data: ForecastData | null) => void;
  isLoadingForecast: boolean;
  forecastError: string | null;
  setForecastError: (error: string | null) => void;
  precipitationData: PrecipitationData[];
  setPrecipitationData: (data: PrecipitationData[]) => void;
  isLoadingPrecipitation: boolean;
  setIsLoadingPrecipitation: (isLoading: boolean) => void;
  showGraphs: boolean;
  setShowGraphs: (show: boolean) => void;
  graphsError: string | null;
  setGraphsError: (error: string | null) => void;
}

/**
 * Dev comment:
 * Full weather view for a single location: current conditions, forecast strip
 * and (on-demand) monthly graphs. This is exactly the content shown today
 * inside an expanded favorite card; it was extracted so the mobile swipeable
 * location carousel can reuse the very same view per slide.
 *
 * This component is purely presentational: all data fetching/caching lives in
 * the `useLocationWeather` hook, whose return value can be spread directly
 * into these props.
 */
export default function LocationWeatherContent({
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
}: LocationWeatherContentProps) {
  const { t } = useLanguage();

  // Full-size spinner while the first weather snapshot for this location loads
  if (!weatherData && isLoadingWeather) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
        <span>{t('loading_weather_data')}</span>
      </div>
    );
  }

  return (
    <>
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
          {forecastData && weatherData && (
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
    </>
  );
}
