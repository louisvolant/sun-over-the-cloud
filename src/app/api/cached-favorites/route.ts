// src/app/api/cached-favorites/route.ts
import { NextResponse } from 'next/server';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase, { withDbRetry } from '@/lib/mongoose';

const DEFAULT_CACHED_FAVORITES = 3;

export async function GET() {
  try {
    await withDbRetry(() => connectToDatabase());

    const cachedFavoritesPipeline = [
      {
        $group: {
          _id: {
            location_name: '$location_name',
            latitude: '$latitude',
            longitude: '$longitude',
            country_code: '$country_code',
          },
          minOrder: { $min: '$order' },
        },
      },
      {
        $project: {
          _id: 0,
          location_name: '$_id.location_name',
          latitude: '$_id.latitude',
          longitude: '$_id.longitude',
          country_code: '$_id.country_code',
          order: '$minOrder',
        },
      },
      {
        $sort: { order: 1 as const },
      },
      {
        $limit: DEFAULT_CACHED_FAVORITES,
      },
    ];

    const topCachedFavorites = await withDbRetry(() => UserFavoritesModel.aggregate(cachedFavoritesPipeline));

    if (!topCachedFavorites || topCachedFavorites.length === 0) {
      return NextResponse.json([]);
    }

    const formattedFavorites = topCachedFavorites.map((fav: any) => ({
      location_name: fav.location_name,
      lat: fav.latitude,
      lon: fav.longitude,
      country: fav.country_code,
    }));

    return NextResponse.json(formattedFavorites);
  } catch (err: any) {
    console.warn('Error fetching cached favorites (returning empty list):', err.message || err);
    return NextResponse.json([]);
  }
}
