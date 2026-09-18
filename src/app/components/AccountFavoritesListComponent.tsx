// src/app/components/AccountFavoritesListComponent.tsx
import React from 'react';
import { FavoriteLocation } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

interface AccountFavoritesListComponentProps {
  favorites: FavoriteLocation[];
  onRemoveFavorite: (id: string) => void;
  onReorderFavorite: (id: string, direction: 'up' | 'down') => void;
}

/**
 * Dev comment:
 * Simple favorites management list, one location per line (no weather here).
 * Each row shows the flag + location name and the reorder/remove actions, so
 * the page stays a management view and never tries to render forecasts.
 */
export default function AccountFavoritesListComponent({
  favorites,
  onRemoveFavorite,
  onReorderFavorite,
}: AccountFavoritesListComponentProps) {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4">{t('my_favorite_locations_title')}</h2>
      {favorites.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 italic text-center">{t('no_favorites_yet')}</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {favorites.map((fav, index) => (
            <li key={fav._id} className="flex items-center gap-3 py-3">
              {/* Flag + location name */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {fav.country_code && (
                  <span className={`fi fi-${fav.country_code.toLowerCase()} rounded shrink-0`}></span>
                )}
                <span className="text-gray-900 dark:text-gray-100 font-medium truncate">
                  {fav.location_name}
                </span>
              </div>

              {/* Reorder + remove actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onReorderFavorite(fav._id, 'up')}
                  disabled={index === 0}
                  className={`p-1.5 rounded ${
                    index === 0
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'text-blue-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-gray-700'
                  }`}
                  title={t('move_up')}
                  aria-label={t('move_up')}
                >
                  <ChevronUp size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => onReorderFavorite(fav._id, 'down')}
                  disabled={index === favorites.length - 1}
                  className={`p-1.5 rounded ${
                    index === favorites.length - 1
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'text-blue-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-gray-700'
                  }`}
                  title={t('move_down')}
                  aria-label={t('move_down')}
                >
                  <ChevronDown size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFavorite(fav._id)}
                  className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-1"
                  title={t('remove_button')}
                  aria-label={t('remove_button')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}