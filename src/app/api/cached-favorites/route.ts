// src/app/api/cached-favorites/route.ts
import { NextResponse } from 'next/server';
import { UserFavoritesModel } from '@/lib/models';
import connectToDatabase, { withDbRetry } from '@/lib/mongoose';

const DEFAULT_CACHED_FAVORITES = 3;

interface PopularLocation {
  location_name: string;
  lat: number;
  lon: number;
  country: string;
}

// Popular locations are global, non-critical data that only change when users
// add or remove favorites. Keeping the last successful result for a few minutes
// avoids hitting MongoDB on every anonymous home load — each hit can otherwise
// time out on workerd's MongoDB sockets, spamming the logs with bounded timeouts.
const CACHE_TTL_MS = 5 * 60 * 1000;
let lastGood: { data: PopularLocation[]; at: number } | null = null;

export async function GET() {
  if (lastGood && Date.now() - lastGood.at < CACHE_TTL_MS) {
    return NextResponse.json(lastGood.data);
  }

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

    const formattedFavorites: PopularLocation[] = (topCachedFavorites ?? []).map((fav: any) => ({
      location_name: fav.location_name,
      lat: fav.latitude,
      lon: fav.longitude,
      country: fav.country_code,
    }));

    lastGood = { data: formattedFavorites, at: Date.now() };
    return NextResponse.json(formattedFavorites);
  } catch (err: any) {
    console.warn('Error fetching cached favorites (serving last known list):', err?.message || err);
    // Never drop the home page's popular locations when a previous call
    // succeeded recently; fall back to an empty list otherwise.
    return NextResponse.json(lastGood?.data ?? []);
  }
}
