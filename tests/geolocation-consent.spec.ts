import { test, expect } from '@playwright/test';
import {
  isGeolocationConsentValid,
  needsGeolocationConsentRefresh,
  GEOLOCATION_CONSENT_DURATION_DAYS,
  GEOLOCATION_CONSENT_DURATION_MS,
  GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS,
  GeolocationConsent,
} from '@/lib/geolocation';

test.describe('Geolocation consent (30-day sliding window)', () => {
  test('constants are configured for a 30-day sliding window', () => {
    expect(GEOLOCATION_CONSENT_DURATION_DAYS).toBe(30);
    expect(GEOLOCATION_CONSENT_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000);
  });

  test('consent is valid until its expiry and invalid afterwards', () => {
    const now = Date.now();
    const valid: GeolocationConsent = {
      grantedAt: now,
      expiresAt: now + GEOLOCATION_CONSENT_DURATION_MS,
      location: { name: 'Paris', country: 'FR', lat: 48.85, lon: 2.35 },
    };

    expect(isGeolocationConsentValid(valid, now)).toBe(true);
    expect(isGeolocationConsentValid(valid, now + GEOLOCATION_CONSENT_DURATION_MS - 1)).toBe(true);
    expect(isGeolocationConsentValid(valid, now + GEOLOCATION_CONSENT_DURATION_MS + 1)).toBe(false);
    expect(isGeolocationConsentValid(null, now)).toBe(false);
  });

  test('sliding refresh is only needed once the daily threshold has elapsed', () => {
    const now = Date.now();
    const fresh: GeolocationConsent = {
      grantedAt: now,
      expiresAt: now + GEOLOCATION_CONSENT_DURATION_MS,
      location: null,
    };

    expect(needsGeolocationConsentRefresh(fresh, now)).toBe(false);
    expect(
      needsGeolocationConsentRefresh(fresh, now + GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS - 1)
    ).toBe(false);
    expect(
      needsGeolocationConsentRefresh(fresh, now + GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS + 1)
    ).toBe(true);
    expect(needsGeolocationConsentRefresh(null, now)).toBe(true);
  });
});
