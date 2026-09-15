// src/lib/account_api.ts
import axios from 'axios';
import { FavoriteLocation } from '@/lib/types';

const api = axios.create({
  baseURL: '',
  withCredentials: true
});

export async function getFavorites(): Promise<FavoriteLocation[]> {
  const response = await api.get('/api/favorites', { withCredentials: true });
  return response.data;
}

interface AddFavoritePayload {
  location_name: string;
  latitude: number;
  longitude: number;
  country_code: string;
}

export const addFavorite = async (favoriteData: AddFavoritePayload) => {
  const response = await api.post('/api/add-favorite', favoriteData, { withCredentials: true });
  return response.data;
}

export const removeFavorite = async (id: string) => {
  const response = await api.post('/api/remove-favorite', { id }, { withCredentials: true });
  return response.data;
}

export const updateFavoriteOrder = async (orderedFavoriteIds: string[]) => {
  const response = await api.post('/api/reorder-favorites', { orderedFavoriteIds }, { withCredentials: true });
  return response.data;
}

export const deleteAccount = async () => {
  const response = await api.post('/api/delete_my_account', {}, { withCredentials: true });
  return response.data;
}