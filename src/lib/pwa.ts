// src/lib/pwa.ts

/**
 * Determines whether the application is running in Progressive Web App (PWA) mode.
 * Evaluates standard display-mode media queries (standalone, fullscreen, minimal-ui),
 * iOS Safari standalone property, Android Trusted Web Activity (TWA) referrer,
 * session storage persistence, and URL query parameters.
 */
export function isPwaMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Standard CSS display-mode media queries
  const isStandaloneMedia =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches;

  // 2. iOS Safari standalone mode (Add to Home Screen)
  const isIosStandalone =
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);

  // 3. Android Trusted Web Activity (TWA) referrer
  const isAndroidApp =
    typeof document !== 'undefined' &&
    Boolean(document.referrer?.includes('android-app://'));

  // 4. Query parameter indicators (useful for testing or manifest start_url)
  let isQueryPwa = false;
  try {
    const params = new URLSearchParams(window.location.search);
    isQueryPwa =
      params.get('mode') === 'pwa' ||
      params.get('source') === 'pwa' ||
      params.get('pwa') === 'true' ||
      params.get('pwa') === '1';
  } catch {
    isQueryPwa = false;
  }

  // 5. Session storage persistence so internal navigation retains PWA state
  let isSessionPwa = false;
  try {
    isSessionPwa = sessionStorage.getItem('is_pwa_mode') === 'true';
  } catch {
    isSessionPwa = false;
  }

  const active = Boolean(
    isStandaloneMedia || isIosStandalone || isAndroidApp || isQueryPwa || isSessionPwa
  );

  // Cache detection in session storage once confirmed
  if (active) {
    try {
      sessionStorage.setItem('is_pwa_mode', 'true');
    } catch {
      // Ignore storage errors (e.g. private browsing restrictions)
    }
  }

  return active;
}
