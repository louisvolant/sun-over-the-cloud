// src/app/api/cached-favorites/route.ts
import { NextResponse } from 'next/server';
import { listPopularFavorites } from '@/lib/data';

const DEFAULT_CACHED_FAVORITES = 3;

interface PopularLocation {
  location_name: string;
  lat: number;
  lon: number;
  country: string;
}

// Popular locations are global, non-critical data that only change when users
// add or remove favorites. Keeping the last successful result for a few minutes
// avoids hitting D1 on every anonymous home load.
const CACHE_TTL_MS = 5 * 60 * 1000;
let lastGood: { data: PopularLocation[]; at: number } | null = null;

export async function GET() {
  if (lastGood && Date.now() - lastGood.at < CACHE_TTL_MS) {
    return NextResponse.json(lastGood.data);
  }

  try {
    const rows = await listPopularFavorites(DEFAULT_CACHED_FAVORITES);

    const formattedFavorites: PopularLocation[] = rows.map((fav) => ({
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
