// src/lib/geolocation.ts
//
// Dev comment:
// The browser owns the geolocation permission, but installed PWAs (notably on
// iOS) tend to re-prompt on many launches even after the user granted access.
// To avoid asking over and over, we remember a successful authorization
// locally for 30 days and slide the expiry forward on every use, mirroring the
// 30-day sliding session used for authentication. The last resolved position
// is stored alongside it so the app can restore "my location" without
// triggering a fresh browser prompt while the window is still valid.
//
// This is a best-effort UX cache only: it never grants any browser capability
// by itself and is trivially discardable (private mode, cleared storage...).

export const GEOLOCATION_CONSENT_KEY = 'sotc:geolocationConsent';
export const GEOLOCATION_CONSENT_DURATION_DAYS = 30;
export const GEOLOCATION_CONSENT_DURATION_MS = GEOLOCATION_CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface GeolocationLocation {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface GeolocationConsent {
  /** Last time a position was successfully obtained (sliding anchor). */
  grantedAt: number;
  /** grantedAt + 30 days. */
  expiresAt: number;
  /** Last resolved position, reused while the consent is valid. */
  location: GeolocationLocation | null;
}

/**
 * A consent is valid until its (sliding) 30-day expiry.
 */
export function isGeolocationConsentValid(
  consent: GeolocationConsent | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!consent) return false;
  return typeof consent.expiresAt === 'number' && consent.expiresAt > now;
}

/**
 * True when the sliding window has not been refreshed for at least a day.
 * Used to avoid writing localStorage on every single position request.
 */
export function needsGeolocationConsentRefresh(
  consent: GeolocationConsent | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!consent) return true;
  return now - consent.grantedAt >= GEOLOCATION_CONSENT_REFRESH_THRESHOLD_MS;
}

/**
 * Read the stored consent, tolerating absent/corrupted storage.
 */
export function readGeolocationConsent(): GeolocationConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GEOLOCATION_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeolocationConsent;
    if (!parsed || typeof parsed.expiresAt !== 'number' || typeof parsed.grantedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persist (and slide) the consent for another 30 days.
 * Returns the stored record so callers can reuse the resolved position.
 */
export function writeGeolocationConsent(
  location: GeolocationLocation | null,
  now: number = Date.now(),
): GeolocationConsent {
  const consent: GeolocationConsent = {
    grantedAt: now,
    expiresAt: now + GEOLOCATION_CONSENT_DURATION_MS,
    location: location ?? null,
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GEOLOCATION_CONSENT_KEY, JSON.stringify(consent));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }
  return consent;
}

/**
 * Drop the stored consent (e.g. if the user explicitly denies geolocation).
 */
export function clearGeolocationConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GEOLOCATION_CONSENT_KEY);
  } catch {
    // Ignore storage errors.
  }
}
