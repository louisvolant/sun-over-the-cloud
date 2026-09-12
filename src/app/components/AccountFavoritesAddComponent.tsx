// src/app/components/AccountFavoritesAddComponent.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { search, getDistance } from '@/lib/weather_api';
import { Location } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { Loader2 } from 'lucide-react';

interface AccountFavoritesAddComponentProps {
  onAddFavorite: (location: Location) => void;
}

export default function AccountFavoritesAddComponent({
  onAddFavorite,
}: AccountFavoritesAddComponentProps) {
  const [searchCity, setSearchCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const { t } = useLanguage();

  const handleSearch = useCallback(async () => {
    // Only perform search if there's actual input
    if (!searchCity.trim()) {
      setLocations([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await search(searchCity);
      if (data.length === 0) {
        setLocations([]);
        return;
      }

      // Your existing grouping and filtering logic for locations
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
            if (cluster.some((cl) => getDistance(loc.lat, loc.lon, cl.lat, cl.lon) <= 1)) {
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
      setLocations(filteredLocations);
    } catch (error) {
      console.error('Error searching locations:', error);
      setLocations([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchCity]);

  // We keep the debounce for automatic search on input change,
  // but the button will trigger handleSearch directly.
  useEffect(() => {
    if (!searchCity.trim()) {
      setLocations([]);
      return;
    }
    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(debounceTimer);
  }, [searchCity, handleSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddClick = (location: Location) => {
    onAddFavorite(location);
    setSearchCity(''); // Clear search input
    setLocations([]); // Clear search results
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4">{t('add_new_favorite_title')}</h2>
      <div className="flex flex-col sm:flex-row gap-4 mb-4"> {/* Use flexbox for input and button */}
        <input
          type="text"
          value={searchCity}
          onChange={(e) => setSearchCity(e.target.value)}
          onKeyDown={handleKeyDown} // Keep Enter key functionality
          placeholder={t('enter_city_favorite_placeholder')}
          className="flex-grow p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        <button
          onClick={handleSearch} // Trigger search on button click
          disabled={isSearching || !searchCity.trim()} // Disable if searching or input is empty
          className={`flex-shrink-0 p-3 bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 flex items-center justify-center transition-colors ${
            isSearching || !searchCity.trim() ? 'opacity-75 cursor-not-allowed' : ''
          }`}
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {/* Example loading icon */}
              {t('searching_text')}
            </>
          ) : (
            t('search_button') // Assuming you have a 'search_button' translation key
          )}
        </button>
      </div>

      {locations.length > 0 && (
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          {locations.map((location) => (
            <div
              key={`${location.name}-${location.lat}-${location.lon}-${location.country}`}
              className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-gray-900 dark:text-gray-100">
                {location.country && (
                  <span className={`fi fi-${location.country.toLowerCase()} mr-2 rounded`}></span>
                )}
                {location.name}, {location.country} {location.state ? `(${location.state})` : ''}
              </span>
              <button
                onClick={() => handleAddClick(location)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 rounded transition-colors text-sm"
              >
                {t('add_button')}
              </button>
            </div>
          ))}
        </div>
      )}
      {searchCity && !isSearching && locations.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {t('no_results_found_for', { search_city: searchCity })}
        </p>
      )}
    </div>
  );
}