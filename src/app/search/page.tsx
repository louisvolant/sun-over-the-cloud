// src/app/search/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, Star, Loader2, X } from 'lucide-react';
import SearchDisplay from '../components/SearchDisplay';
import { addFavorite } from '@/lib/account_api';
import { Location } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getCoordKey } from '@/lib/localWeatherDb';
import { PENDING_SEARCH_SELECTION_KEY } from '@/lib/constants';

/**
 * Dev comment:
 * Dedicated mobile-first search page (kept header/footer navigation).
 *
 * Behaviors (logged-in users):
 *  - Tapping a result row (or a single auto-matched result) selects the
 *    location and shows it in a panel right below the search bar — it no
 *    longer navigates away, because the mobile home page is a
 *    favorites-only view.
 *  - The selected panel offers two actions:
 *      * a star -> adds the location to favorites (it then appears on the
 *        home carousel and can be removed from there);
 *      * a clear (X) -> dismisses the selected result and empties the search.
 *  - The per-result star (logged-in users only) still allows quick adds.
 *
 * Behaviors (anonymous users): unchanged — selecting a proposal hands the
 * location over to the home page (which is the weather view when not
 * authenticated) via the pending-selection hand-off.
 */
export default function SearchPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const [city, setCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chosen location shown below the search bar (logged-in users only).
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  // Coordinates of favorites added during this session (optimistic star state)
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  const handleViewLocation = (location: Location) => {
    if (!isAuthenticated) {
      // Anonymous users: go home and display the weather for that location.
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
      return;
    }
    // Logged-in users: show the location below the search with add/clear actions.
    setSelectedLocation(location);
  };

  // Typing a new query dismisses the previously selected location panel.
  // A programmatic empty value (e.g. after using geolocation clears the input)
  // must NOT dismiss it: the location was just selected and should stay visible.
  const handleSetCity = (value: string) => {
    setCity(value);
    if (value.trim() !== '') {
      setSelectedLocation(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedLocation(null);
    setCity('');
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

  const selectedKey = selectedLocation ? getCoordKey(selectedLocation.lat, selectedLocation.lon) : null;
  const isSelectedAdded = selectedKey ? addedKeys.includes(selectedKey) : false;

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
          setCity={handleSetCity}
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

        {/* Selected location panel (logged-in users): add to favorites + clear */}
        {selectedLocation && isAuthenticated && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-gray-700/40 border border-blue-200 dark:border-gray-600 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {selectedLocation.country && (
                <span className={`fi fi-${selectedLocation.country.toLowerCase()} rounded shrink-0`}></span>
              )}
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                {selectedLocation.name}, {selectedLocation.country} {selectedLocation.state ? `(${selectedLocation.state})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleAddFavorite(selectedLocation)}
                disabled={isSelectedAdded || isFavoriteLoading}
                title={isSelectedAdded ? t('in_favorites') : t('add_to_favorites')}
                aria-label={isSelectedAdded ? t('in_favorites') : t('add_to_favorites')}
                className={`p-2 rounded-full transition-colors ${
                  isSelectedAdded
                    ? 'text-amber-500 fill-amber-400'
                    : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-600'
                } ${isFavoriteLoading && !isSelectedAdded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {isFavoriteLoading && !isSelectedAdded ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Star className={`w-5 h-5 ${isSelectedAdded ? 'fill-amber-400' : ''}`} />
                )}
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                title={t('clear_search')}
                aria-label={t('clear_search')}
                className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}