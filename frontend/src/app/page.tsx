// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWeatherAndSnow, fetchCachedFavorites } from "@/lib/weather_api";
import { Location, WeatherData, PrecipitationData, ForecastData, CachedFavoriteLocation } from '@/lib/types';
import WeatherDisplay from './components/WeatherDisplay';
import ForecastDisplay from './components/ForecastDisplay';
import GraphsDisplay from './components/GraphsDisplay';
import SearchDisplay from './components/SearchDisplay';
import { useLanguage } from '@/context/LanguageContext';

const LOCAL_STORAGE_KEY = 'cachedFavorites';

export default function Home() {
  const [city, setCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [rainFallsData, setRainFallsData] = useState<number | null>(null);
  const [snowDepthData, setSnowDepthData] = useState<number | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [precipitationData, setPrecipitationData] = useState<PrecipitationData[]>([]);
  const [isLoadingPrecipitation, setIsLoadingPrecipitation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGraphs, setShowGraphs] = useState(false);
  const [cachedFavorites, setCachedFavorites] = useState<CachedFavoriteLocation[]>([]);

  const { t } = useLanguage();

  useEffect(() => {
    const storedFavorites = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedFavorites) {
      setCachedFavorites(JSON.parse(storedFavorites));
    }

    const loadCachedFavorites = async () => {
      try {
        const favorites = await fetchCachedFavorites();
        setCachedFavorites(favorites);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(favorites));
      } catch (error) {
        console.error('Error fetching cached favorites:', error);
      }
    };
    loadCachedFavorites();
  }, []);

  const handleLocationSelect = useCallback(async (location: Partial<Location>) => {
    try {
      setIsSearching(true);
      setWeatherData(null);
      setForecastData(null);
      setPrecipitationData([]);
      setRainFallsData(null);
      setSnowDepthData(null);
      setError(null);
      setShowGraphs(false); // Reset showGraphs when a new location is selected

      const { weather, rainFalls, snowDepth } = await getWeatherAndSnow(location.lat!, location.lon!);

      if (weather) {
        const weatherDataToSet: WeatherData = weather as WeatherData;
        weatherDataToSet.name = location.name || location.location_name || 'Unknown Location';
        weatherDataToSet.country = location.country;
        setWeatherData(weatherDataToSet);
        setRainFallsData(rainFalls);
        setSnowDepthData(snowDepth);
      } else {
        setError(t('failed_to_fetch_weather_data'));
      }
    } catch (err) {
      console.error('Error in handleLocationSelect:', err);
      setError(t('failed_to_fetch_weather_and_snow'));
    } finally {
      setIsSearching(false);
    }
  }, [t, setIsSearching]);

  return (
    <div className="flex justify-center items-start py-8">
      <div className="w-full max-w-4xl mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 lg:px-8 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-8">
        {cachedFavorites.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">{t('popular_locations')}</h3>
            <div className="flex flex-wrap gap-2">
              {cachedFavorites.map((fav, index) => (
                <button
                  key={index}
                  onClick={() => handleLocationSelect({ location_name: fav.location_name, lat: fav.lat, lon: fav.lon, country: fav.country })}
                  className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  {fav.country && (
                    <span className={`fi fi-${fav.country.toLowerCase()} mr-2 rounded`}></span>
                  )}
                  {fav.location_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <SearchDisplay
          city={city}
          setCity={setCity}
          onLocationSelect={handleLocationSelect}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          error={error}
          setError={setError}
        />

        <WeatherDisplay weatherData={weatherData} rainFallsData={rainFallsData} snowDepthData={snowDepthData} />

        {weatherData && (
          <ForecastDisplay
            weatherData={weatherData}
            forecastData={forecastData}
            setForecastData={setForecastData}
            setError={setError}
          />
        )}

        {weatherData && (
          <GraphsDisplay
            weatherData={weatherData}
            precipitationData={precipitationData}
            setPrecipitationData={setPrecipitationData}
            isLoadingPrecipitation={isLoadingPrecipitation}
            setIsLoadingPrecipitation={setIsLoadingPrecipitation}
            showGraphs={showGraphs}
            setShowGraphs={setShowGraphs}
            setError={setError}
          />
        )}
      </div>
    </div>
  );
}