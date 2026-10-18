// src/lib/constants.ts

/**
 * Dev comment:
 * sessionStorage key used to hand a selected location over from the dedicated
 * /search page to the home page. The home page consumes it on mount, fetches
 * the weather, persists the last-viewed location and focuses the matching
 * carousel slide.
 */
export const PENDING_SEARCH_SELECTION_KEY = 'sotc:pendingSelectedLocation';

/**
 * sessionStorage key used to hand a selected favorite location over from the
 * mobile /favorites vertical list page to the home page carousel.
 */
export const PENDING_FAVORITE_SELECTION_KEY = 'sotc:pendingSelectedFavorite';

/**
 * Custom browser event dispatched whenever the local favorites cache is updated
 * so components such as MobileFooterNav can react immediately.
 */
export const FAVORITES_UPDATED_EVENT = 'sotc:favoritesUpdated';
