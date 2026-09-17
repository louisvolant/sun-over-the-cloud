// src/app/search/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, Star, Loader2 } from 'lucide-react';
import SearchDisplay from '../components/SearchDisplay';
import { addFavorite } from '@/lib/account_api';
import { Location } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getCoordKey } from '@/lib/localWeatherDb';
import { PENDING_SEARCH_SELECTION_KEY } from '@/lib/constants';

/**
 * Dev comment:
 * Dedicated mobile-first search page (kept header/footer navigation). It
 * replaces the former floating search panel overlay: results and their
 * favorite actions are much easier to manage on a full page.
 *
 * Behaviors:
 *  - Tap a result row (or a single auto-matched result) -> navigates home and
 *    displays that location.
 *  - Tap the star on a result (logged-in users only) -> adds it to favorites.
 *    Favorites are removed from the home cards or the account page, so this
 *    page stays add-only and stateless.
 */
export default function SearchPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Coordinates of favorites added during this session (optimistic star state)
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  const handleViewLocation = (location: Location) => {
    // Hand the selection over to the home page instead of fetching here:
    // the home carousel owns the weather data lifecycle and persistence.
    sessionStorage.setItem(
      PENDING_SEARCH_SELECTION_KEY,
      JSON.stringify({
        name: location.name,
        lat: location.lat,
        lon: location.lon,
        country: location.country,
        location_name: location.name,
      })
    );
    router.push('/');
  };

  const handleAddFavorite = async (location: Location) => {
    const key = getCoordKey(location.lat, location.lon);
    if (addedKeys.includes(key)) return; // Already added from this page
    try {
      setIsFavoriteLoading(true);
      await addFavorite({
        location_name: location.name,
        latitude: location.lat,
        longitude: location.lon,
        country_code: location.country,
      });
      setAddedKeys((prev) => [...prev, key]);
    } catch (err) {
      // Most likely "already in favorites" — mark it as added to stay consistent
      console.debug('Error adding favorite from search page:', err);
      setAddedKeys((prev) => [...prev, key]);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start py-8">
      <div className="w-full max-w-4xl mx-4 sm:mx-6 lg:mx-8 px-4 sm:px-6 lg:px-8 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <SearchIcon className="w-5 h-5 text-blue-500" />
          <span>{t('search_page_title')}</span>
        </h2>

        {isAuthenticated && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
            <span>{t('search_page_hint')}</span>
          </p>
        )}

        <SearchDisplay
          city={city}
          setCity={setCity}
          onLocationSelect={handleViewLocation}
          isSearching={isSearching}
          setIsSearching={setIsSearching}
          error={error}
          setError={setError}
          renderResultAction={
            isAuthenticated
              ? (location) => {
                  const key = getCoordKey(location.lat, location.lon);
                  const isAdded = addedKeys.includes(key);
                  return (
                    <button
                      type="button"
                      onClick={() => handleAddFavorite(location)}
                      disabled={isAdded || isFavoriteLoading}
                      title={isAdded ? t('in_favorites') : t('add_to_favorites')}
                      aria-label={isAdded ? t('in_favorites') : t('add_to_favorites')}
                      className={`p-2 rounded-full transition-colors ${
                        isAdded
                          ? 'text-amber-500 fill-amber-400'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600'
                      } ${isFavoriteLoading && !isAdded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isFavoriteLoading && !isAdded ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Star className={`w-5 h-5 ${isAdded ? 'fill-amber-400' : ''}`} />
                      )}
                    </button>
                  );
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
