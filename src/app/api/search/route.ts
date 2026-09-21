// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { LocationSearchModel } from '@/lib/models';
import connectToDatabase from '@/lib/mongoose';
import { withTimeout } from '@/lib/timeout';

const OPEN_METEO_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
// MongoDB cache operations on the search path are best-effort only: if the
// database is slow or unreachable (e.g. on Cloudflare Workers, where the Mongo
// driver cannot open TCP sockets), the route falls back to the live geocoding
// API instead of letting the request hang until the runtime kills it.
const CACHE_TIMEOUT_MS = 1_500;

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  admin1?: string | null;
  population?: number | null;
}

// The upstream geocoder ranks same-prefix places by name rather than by
// importance: for "Boulogne" it lists several tiny villages before the
// 100k-inhabitant Boulogne-Billancourt. Fetch a wider page and re-rank by
// population ourselves so major cities always surface first.
const GEOCODING_RESULT_COUNT = '20';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const lang = searchParams.get('lang') || 'en';

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  // Best-effort cache lookup. connectToDatabase() is internally bounded too,
  // and the whole lookup is raced against CACHE_TIMEOUT_MS so a hanging
  // database can never delay the live geocoding fallback.
  try {
    await withTimeout(connectToDatabase(), CACHE_TIMEOUT_MS);
    const existingData = await withTimeout(
      LocationSearchModel.findOne({ city, lang }),
      CACHE_TIMEOUT_MS,
    );
    if (existingData) {
      return NextResponse.json(existingData.data);
    }
  } catch (dbErr: unknown) {
    // If the DB is unreachable, not configured, or too slow, proceed directly
    // to the live API fetch instead of failing the whole request.
    console.warn('MongoDB cache lookup skipped or failed in /api/search:', errorMessage(dbErr));
  }

  try {
    // Use native fetch instead of axios. Axios relies on the Node.js http stack
    // and can make the API route hang on Cloudflare Workers (the runtime then
    // cancels the request with "Worker's code had hung"). Same root cause
    // already fixed for the Google OAuth callback — all API routes must use
    // fetch for outbound HTTP calls.
    const params = new URLSearchParams({
      name: city,
      count: GEOCODING_RESULT_COUNT,
      language: lang,
      format: 'json',
    });
    const response = await fetch(`${OPEN_METEO_GEOCODING_API}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Geocoding API responded with status ${response.status}`);
    }
    const data = await response.json();

    const rawResults: GeocodingResult[] = data?.results || [];
    // Rank by population (unknown populations last) so large cities such as
    // Boulogne-Billancourt are not buried under tiny same-prefix villages.
    const rankedResults = [...rawResults].sort(
      (a, b) => (b.population || 0) - (a.population || 0),
    );
    const formattedLocations = rankedResults.map((item: GeocodingResult) => ({
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      country: item.country_code,
      state: item.admin1,
      location_name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
    }));

    // Best-effort cache save, also time-bounded so a slow DB never delays the
    // response the client is waiting on.
    try {
      await withTimeout(connectToDatabase(), CACHE_TIMEOUT_MS);
      await withTimeout(
        new LocationSearchModel({
          city,
          lang,
          data: formattedLocations,
        }).save(),
        CACHE_TIMEOUT_MS,
      );
    } catch {
      // Ignore DB save errors/timeouts when the database is unavailable/slow.
    }

    return NextResponse.json(formattedLocations);
  } catch (error: unknown) {
    console.error('Error in /api/search:', errorMessage(error));
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
  }
}