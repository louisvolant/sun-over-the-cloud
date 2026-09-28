import { test, expect } from '@playwright/test';
import {
  buildSearchQueryVariants,
  getLocationKey,
  mergeLocationResults,
  normalizeSearchQuery,
  sortSearchResults,
} from '@/lib/searchQuery';

test.describe('Search query normalization', () => {
  test('builds a hyphenated variant for a spaced place name', () => {
    // The upstream geocoder only knows "Saint-Maurice-de-Lignon", so a query
    // typed with spaces must also be tried with hyphens.
    expect(buildSearchQueryVariants('Saint Maurice de Lignon')).toEqual([
      'Saint Maurice de Lignon',
      'Saint-Maurice-de-Lignon',
    ]);
  });

  test('builds a spaced variant for a hyphenated place name', () => {
    expect(buildSearchQueryVariants('Saint-Maurice-de-Lignon')).toEqual([
      'Saint-Maurice-de-Lignon',
      'Saint Maurice de Lignon',
    ]);
  });

  test('normalizes mixed separators and casing into a single hyphenated variant', () => {
    const variants = buildSearchQueryVariants('SAint-Maurice de  Lignon');
    expect(variants).toContain('SAint-Maurice-de-Lignon');
    expect(variants).toContain('SAint Maurice de Lignon');
    // No duplicate of the same spelling.
    expect(new Set(variants).size).toBe(variants.length);
  });

  test('keeps a single-word query to a single variant', () => {
    // "Paris" must not trigger extra upstream calls.
    expect(buildSearchQueryVariants('Paris')).toEqual(['Paris']);
    expect(buildSearchQueryVariants('  Nice  ')).toEqual(['Nice']);
  });

  test('returns no variant for a blank query', () => {
    expect(buildSearchQueryVariants('')).toEqual([]);
    expect(buildSearchQueryVariants('   ')).toEqual([]);
  });

  test('normalizes a query to a single shared cache key', () => {
    expect(normalizeSearchQuery('Saint-Maurice-de-Lignon')).toBe('saint maurice de lignon');
    expect(normalizeSearchQuery('  SAint Maurice   de Lignon ')).toBe('saint maurice de lignon');
    // The geocoder ignores accents, so the cache key does too.
    expect(normalizeSearchQuery('Saint-Étienne')).toBe(normalizeSearchQuery('Saint Etienne'));
  });

  test('identifies a result by its rounded coordinates', () => {
    expect(getLocationKey({ lat: 45.2243, lon: 4.1388 })).toBe(getLocationKey({ lat: 45.2243, lon: 4.1388 }));
    expect(getLocationKey({ lat: 45.2243, lon: 4.1388 })).not.toBe(getLocationKey({ lat: 48.8566, lon: 2.3522 }));
  });
});

test.describe('Search result merging and ranking', () => {
  const lignon = { name: 'Saint-Maurice-de-Lignon', lat: 45.2243, lon: 4.1388, population: 1896 };
  const beynost = { name: 'Saint-Maurice-de-Beynost', lat: 45.834, lon: 4.976, population: 4000 };
  // Prefix match returned by the geocoder for a "Saint-Maurice-de-Lignon"
  // query: a much bigger city, but not the place the user asked for.
  const biggerPrefix = { name: 'Saint-Maurice', lat: 48.84, lon: 2.35, population: 68000 };

  test('merges the variants of a query and drops their duplicates', () => {
    const merged = mergeLocationResults([
      [], // The spaced variant of "Saint-Maurice-de-Lignon" returns nothing
      [lignon, beynost],
      [lignon], // Same place indexed twice by two variants
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe('Saint-Maurice-de-Lignon');
    expect(merged[1].name).toBe('Saint-Maurice-de-Beynost');
  });

  test('ranks an exact name match above a bigger prefix match', () => {
    // Merging the variants surfaces "Saint-Maurice" (68k inhabitants) for a
    // "Saint-Maurice-de-Lignon" query: a pure population ranking would show it
    // first, the name match must keep the intended place on top.
    const ranked = sortSearchResults([biggerPrefix, lignon], buildSearchQueryVariants('Saint-Maurice-de-Lignon'));

    expect(ranked.map((item) => item.name)).toEqual([
      'Saint-Maurice-de-Lignon',
      'Saint-Maurice',
    ]);
  });

  test('treats an accented place name as an exact match of a plain query', () => {
    // The geocoder is accent-insensitive, so "Saint Etienne" must boost
    // "Saint-Étienne" above the "Saint-Étienne-en-Dévoluy" prefix results.
    const plainQuery = buildSearchQueryVariants('Saint Etienne');
    const ranked = sortSearchResults(
      [
        { name: 'Saint-Étienne-en-Dévoluy', lat: 44.65, lon: 5.85, population: 537 },
        { name: 'Saint-Étienne', lat: 45.44, lon: 4.39, population: 176280 },
      ],
      plainQuery,
    );

    expect(ranked.map((item) => item.name)).toEqual([
      'Saint-Étienne',
      'Saint-Étienne-en-Dévoluy',
    ]);
  });

  test('falls back to population ranking when no name matches exactly', () => {
    const ranked = sortSearchResults([lignon, beynost], buildSearchQueryVariants('Saint Maurice'));

    expect(ranked.map((item) => item.name)).toEqual([
      'Saint-Maurice-de-Beynost',
      'Saint-Maurice-de-Lignon',
    ]);
  });

  test('ignores the population of places the geocoder did not size', () => {
    const unsized = { name: 'Saint-Maurice-de-Lignon', lat: 45.2243, lon: 4.1388, population: null };
    const ranked = sortSearchResults([unsized, beynost], buildSearchQueryVariants('Saint Maurice'));

    expect(ranked.map((item) => item.name)).toEqual([
      'Saint-Maurice-de-Beynost',
      'Saint-Maurice-de-Lignon',
    ]);
  });

  test('does not mutate the input array', () => {
    const locations = [biggerPrefix, lignon];
    sortSearchResults(locations, buildSearchQueryVariants('Saint-Maurice-de-Lignon'));
    expect(locations[0].name).toBe('Saint-Maurice');
  });
});
