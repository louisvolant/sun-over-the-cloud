// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGeocodeCache, setGeocodeCache } from '@/lib/cache';

const OPEN_METEO_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  admin1?: string | null;
  population?: number | null;
}

interface FormattedLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string | null;
  location_name: string;
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

  // Best-effort cache lookup. KV reads are fast and cannot hang the request.
  try {
    const cached = await getGeocodeCache<FormattedLocation[]>(lang, city);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch (cacheErr: unknown) {
    console.warn('Geocode cache lookup failed in /api/search:', errorMessage(cacheErr));
  }

  try {
    // Use native fetch instead of axios. Axios relies on the Node.js http stack
    // and can make the API route hang on Cloudflare Workers.
    const params = new URLSearchParams({
      name: city,
      count: GEOCODING_RESULT_COUNT,
      language: lang,
      format: 'json',
    });
    const response = await fetch(`${OPEN_METEO_GEOCODING_API}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
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
    const formattedLocations: FormattedLocation[] = rankedResults.map((item: GeocodingResult) => ({
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      country: item.country_code,
      state: item.admin1,
      location_name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
    }));

    // Best-effort cache save; a KV hiccup must never delay the response.
    try {
      await setGeocodeCache(lang, city, formattedLocations);
    } catch {
      // Ignore cache save errors.
    }

    return NextResponse.json(formattedLocations);
  } catch (error: unknown) {
    console.error('Error in /api/search:', errorMessage(error));
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
  }
}
