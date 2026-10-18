// src/app/favorites/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { List, ChevronRight, Loader2, Star } from 'lucide-react';
import { FavoriteLocation } from '@/lib/types';
import { getFavorites } from '@/lib/account_api';
import { getLocalFavorites, saveLocalFavorites } from '@/lib/localWeatherDb';
import { PENDING_FAVORITE_SELECTION_KEY } from '@/lib/constants';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '../components/ThemeProvider';
import useLocationWeather from '@/hooks/useLocationWeather';
import { weatherIconMap, weatherIconColorMap } from '@/lib/weatherIconMap';
import { debugLog } from '@/lib/logger';

interface FavoriteListRowProps {
  favorite: FavoriteLocation;
  onSelect: (favorite: FavoriteLocation) => void;
}

function FavoriteListRow({ favorite, onSelect }: FavoriteListRowProps) {
  const { darkMode } = useTheme();
  const { t, tWeather } = useLanguage();
  const { weatherData, isLoadingWeather } = useLocationWeather({
    latitude: favorite.latitude,
    longitude: favorite.longitude,
    locationName: favorite.location_name,
    countryCode: favorite.country_code,
  });

  const iconCode = weatherData?.weather[0]?.icon || '01d';

  return (
    <button
      type="button"
      data-testid="mobile-favorite-list-item"
      onClick={() => onSelect(favorite)}
      className={`w-full p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 text-left transition-all shadow-xs cursor-pointer ${
        darkMode
          ? 'bg-gray-800/90 border-gray-700 hover:border-blue-500/70 hover:bg-gray-750'
          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
      }`}
    >
      {/* Left: Country flag & Location name */}
      <div className="flex items-center gap-2.5 min-w-0">
        {favorite.country_code && (
          <span className={`fi fi-${favorite.country_code.toLowerCase()} rounded shrink-0`} />
        )}
        <span className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
          {favorite.location_name}
        </span>
      </div>

      {/* Right: Weather summary & Chevron */}
      <div className="flex items-center gap-2.5 shrink-0">
        {isLoadingWeather && !weatherData ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : weatherData ? (
          <div className="flex items-center gap-2">
            <i
              className={`wi ${weatherIconMap[iconCode] || 'wi-day-sunny'} text-xl ${
                weatherIconColorMap[iconCode] || 'text-amber-500'
              }`}
              title={tWeather(weatherData.weather[0]?.description || '')}
            />
            <span className="font-bold text-base text-gray-900 dark:text-gray-100">
              {weatherData.main.temp.toFixed(1)}
              {t('celsius_short')}
            </span>
          </div>
        ) : null}
        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
      </div>
    </button>
  );
}

/**
 * Dedicated mobile vertical list of favorite locations.
 * Tapping any favorite hands the selection to the Home page via sessionStorage
 * and navigates back to `/` with the carousel focused directly on that location.
 */
export default function FavoritesListPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated, isSyncing } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const cached = await getLocalFavorites();
      if (cached && cached.length > 0) {
        setFavorites(cached);
        setIsLoading(false);
      }

      const fresh = await getFavorites();
      setFavorites(fresh);
      saveLocalFavorites(fresh).catch((err) =>
        debugLog('Failed saving favorites to IndexedDB from /favorites:', err)
      );
    } catch (err) {
      debugLog('Error loading favorites on /favorites page:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSyncing && !isAuthenticated) {
      router.replace('/');
      return;
    }
    if (isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated, isSyncing, loadFavorites, router]);

  const handleSelectFavorite = (favorite: FavoriteLocation) => {
    try {
      sessionStorage.setItem(
        PENDING_FAVORITE_SELECTION_KEY,
        JSON.stringify({
          id: favorite._id,
          name: favorite.location_name,
          lat: favorite.latitude,
          lon: favorite.longitude,
          country: favorite.country_code,
        })
      );
    } catch (e) {
      debugLog('Failed to store pending favorite selection:', e);
    }
    router.push('/');
  };

  return (
    <div className="flex justify-center items-start py-6 sm:py-8">
      <div className="w-full max-w-4xl mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <List className="w-5 h-5 text-blue-500" />
          <span>{t('my_favorites')}</span>
        </h2>

        {isLoading && favorites.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-500" />
            <span>{t('loading_favorites')}</span>
          </div>
        ) : favorites.length > 0 ? (
          <div className="flex flex-col gap-2.5" data-testid="mobile-favorites-vertical-list">
            {favorites.map((favorite) => (
              <FavoriteListRow
                key={favorite._id}
                favorite={favorite}
                onSelect={handleSelectFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8 text-gray-500 dark:text-gray-400">
            <Star className="w-8 h-8 text-amber-400 fill-amber-300 mb-3" />
            <p className="italic">{t('no_favorites_yet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
