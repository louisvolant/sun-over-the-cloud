// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGeocodeCache, setGeocodeCache } from '@/lib/cache';
import {
  buildSearchQueryVariants,
  mergeLocationResults,
  normalizeSearchQuery,
  sortSearchResults,
} from '@/lib/searchQuery';

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

/**
 * An upstream result projected onto the payload shape, plus the population
 * needed to rank it. `population` is stripped before the response is sent.
 */
type GeocodingCandidate = FormattedLocation & { population?: number | null };

// The upstream geocoder ranks same-prefix places by name rather than by
// importance: for "Boulogne" it lists several tiny villages before the
// 100k-inhabitant Boulogne-Billancourt. Fetch a wider page and re-rank by
// population ourselves so major cities always surface first.
const GEOCODING_RESULT_COUNT = '20';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Fetches one geocoder query and returns its raw results, or an empty list if
 * that variant failed. Variants are independent, so a single failing spelling
 * (a 4xx from the upstream, a timeout) must not hide the results of the others.
 */
async function fetchGeocodingResults(query: string, lang: string): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    name: query,
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
  return data?.results || [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const lang = searchParams.get('lang') || 'en';

  if (!city) {
    return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
  }

  // The geocoder indexes compound names with hyphens ("Saint-Maurice-de-Lignon")
  // but some places are indexed with spaces, and users type both — so the query
  // is expanded into a couple of separator variants that are queried in parallel
  // and merged. A single-word query produces a single variant, so the common case
  // still costs exactly one upstream call.
  const queryVariants = buildSearchQueryVariants(city);
  // Cache key shared by all separator variants of the same place name.
  const cacheKey = normalizeSearchQuery(city);

  // Best-effort cache lookup. KV reads are fast and cannot hang the request.
  try {
    const cached = await getGeocodeCache<FormattedLocation[]>(lang, cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch (cacheErr: unknown) {
    console.warn('Geocode cache lookup failed in /api/search:', errorMessage(cacheErr));
  }

  try {
    // Use native fetch instead of axios. Axios relies on the Node.js http stack
    // and can make the API route hang on Cloudflare Workers.
    const perVariantResults = await Promise.all(
      queryVariants.map((query) =>
        fetchGeocodingResults(query, lang).catch((err: unknown) => {
          console.warn(`Geocoding variant "${query}" failed:`, errorMessage(err));
          return [] as GeocodingResult[];
        }),
      ),
    );

    // Project the upstream shape onto ours, so deduplication and ranking can
    // work on the same object as the response payload.
    const toCandidate = (item: GeocodingResult): GeocodingCandidate => ({
      name: item.name,
      lat: item.latitude,
      lon: item.longitude,
      country: item.country_code,
      state: item.admin1,
      location_name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
      population: item.population,
    });

    // Rank exact name matches first, then by population (unknown populations
    // last) so large cities such as Boulogne-Billancourt are not buried under
    // tiny same-prefix villages.
    const rankedResults = sortSearchResults(
      mergeLocationResults(perVariantResults.map((results) => results.map(toCandidate))),
      queryVariants,
    );
    // `population` is ranking metadata only: it never reaches the client.
    const formattedLocations: FormattedLocation[] = rankedResults.map((item: GeocodingCandidate) => ({
      name: item.name,
      lat: item.lat,
      lon: item.lon,
      country: item.country,
      state: item.state,
      location_name: item.location_name,
    }));

    // Best-effort cache save; a KV hiccup must never delay the response.
    try {
      await setGeocodeCache(lang, cacheKey, formattedLocations);
    } catch {
      // Ignore cache save errors.
    }

    return NextResponse.json(formattedLocations);
  } catch (error: unknown) {
    console.error('Error in /api/search:', errorMessage(error));
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
  }
}
