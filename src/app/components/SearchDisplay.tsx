// src/app/components/SearchDisplay.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { search, getDistance } from '@/lib/weather_api';
import { Location } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { Loader2 } from 'lucide-react';

interface SearchDisplayProps {
  city: string;
  setCity: (city: string) => void;
  onLocationSelect: (location: Location) => void; // Callback when a location is selected
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
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
}: SearchDisplayProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [noResults, setNoResults] = useState(false);
  const { t } = useLanguage();

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
        onLocationSelect(filteredLocations[0]);
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
  }, [city, onLocationSelect, setIsSearching, setError, t]);

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

  return (
    <div>
      {/* Input and button container */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search_placeholder')}
          className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
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
              className="p-2 mb-2 bg-gray-200 dark:bg-gray-700 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200 flex items-center"
            >
              {location.country && (
                <span className={`fi fi-${location.country.toLowerCase()} mr-2 rounded`}></span>
              )}
              {location.name}, {location.country} {location.state ? `(${location.state})` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}