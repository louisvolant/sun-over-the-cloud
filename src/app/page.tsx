// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getWeatherAndSnow, fetchCachedFavorites } from "@/lib/weather_api";
import { getFavorites, addFavorite, removeFavorite } from "@/lib/account_api";
import { Location, WeatherData, PrecipitationData, ForecastData, CachedFavoriteLocation, FavoriteLocation } from '@/lib/types';
import WeatherDisplay from './components/WeatherDisplay';
import ForecastDisplay from './components/ForecastDisplay';
import GraphsDisplay from './components/GraphsDisplay';
import SearchDisplay from './components/SearchDisplay';
import FavoriteCardComponent from './components/FavoriteCardComponent';
import LoginModal from './components/LoginModal';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Star, Loader2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'cachedFavorites';
const LAST_LOCATION_KEY = 'lastSelectedLocation';

export default function Home() {
  const { isAuthenticated } = useAuth();
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

  // User favorites state (when authenticated)
  const [userFavorites, setUserFavorites] = useState<FavoriteLocation[]>([]);
  const [isLoadingUserFavorites, setIsLoadingUserFavorites] = useState(false);
  const [expandedFavoriteId, setExpandedFavoriteId] = useState<string | null>(null);
  const [isFavoriteActionLoading, setIsFavoriteActionLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const { t } = useLanguage();

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

        // Save last location to localStorage
        try {
          localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({
            name: weatherDataToSet.name,
            country: location.country,
            lat: location.lat,
            lon: location.lon,
            location_name: weatherDataToSet.name,
          }));
        } catch (e) {
          console.debug('Failed to save location to localStorage:', e);
        }
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

    // 1. Try restoring last selected location from localStorage
    const savedLocation = localStorage.getItem(LAST_LOCATION_KEY);
    if (savedLocation) {
      try {
        const parsed = JSON.parse(savedLocation);
        if (parsed.lat && parsed.lon) {
          handleLocationSelect(parsed);
          return;
        }
      } catch (e) {
        console.debug('Failed to parse saved location:', e);
      }
    }

    // 2. If no saved location, request browser geolocation
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          let cityName = t('current_location');
          let countryCode = '';

          try {
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
            if (res.ok) {
              const data = await res.json();
              if (data.city || data.locality) {
                cityName = data.city || data.locality;
              }
              if (data.countryCode) {
                countryCode = data.countryCode;
              }
            }
          } catch (e) {
            console.debug('Reverse geocoding error:', e);
          }

          handleLocationSelect({
            name: cityName,
            lat,
            lon,
            country: countryCode,
            location_name: cityName,
          });
        },
        (geoError) => {
          console.debug('Geolocation prompt dismissed or denied:', geoError.message);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [handleLocationSelect, t]);

  // Load user favorites when authenticated
  const loadUserFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingUserFavorites(true);
      const favs = await getFavorites();
      setUserFavorites(favs);
    } catch (err) {
      console.error('Error fetching user favorites:', err);
    } finally {
      setIsLoadingUserFavorites(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadUserFavorites();
    } else {
      setUserFavorites([]);
    }
  }, [isAuthenticated, loadUserFavorites]);

  const handleRemoveFavorite = useCallback(async (id: string) => {
    try {
      await removeFavorite(id);
      setUserFavorites((prev) => prev.filter((f) => f._id !== id));
      if (expandedFavoriteId === id) {
        setExpandedFavoriteId(null);
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  }, [expandedFavoriteId]);

  const handleToggleExpandFavorite = useCallback((id: string) => {
    setExpandedFavoriteId((prev) => (prev === id ? null : id));
  }, []);

  const currentMatchingFavorite = weatherData
    ? userFavorites.find(
        (f) =>
          f.location_name.toLowerCase() === weatherData.name.toLowerCase() ||
          (Math.abs(f.latitude - weatherData.coord.lat) < 0.05 &&
            Math.abs(f.longitude - weatherData.coord.lon) < 0.05)
      )
    : undefined;

  const handleToggleSearchFavorite = useCallback(async () => {
    if (!weatherData) return;
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
      return;
    }
    try {
      setIsFavoriteActionLoading(true);
      if (currentMatchingFavorite) {
        await removeFavorite(currentMatchingFavorite._id);
        setUserFavorites((prev) => prev.filter((f) => f._id !== currentMatchingFavorite._id));
      } else {
        await addFavorite({
          location_name: weatherData.name,
          latitude: weatherData.coord.lat,
          longitude: weatherData.coord.lon,
          country_code: weatherData.country || '',
        });
        await loadUserFavorites();
      }
    } catch (err) {
      console.error('Error toggling favorite from search:', err);
    } finally {
      setIsFavoriteActionLoading(false);
    }
  }, [weatherData, isAuthenticated, currentMatchingFavorite, loadUserFavorites]);

  return (
    <div className="flex justify-center items-start py-8">
      <div className="w-full max-w-4xl mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 lg:px-8 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-8">
        {/* User Favorite Locations Cards (when authenticated, placed above search) */}
        {isAuthenticated && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              <span>{t('my_favorite_locations_title')}</span>
            </h3>

            {isLoadingUserFavorites ? (
              <div className="flex items-center justify-center py-6 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
                <span>{t('loading_favorites')}</span>
              </div>
            ) : userFavorites.length > 0 ? (
              <div className="space-y-2 mb-2">
                {userFavorites.map((fav) => (
                  <FavoriteCardComponent
                    key={fav._id}
                    favorite={fav}
                    isExpanded={expandedFavoriteId === fav._id}
                    onToggleExpand={() => handleToggleExpandFavorite(fav._id)}
                    onRemove={handleRemoveFavorite}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-3">
                {t('no_favorites_yet')}
              </p>
            )}
          </div>
        )}

        {/* Popular Locations (when not authenticated, placed above search) */}
        {!isAuthenticated && cachedFavorites.length > 0 && (
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

        <WeatherDisplay
          weatherData={weatherData}
          rainFallsData={rainFallsData}
          snowDepthData={snowDepthData}
          isFavorite={!!currentMatchingFavorite}
          onToggleFavorite={handleToggleSearchFavorite}
          isFavoriteLoading={isFavoriteActionLoading}
        />

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

        <LoginModal isOpen={isLoginModalOpen} setIsOpen={setIsLoginModalOpen} />
      </div>
    </div>
  );
}