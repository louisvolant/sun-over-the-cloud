// src/app/account/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { checkAuth } from '@/lib/login_api';
import { getFavorites, addFavorite, removeFavorite, deleteAccount, updateFavoriteOrder } from '@/lib/account_api'; // Import updateFavoriteOrder
import { FavoriteLocation, Location } from '@/lib/types';
import { useRouter } from 'next/navigation';
import AccountFavoritesListComponent from '@/app/components/AccountFavoritesListComponent';
import AccountFavoritesAddComponent from '@/app/components/AccountFavoritesAddComponent';
import AccountActionsComponent from '@/app/components/AccountActionsComponent';
import { useLanguage } from '@/context/LanguageContext';

export default function Account() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const checkAuthentication = async () => {
      const authStatus = await checkAuth();
      if (!authStatus.isAuthenticated) {
        router.push('/');
      } else {
        setIsAuthenticated(true);
      }
    };
    checkAuthentication();
  }, [router]);

  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getFavorites();
      // Ensure data is sorted by a specific order if it's stored in the backend
      // For now, we'll assume the backend provides it in the desired order
      // or we'll establish an order here.
      setFavorites(data); // Set the favorites directly
    } catch (err) {
      console.error(t('error_fetching_favorites'), err);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFavorites();
    }
  }, [refreshTrigger, isAuthenticated, fetchFavorites]);

  const handleAddFavorite = async (location: Location) => {
    try {
      await addFavorite({
        location_name: location.name,
        latitude: location.lat,
        longitude: location.lon,
        country_code: location.country,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Error adding favorite:', error);
      alert(t('failed_to_add_favorite', { error_message: error instanceof Error ? error.message : t('unexpected_error') }));
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      await removeFavorite(id);
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error('Error removing favorite:', error);
      alert(t('failed_to_remove_favorite'));
    }
  };

  const handleReorderFavorite = async (id: string, direction: 'up' | 'down') => {
    const newFavorites = [...favorites];
    const index = newFavorites.findIndex((fav) => fav._id === id);

    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [newFavorites[index - 1], newFavorites[index]] = [newFavorites[index], newFavorites[index - 1]];
    } else if (direction === 'down' && index < newFavorites.length - 1) {
      [newFavorites[index + 1], newFavorites[index]] = [newFavorites[index], newFavorites[index + 1]];
    } else {
      return; // No change needed
    }

    setFavorites(newFavorites); // Optimistically update UI

    try {
      // Send the entire reordered list of IDs to the backend
      const favoriteIdsInOrder = newFavorites.map(fav => fav._id);
      await updateFavoriteOrder(favoriteIdsInOrder);
      // If the backend returns the updated list, you can set it here
      // setFavorites(backendUpdatedFavorites);
    } catch (error) {
      console.error('Error reordering favorite:', error);
      alert(t('failed_to_reorder_favorite'));
      // If an error occurs, revert to the previous state or refetch
      fetchFavorites();
    }
  };


  const handleDeleteAccount = async () => {
    if (!confirm(t('confirm_delete_account'))) {
      return;
    }
    try {
      await deleteAccount();
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(t('failed_to_delete_account'));
    }
  };

  if (!isAuthenticated)
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-xl">{t('loading_account')}</p>
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('my_account_title')}</h1>
      </div>

      <AccountFavoritesListComponent
        favorites={favorites}
        onRemoveFavorite={handleRemoveFavorite}
        onReorderFavorite={handleReorderFavorite} // Pass the new handler
      />

      <AccountFavoritesAddComponent
        onAddFavorite={handleAddFavorite}
      />

      <AccountActionsComponent
        onDeleteAccount={handleDeleteAccount}
      />
    </div>
  );
}