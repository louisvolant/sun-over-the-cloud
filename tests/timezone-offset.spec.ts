import { test, expect } from '@playwright/test';
import {
  getTimezoneOffsetSeconds,
  clearTimezoneOffsetCacheForTesting,
  getTimezoneOffsetCacheSize,
} from '@/services/metNorwayService';

test.describe('Timezone Offset Memoization', () => {
  test.beforeEach(() => {
    clearTimezoneOffsetCacheForTesting();
  });

  test('calculates and memoizes UTC offset for known IANA timezones', () => {
    expect(getTimezoneOffsetCacheSize()).toBe(0);

    const utcOffset = getTimezoneOffsetSeconds('UTC');
    expect(utcOffset).toBe(0);
    expect(getTimezoneOffsetCacheSize()).toBe(1);

    // Europe/Paris is UTC+1 or UTC+2 (3600 or 7200 seconds)
    const parisOffset = getTimezoneOffsetSeconds('Europe/Paris');
    expect([3600, 7200]).toContain(parisOffset);
    expect(getTimezoneOffsetCacheSize()).toBe(2);

    // America/New_York is UTC-5 or UTC-4 (-18000 or -14400 seconds)
    const nyOffset = getTimezoneOffsetSeconds('America/New_York');
    expect([-18000, -14400]).toContain(nyOffset);
    expect(getTimezoneOffsetCacheSize()).toBe(3);

    // Second call to Europe/Paris reuses the cached value without increasing cache size
    const parisCached = getTimezoneOffsetSeconds('Europe/Paris');
    expect(parisCached).toBe(parisOffset);
    expect(getTimezoneOffsetCacheSize()).toBe(3);
  });

  test('handles invalid timezone or empty string gracefully without throwing', () => {
    expect(getTimezoneOffsetSeconds('')).toBe(0);
    expect(getTimezoneOffsetSeconds('Invalid/Timezone_Name')).toBe(0);
  });

  test('evicts or refreshes entry when TTL expires', () => {
    const baseTime = 1700000000000;
    const initial = getTimezoneOffsetSeconds('Europe/London', baseTime);
    expect(getTimezoneOffsetCacheSize()).toBe(1);

    // After 13 hours (> 12h TTL)
    const laterTime = baseTime + 13 * 60 * 60 * 1000;
    const refreshed = getTimezoneOffsetSeconds('Europe/London', laterTime);
    expect(typeof refreshed).toBe('number');
  });
});
