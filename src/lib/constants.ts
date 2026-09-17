// src/lib/constants.ts

/**
 * Dev comment:
 * sessionStorage key used to hand a selected location over from the dedicated
 * /search page to the home page. The home page consumes it on mount, fetches
 * the weather, persists the last-viewed location and focuses the matching
 * carousel slide.
 */
export const PENDING_SEARCH_SELECTION_KEY = 'sotc:pendingSelectedLocation';
