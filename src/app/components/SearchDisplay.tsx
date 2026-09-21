// src/app/components/SearchDisplay.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { search, getDistance } from '@/lib/weather_api';
import { Location } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { Loader2, MapPin, X } from 'lucide-react';

interface SearchDisplayProps {
  city: string;
  setCity: (city: string) => void;
  onLocationSelect: (location: Location) => void; // Callback when a location is selected
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  /**
   * Dev comment: optional element rendered on the right of each result row
   * (e.g. an "add to favorites" action on the dedicated /search page).
   * Clicks inside it are stopped from propagating to the row selection.
   */
  renderResultAction?: (location: Location) => React.ReactNode;
}

const DEBOUNCE_DELAY = 500; // Milliseconds for debounce

export default function SearchDisplay({
  city,
  setCity,
  onLocationSelect,
  isSearching,
  setIsSearching,
  error,
  setError,
  renderResultAction,
}: SearchDisplayProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [noResults, setNoResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const { t } = useLanguage();

  // Keep the latest selection callback in a ref so `performSearch` no longer
  // depends on it. The callback is usually an inline arrow recreated on every
  // parent render: depending on it made the debounce effect re-run endlessly,
  // firing a new search every 500ms and letting stale results overwrite a
  // freshly selected location (e.g. the geolocation result).
  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  const handleUseMyLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError(t('unexpected_error'));
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
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
            console.debug('Reverse geocode failed:', e);
          }

          onLocationSelectRef.current({
            name: cityName,
            lat,
            lon,
            country: countryCode,
            location_name: cityName,
          });
          // Clear the query here rather than relying on the caller: this keeps
          // the input in sync without letting a programmatic clear dismiss the
          // location the user just picked.
          setCity('');
          setLocations([]);
          setNoResults(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('failed_to_fetch_locations'));
        } finally {
          setIsLocating(false);
        }
      },
      (geoErr) => {
        setIsLocating(false);
        console.debug('Geolocation denied or failed:', geoErr.message);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [setCity, setError, t]);

  // Memoized search function
  const performSearch = useCallback(async () => {
    if (!city.trim()) {
      setLocations([]);
      setNoResults(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null); // Clear previous errors
    setNoResults(false); // Clear previous no results

    try {
      const data = await search(city);

      if (data.length === 0) {
        setNoResults(true);
        setLocations([]);
        return;
      }

      // Existing grouping and filtering logic
      const groupedLocations: { [key: string]: Location[] } = {};
      data.forEach((loc: Location) => {
        const key = `${loc.name}-${loc.country}-${loc.state || ''}`;
        if (!groupedLocations[key]) {
          groupedLocations[key] = [];
        }
        groupedLocations[key].push(loc);
      });

      const filteredLocations = Object.values(groupedLocations).map((group) => {
        if (group.length === 1) return group[0];

        const clusters: Location[][] = [];
        group.forEach((loc) => {
          let added = false;
          for (const cluster of clusters) {
            if (
              cluster.some(
                (cl) => getDistance(loc.lat, loc.lon, cl.lat, cl.lon) <= 1
              )
            ) {
              cluster.push(loc);
              added = true;
              break;
            }
          }
          if (!added) clusters.push([loc]);
        });

        return clusters.map((cluster) =>
          cluster.reduce((best, current) => {
            const bestLocalNamesCount = Object.keys(best.local_names || {}).length;
            const currentLocalNamesCount = Object.keys(current.local_names || {}).length;
            return currentLocalNamesCount > bestLocalNamesCount ? current : best;
          })
        )[0];
      });

      if (filteredLocations.length === 1) {
        onLocationSelectRef.current(filteredLocations[0]);
        setLocations([]); // Clear results after auto-selecting
      } else {
        setLocations(filteredLocations);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError(t('failed_to_fetch_locations'));
      setLocations([]);
      setNoResults(false);
    } finally {
      setIsSearching(false);
    }
  }, [city, setIsSearching, setError, t]);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch();
    }, DEBOUNCE_DELAY);

    return () => {
      clearTimeout(handler);
    };
  }, [city, performSearch]); // Re-run effect when city or performSearch changes

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // Instant clear: empties the query and wipes the current results without
  // waiting for the debounce, so the user can restart typing right away.
  const handleClearSearch = useCallback(() => {
    setCity('');
    setLocations([]);
    setNoResults(false);
    setError(null);
  }, [setCity, setError]);

  return (
    <div>
      {/* Input and button container */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-grow flex items-center">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search_placeholder')}
            className={`w-full p-3 ${city ? 'pr-24' : 'pr-12'} border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
          />
          <div className="absolute right-2 flex items-center gap-0.5">
            {city && (
              <button
                type="button"
                onClick={handleClearSearch}
                title={t('clear_search')}
                aria-label={t('clear_search')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating || isSearching}
              title={t('use_my_location')}
              className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-md transition-colors disabled:opacity-50"
              aria-label={t('use_my_location')}
            >
              {isLocating ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <button
          onClick={performSearch}
          disabled={isSearching || !city.trim()}
          className={`flex-shrink-0 p-3 bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 flex items-center justify-center transition-colors ${
            isSearching || !city.trim() ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t('searching_text')}
            </>
          ) : (
            t('search_button')
          )}
        </button>
      </div>

      {error && <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>}
      {noResults && <div className="text-gray-600 dark:text-gray-400 mb-4">{t('no_results')}</div>}

      {locations.length > 0 && (
        <div className="mb-4">
          {locations.map((location, index) => (
            <div
              key={index}
              onClick={() => onLocationSelect(location)} // Use the passed callback
              className="p-2 mb-2 bg-gray-200 dark:bg-gray-700 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200 flex items-center justify-between gap-2"
            >
              <div className="flex items-center min-w-0">
                {location.country && (
                  <span className={`fi fi-${location.country.toLowerCase()} mr-2 rounded`}></span>
                )}
                <span className="truncate">
                  {location.name}, {location.country} {location.state ? `(${location.state})` : ''}
                </span>
              </div>
              {renderResultAction && (
                // Stop the click so tapping the action does not also select the row
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  {renderResultAction(location)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}