// src/app/components/AccountFavoritesListComponent.tsx
import React from 'react';
import { FavoriteLocation } from '@/lib/types';
import { useLanguage } from '@/context/LanguageContext';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface AccountFavoritesListComponentProps {
  favorites: FavoriteLocation[];
  onRemoveFavorite: (id: string) => void;
  onReorderFavorite: (id: string, direction: 'up' | 'down') => void;
}

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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{t('location_name_table_header')}</th>
                <th className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{t('latitude_table_header')}</th>
                <th className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{t('longitude_table_header')}</th>
                <th className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{t('actions_table_header')}</th>
                <th className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{t('order_table_header')}</th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((fav, index) => (
                <tr
                  key={fav._id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                    {fav.country_code && (
                      <span className={`fi fi-${fav.country_code.toLowerCase()} mr-2 rounded`}></span>
                    )}
                    {fav.location_name}
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{fav.latitude.toFixed(4)}</td>
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{fav.longitude.toFixed(4)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onRemoveFavorite(fav._id)}
                      className="bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded transition-colors"
                    >
                      {t('remove_button')}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onReorderFavorite(fav._id, 'up')}
                        disabled={index === 0}
                        className={`p-1 rounded ${index === 0 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-blue-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-gray-700'}`}
                        title={t('move_up')}
                      >
                        <ChevronUp size={20} />
                      </button>
                      <button
                        onClick={() => onReorderFavorite(fav._id, 'down')}
                        disabled={index === favorites.length - 1}
                        className={`p-1 rounded ${index === favorites.length - 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'text-blue-500 hover:bg-gray-200 dark:text-blue-400 dark:hover:bg-gray-700'}`}
                        title={t('move_down')}
                      >
                        <ChevronDown size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}