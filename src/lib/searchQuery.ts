// src/lib/searchQuery.ts
//
// Query helpers shared by the `/api/search` route and its tests.
//
// The upstream geocoder (Open-Meteo) matches a single exact spelling of a
// place name: "Saint-Maurice-de-Lignon" is found, but "Saint Maurice de
// Lignon" or the mixed "SAint-Maurice de Lignon" return nothing at all. Users
// however type whatever their keyboard and memory produce, so the route asks
// the geocoder for a few separator variants of the same query and merges the
// answers. Everything here is pure so the behaviour is unit-testable without
// any network access.

/** Anything that can separate two words of a place name. */
const SEPARATOR_PATTERN = /[\s\-_/]+/g;

/** Combining diacritical marks, stripped after a Unicode NFD decomposition. */
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;

/** Coordinate precision (in degrees) used to detect duplicate results. */
const COORDINATE_PRECISION = 4;

/**
 * The geocoder is accent-insensitive ("Beziers" finds "Béziers"), so names are
 * folded to their ASCII form before being compared, exactly as the upstream
 * treats them.
 */
function foldDiacritics(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS_PATTERN, '');
}

/**
 * Normalizes a user query for cache lookups: lowercase, accent-free, with every
 * run of separators collapsed to a single space. "Saint-Maurice de Lignon",
 * "saint maurice   de  lignon" and "Saint Maurice-de-Lignon" therefore share a
 * single KV entry instead of each paying for its own upstream call.
 */
export function normalizeSearchQuery(query: string): string {
  return foldDiacritics(query)
    .trim()
    .toLowerCase()
    .replace(SEPARATOR_PATTERN, ' ')
    .trim();
}

/**
 * Builds the list of geocoder queries to try for a given user input, in
 * priority order:
 *   1. the input as typed (whitespace runs collapsed), so an already correct
 *      spelling is never "fixed" and the cache stays warm;
 *   2. the same words joined by hyphens ("Saint Maurice de Lignon" ->
 *      "Saint-Maurice-de-Lignon"), which is how compound names are indexed;
 *   3. the same words joined by spaces ("Saint-Maurice-de-Lignon" ->
 *      "Saint-Maurice de Lignon"), for the places that are actually spelled
 *      with spaces.
 *
 * Duplicates are removed, so a single-word query such as "Paris" yields a
 * single upstream call and costs nothing extra. Returns an empty array for a
 * blank query.
 */
export function buildSearchQueryVariants(query: string): string[] {
  const collapsed = query.trim().replace(/\s+/g, ' ');
  if (collapsed === '') {
    return [];
  }

  const words = collapsed.split(SEPARATOR_PATTERN).filter(Boolean);
  const candidates = [collapsed, words.join('-'), words.join(' ')];

  return candidates.filter((candidate, index) => candidate !== '' && candidates.indexOf(candidate) === index);
}

/** Stable identity of a result, used to drop duplicates coming from variants. */
export function getLocationKey(location: { lat: number; lon: number }): string {
  return `${location.lat.toFixed(COORDINATE_PRECISION)},${location.lon.toFixed(COORDINATE_PRECISION)}`;
}

/**
 * Merges the results of several geocoder variants into a single list,
 * dropping the duplicates that variants inevitably share (the same place is
 * often indexed both with and without hyphens) and keeping the first
 * occurrence, i.e. the one coming from the highest priority variant.
 */
export function mergeLocationResults<T extends { lat: number; lon: number }>(variantResults: T[][]): T[] {
  const merged: T[] = [];
  const seenKeys = new Set<string>();

  for (const results of variantResults) {
    for (const location of results) {
      const key = getLocationKey(location);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push(location);
    }
  }

  return merged;
}

/**
 * Orders results so that an exact name match comes first, then by population.
 * The name boost matters once variants are merged: searching "Saint-Maurice"
 * also returns the space-spelled "Saint Maurice" (Canada), which a pure
 * population ranking could place above the intended French city. Names are
 * compared with `normalizeSearchQuery`, so separators, case and accents are
 * ignored on both sides.
 */
export function sortSearchResults<T extends { name: string; population?: number | null }>(
  locations: T[],
  queryVariants: string[],
): T[] {
  const exactNames = new Set(queryVariants.map(normalizeSearchQuery));

  return [...locations].sort((a, b) => {
    const aIsExact = exactNames.has(normalizeSearchQuery(a.name)) ? 1 : 0;
    const bIsExact = exactNames.has(normalizeSearchQuery(b.name)) ? 1 : 0;
    if (aIsExact !== bIsExact) return bIsExact - aIsExact;
    return (b.population || 0) - (a.population || 0);
  });
}
