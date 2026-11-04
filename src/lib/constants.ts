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

/**
 * Edge CDN and browser Cache-Control directives for public weather and search endpoints.
 * These headers instruct Cloudflare CDN edge to cache responses, dropping Worker CPU
 * consumption to 0 ms for cached hits.
 */
export const ONECALL_CACHE_CONTROL = 'public, max-age=120, s-maxage=600, stale-while-revalidate=300';
export const FORECAST_CACHE_CONTROL = 'public, max-age=300, s-maxage=1800, stale-while-revalidate=600';
export const SEARCH_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
export const MONTH_SUMMARY_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';

