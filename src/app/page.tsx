// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getWeatherAndSnow, fetchCachedFavorites, getForecast } from "@/lib/weather_api";
import { getFavorites, addFavorite, removeFavorite, updateFavoriteOrder } from "@/lib/account_api";
import {
  getLocalWeather,
  saveLocalWeather,
  deleteLocalWeather,
  getLocalFavorites,
  saveLocalFavorites,
  getAdjustedWeatherForNow,
  LAST_LOCATION_WEATHER_KEY,
} from '@/lib/localWeatherDb';
import { Location, WeatherData, PrecipitationData, ForecastData, CachedFavoriteLocation, FavoriteLocation } from '@/lib/types';
import { PENDING_SEARCH_SELECTION_KEY } from '@/lib/constants';
import WeatherDisplay from './components/WeatherDisplay';
import ForecastDisplay from './components/ForecastDisplay';
import GraphsDisplay from './components/GraphsDisplay';
import SearchDisplay from './components/SearchDisplay';
import FavoriteCardComponent from './components/FavoriteCardComponent';
import LoginModal from './components/LoginModal';
import LocationCarousel, { LocationCarouselHandle, CarouselLocation } from './components/LocationCarousel';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Star, Loader2, ArrowUpDown, PlusCircle, X } from 'lucide-react';

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

  // Favorites organization state (Drag and Drop / Reorder)
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchSourceIndexRef = useRef<number | null>(null);

  // Mobile swipeable carousel state (logged-in users only).
  const carouselRef = useRef<LocationCarouselHandle>(null);
  // Tracks the last coordinates a selection was made for, so the carousel only
  // auto-scrolls when a *new* location is picked (not on background refreshes).
  const lastSelectedCoordRef = useRef<string | null>(null);

  const { t } = useLanguage();

  const handleLocationSelect = useCallback(async (location: Partial<Location>, isBackground = false) => {
    try {
      if (!isBackground) {
        setIsSearching(true);
        setWeatherData(null);
        setForecastData(null);
        setPrecipitationData([]);
        setRainFallsData(null);
        setSnowDepthData(null);
        setError(null);
        setShowGraphs(false);
      }

      const { weather, rainFalls, snowDepth } = await getWeatherAndSnow(location.lat!, location.lon!);

      if (weather) {
        const weatherDataToSet: WeatherData = weather as WeatherData;
        weatherDataToSet.name = location.name || location.location_name || 'Unknown Location';
        weatherDataToSet.country = location.country;
        setWeatherData(weatherDataToSet);
        setRainFallsData(rainFalls);
        setSnowDepthData(snowDepth);

        // Fetch forecast in background and cache everything in IndexedDB
        let freshForecast: ForecastData | null = null;
        try {
          freshForecast = await getForecast(location.lat!.toString(), location.lon!.toString());
          setForecastData(freshForecast);
        } catch (forecastErr) {
          console.debug('Failed background forecast fetch:', forecastErr);
        }

        // Save last location to IndexedDB for instant reload on next app open
        saveLocalWeather(LAST_LOCATION_WEATHER_KEY, {
          location: {
            name: weatherDataToSet.name,
            country: location.country,
            lat: location.lat!,
            lon: location.lon!,
            location_name: weatherDataToSet.name,
          },
          weather: weatherDataToSet,
          rainFalls,
          snowDepth,
          forecast: freshForecast,
        }).catch((dbErr) => console.debug('Failed saving last location to IndexedDB:', dbErr));

        // Save last location to localStorage as fallback
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
      } else if (!isBackground) {
        setError(t('failed_to_fetch_weather_data'));
      }
    } catch (err) {
      console.error('Error in handleLocationSelect:', err);
      if (!isBackground) {
        setError(t('failed_to_fetch_weather_and_snow'));
      }
    } finally {
      if (!isBackground) {
        setIsSearching(false);
      }
    }
  }, [t]);

  // Synchronize updated forecast to IndexedDB
  const handleSetForecastData = useCallback((data: ForecastData | null) => {
    setForecastData(data);
    if (weatherData && data) {
      saveLocalWeather(LAST_LOCATION_WEATHER_KEY, {
        location: {
          name: weatherData.name,
          country: weatherData.country,
          lat: weatherData.coord.lat,
          lon: weatherData.coord.lon,
          location_name: weatherData.name,
        },
        weather: weatherData,
        rainFalls: rainFallsData,
        snowDepth: snowDepthData,
        forecast: data,
      }).catch((err) => console.debug('Failed updating forecast in IndexedDB:', err));
    }
  }, [weatherData, rainFallsData, snowDepthData]);

  useEffect(() => {
    // 0. Consume a pending location selection handed over by the dedicated
    // /search page — it takes priority over the last-viewed location restore
    // below (which would otherwise overwrite it with stale weather).
    try {
      const pendingRaw = sessionStorage.getItem(PENDING_SEARCH_SELECTION_KEY);
      if (pendingRaw) {
        sessionStorage.removeItem(PENDING_SEARCH_SELECTION_KEY);
        const pending = JSON.parse(pendingRaw);
        if (pending?.lat && pending?.lon) {
          handleLocationSelect(pending, false);
          return;
        }
      }
    } catch (e) {
      console.debug('Failed to read pending search selection:', e);
    }

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

    // 1. Check local IndexedDB immediately for instant visual display (PWA instant load)
    getLocalWeather(LAST_LOCATION_WEATHER_KEY)
      .then((cached) => {
        if (cached && cached.location && cached.location.lat && cached.location.lon) {
          const adjusted = getAdjustedWeatherForNow(cached);
          if (adjusted.weather) {
            setWeatherData(adjusted.weather);
            setForecastData(adjusted.forecast);
            setRainFallsData(adjusted.rainFalls);
            setSnowDepthData(adjusted.snowDepth);
          }
          // Trigger background fetch to refresh live data without blocking UI
          handleLocationSelect(cached.location, true);
          return;
        }

        // Fallback: restore last selected location from localStorage
        const savedLocation = localStorage.getItem(LAST_LOCATION_KEY);
        if (savedLocation) {
          try {
            const parsed = JSON.parse(savedLocation);
            if (parsed.lat && parsed.lon) {
              handleLocationSelect(parsed, false);
              return;
            }
          } catch (e) {
            console.debug('Failed to parse saved location:', e);
          }
        }

        // Fallback: request browser geolocation if no saved location exists
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
              }, false);
            },
            (geoError) => {
              console.debug('Geolocation prompt dismissed or denied:', geoError.message);
            },
            { timeout: 8000, maximumAge: 60000 }
          );
        }
      })
      .catch((err) => {
        console.debug('IndexedDB initialization error:', err);
      });
  }, [handleLocationSelect, t]);

  // Load user favorites (IndexedDB cache first, then API background sync)
  const loadUserFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // 1. Immediately display cached favorites from IndexedDB
      const cached = await getLocalFavorites();
      if (cached && cached.length > 0) {
        setUserFavorites(cached);
        setIsLoadingUserFavorites(false);
      } else {
        setIsLoadingUserFavorites(true);
      }

      // 2. Fetch fresh favorites in background
      const favs = await getFavorites();
      setUserFavorites(favs);
      saveLocalFavorites(favs).catch((err) => console.debug('Failed saving favorites to IndexedDB:', err));
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
      setIsOrganizing(false);
    }
  }, [isAuthenticated, loadUserFavorites]);

  const handleRemoveFavorite = useCallback(async (id: string) => {
    // Ask for confirmation on every removal path (mobile carousel star and
    // desktop trash button) so a mis-tap can never destroy a favorite.
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_remove_favorite'))) {
      return;
    }
    try {
      await removeFavorite(id);
      setUserFavorites((prev) => {
        const updated = prev.filter((f) => f._id !== id);
        saveLocalFavorites(updated).catch(() => {});
        return updated;
      });
      if (expandedFavoriteId === id) {
        setExpandedFavoriteId(null);
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  }, [expandedFavoriteId, t]);

  const handleToggleExpandFavorite = useCallback((id: string) => {
    setExpandedFavoriteId((prev) => (prev === id ? null : id));
  }, []);

  // Reordering helpers (for Drag & Drop and buttons)
  const reorderFavorites = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return;

    setUserFavorites((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);

      // Save to IndexedDB immediately
      saveLocalFavorites(updated).catch((err) => console.debug('Failed saving reordered favorites:', err));

      // Persist to server
      updateFavoriteOrder(updated.map((f) => f._id)).catch((err) => {
        console.error('Error syncing reordered favorites to server:', err);
      });

      return updated;
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index > 0) {
      reorderFavorites(index, index - 1);
    }
  }, [reorderFavorites]);

  const handleMoveDown = useCallback((index: number) => {
    if (index < userFavorites.length - 1) {
      reorderFavorites(index, index + 1);
    }
  }, [reorderFavorites, userFavorites.length]);

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIndexStr !== '' ? parseInt(sourceIndexStr, 10) : draggedIndex;

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      reorderFavorites(sourceIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag support for mobile PWA
  const handleTouchStart = (index: number) => {
    touchSourceIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchSourceIndexRef.current === null) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardElem = target?.closest('[data-favorite-id]');
    if (cardElem) {
      const favId = cardElem.getAttribute('data-favorite-id');
      const idx = userFavorites.findIndex((f) => f._id === favId);
      if (idx !== -1 && idx !== dragOverIndex) {
        setDragOverIndex(idx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      touchSourceIndexRef.current !== null &&
      dragOverIndex !== null &&
      touchSourceIndexRef.current !== dragOverIndex
    ) {
      reorderFavorites(touchSourceIndexRef.current, dragOverIndex);
    }
    touchSourceIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

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
        setUserFavorites((prev) => {
          const updated = prev.filter((f) => f._id !== currentMatchingFavorite._id);
          saveLocalFavorites(updated).catch(() => {});
          return updated;
        });
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

  const handleClearLastLocation = useCallback(() => {
    setWeatherData(null);
    setForecastData(null);
    deleteLocalWeather(LAST_LOCATION_WEATHER_KEY).catch(() => {});
    try {
      localStorage.removeItem(LAST_LOCATION_KEY);
    } catch {}
  }, []);

  // --- Mobile swipeable carousel (logged-in users) ---

  /**
   * Slides for the mobile carousel: one per saved favorite, in the user's
   * custom order. The home page is a favorites-only view on mobile: a freshly
   * searched location is NOT injected here anymore — it is handled on the
   * dedicated /search page (selected below the search bar, with actions to add
   * it to favorites or clear the search).
   */
  const carouselLocations = useMemo<CarouselLocation[]>(() => {
    if (!isAuthenticated) return [];
    return userFavorites.map((fav) => ({
      key: `fav-${fav._id}`,
      name: fav.location_name,
      countryCode: fav.country_code,
      lat: fav.latitude,
      lon: fav.longitude,
      favoriteId: fav._id,
    }));
  }, [isAuthenticated, userFavorites]);

  // Bring the matching favorite slide into view when the currently displayed
  // weather (e.g. restored from the local database on launch) corresponds to a
  // saved favorite. Guarded by a coordinate ref so background refreshes of the
  // same location never yank the carousel around. Non-favorite locations are
  // intentionally not focused: the home page only surfaces favorites on mobile.
  useEffect(() => {
    if (!isAuthenticated || !weatherData) return;
    const coordKey = `${weatherData.coord.lat},${weatherData.coord.lon}`;
    const isNewSelection = lastSelectedCoordRef.current !== coordKey;
    lastSelectedCoordRef.current = coordKey;
    if (!isNewSelection) return;

    const favIndex = userFavorites.findIndex(
      (f) =>
        Math.abs(f.latitude - weatherData.coord.lat) < 0.05 &&
        Math.abs(f.longitude - weatherData.coord.lon) < 0.05
    );
    if (favIndex !== -1) {
      carouselRef.current?.scrollToIndex(favIndex);
    }
  }, [isAuthenticated, weatherData, userFavorites]);

  return (
    <>
      {/* Mobile logged-in layout: a single full-height weather view per
          location, horizontally swipeable between all saved locations.
          Search lives in a collapsible panel triggered from the sticky
          footer navigation. The height accounts for the app header (~4.25rem
          incl. safe area) and the mobile footer nav (~3rem + safe area). */}
      {isAuthenticated && (
        <div
          className="md:hidden flex flex-col"
          style={{ height: 'calc(100dvh - 7.25rem - var(--safe-top) - var(--safe-bottom))' }}
        >
          {isLoadingUserFavorites && userFavorites.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-500" />
              <span>{t('loading_favorites')}</span>
            </div>
          ) : carouselLocations.length > 0 ? (
            <LocationCarousel
              ref={carouselRef}
              locations={carouselLocations}
              onRemoveFavorite={handleRemoveFavorite}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-500 dark:text-gray-400">
              <Star className="w-8 h-8 text-amber-400 fill-amber-300 mb-3" />
              <p className="italic mb-2">{t('no_favorites_yet')}</p>
              <p className="text-sm">{t('mobile_search_hint')}</p>
            </div>
          )}
        </div>
      )}

      {/* Desktop layout (and anonymous mobile users) — unchanged */}
      <div className={`justify-center items-start py-8 ${isAuthenticated ? 'hidden md:flex' : 'flex'}`}>
      <div className="w-full max-w-4xl mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 lg:px-8 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-8">
        {/* User Favorite Locations Cards (when authenticated, placed above search) */}
        {isAuthenticated && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <span>{t('my_favorite_locations_title')}</span>
              </h3>

              {userFavorites.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsOrganizing((prev) => !prev)}
                  className={`text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isOrganizing
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-xs'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={isOrganizing}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{isOrganizing ? t('done_organizing') : t('organize_favorites')}</span>
                </button>
              )}
            </div>

            {isLoadingUserFavorites && userFavorites.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
                <span>{t('loading_favorites')}</span>
              </div>
            ) : userFavorites.length > 0 ? (
              <div
                className="space-y-2 mb-2"
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {userFavorites.map((fav, index) => (
                  <FavoriteCardComponent
                    key={fav._id}
                    favorite={fav}
                    isExpanded={expandedFavoriteId === fav._id}
                    onToggleExpand={() => handleToggleExpandFavorite(fav._id)}
                    onRemove={handleRemoveFavorite}
                    isOrganizing={isOrganizing}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    isFirst={index === 0}
                    isLast={index === userFavorites.length - 1}
                    isDragOver={dragOverIndex === index && draggedIndex !== index}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={(e) => handleDragLeave(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onTouchStartHandle={() => handleTouchStart(index)}
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
                  onClick={() => handleLocationSelect({ location_name: fav.location_name, lat: fav.lat, lon: fav.lon, country: fav.country }, false)}
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

        {/* "Nouvelle ville" title displayed above search bar when there are favorites */}
        {((isAuthenticated && userFavorites.length > 0) || (!isAuthenticated && cachedFavorites.length > 0)) && (
          <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-500" />
            <span>{t('new_city_title')}</span>
          </h3>
        )}

        <SearchDisplay
          city={city}
          setCity={setCity}
          onLocationSelect={(loc) => handleLocationSelect(loc, false)}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          error={error}
          setError={setError}
        />

        <div className="relative">
          {weatherData !== null && (
            <button
              type="button"
              onClick={handleClearLastLocation}
              aria-label="Dismiss"
              className="absolute top-2 right-2 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
              setForecastData={handleSetForecastData}
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

        <LoginModal isOpen={isLoginModalOpen} setIsOpen={setIsLoginModalOpen} />
      </div>
      </div>
    </>
  );
}