// src/app/components/LocationCarousel.tsx
'use client';

import { useEffect, useRef, useState, useImperativeHandle } from 'react';
import useLocationWeather from '@/hooks/useLocationWeather';
import LocationWeatherContent from './LocationWeatherContent';
import { useLanguage } from '@/context/LanguageContext';
import { Star } from 'lucide-react';

export interface CarouselLocation {
  /** Stable React key for the slide (favorite id or coord-based key). */
  key: string;
  name: string;
  countryCode?: string;
  lat: number;
  lon: number;
  /** Present when this slide corresponds to a saved favorite (enables removal). */
  favoriteId?: string;
}

export interface LocationCarouselHandle {
  /** Programmatically bring a slide into view (e.g. after a search selection). */
  scrollToIndex: (index: number) => void;
}

interface LocationCarouselProps {
  locations: CarouselLocation[];
  ref?: React.Ref<LocationCarouselHandle>;
  /**
   * Called when the user confirms removing the favorite rendered on a slide.
   * The parent owns the confirmation dialog and the backend/local removal.
   */
  onRemoveFavorite?: (favoriteId: string) => void;
}

/**
 * Dev comment:
 * Mobile-only horizontal carousel showing one full-height weather view per
 * location. Swiping left/right switches between the user's saved locations;
 * each slide scrolls vertically inside the carousel.
 *
 * Implementation notes:
 *  - Native CSS scroll-snap (`snap-x snap-mandatory`) is used instead of a
 *    swipe library: no dependency, momentum scrolling handled by the OS.
 *  - The active slide index is derived from `scrollLeft / clientWidth` on
 *    scroll so the page dots stay in sync while swiping.
 *  - Each slide owns its data through the shared `useLocationWeather` hook,
 *    exactly like the expanded favorite card view (LocationWeatherContent),
 *    so the slide content is identical to the existing weather boxes.
 *  - Each slide shows a header row (location name + favorite star at the
 *    top-right when the slide maps to a saved favorite). Tapping the star asks
 *    for confirmation (handled by the parent) and removes the location from
 *    the favorites, e.g. the same action as the desktop trash button.
 *  - Vertical scrolling inside a slide and horizontal swiping between slides
 *    are handled natively by the nested scrollers (browser directional
 *    locking); no touch-action override is required since the global
 *    `touch-action` rules already allow pan-x/pan-y.
 */
export default function LocationCarousel({ locations, ref, onRemoveFavorite }: LocationCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { t } = useLanguage();

  // Expose an imperative handle so the parent can focus a slide (e.g. when a
  // location is picked from the mobile search panel).
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(index, locations.length - 1));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    },
  }), [locations.length]);

  // Reset the active index if the slide list shrinks (e.g. favorite removed)
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(0, locations.length - 1)));
  }, [locations.length]);

  // Keep the active index in sync while the user swipes between slides.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== activeIndex && index >= 0 && index < locations.length) {
      setActiveIndex(index);
    }
  };

  const jumpTo = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setActiveIndex(index);
  };

  return (
    <div className="flex flex-col h-full" aria-label={t('location_carousel_label')}>
      {/* Horizontal swipeable track */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-none"
      >
        {locations.map((location) => (
          <CarouselSlide
            key={location.key}
            location={location}
            onRemoveFavorite={onRemoveFavorite}
          />
        ))}
      </div>

      {/* Page indicator dots — double as quick-jump buttons */}
      {locations.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2 shrink-0">
          {locations.map((location, index) => (
            <button
              key={location.key}
              type="button"
              onClick={() => jumpTo(index)}
              aria-label={location.name}
              aria-current={activeIndex === index}
              className={`rounded-full transition-all duration-200 ${
                activeIndex === index
                  ? 'w-2.5 h-2.5 bg-blue-500'
                  : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dev comment:
 * A single swipeable slide. It renders the same expanded weather view used by
 * favorite cards (LocationWeatherContent) with data owned by the shared
 * useLocationWeather hook. Mounting all slides at once intentionally matches
 * the previous favorites-list behavior, where every card fetched its weather
 * on mount (IndexedDB first, then a background refresh).
 *
 * Layout: a non-scrolling header row (location name + favorite star on the
 * top-right) sits above the vertically scrollable weather content, so the
 * removal action stays reachable regardless of where the user scrolled.
 */
function CarouselSlide({
  location,
  onRemoveFavorite,
}: {
  location: CarouselLocation;
  onRemoveFavorite?: (favoriteId: string) => void;
}) {
  const weatherState = useLocationWeather({
    latitude: location.lat,
    longitude: location.lon,
    locationName: location.name,
    countryCode: location.countryCode,
  });
  const { t } = useLanguage();
  const removeTitle = t('remove_favorite_title');

  return (
    // w-full + shrink-0: each slide exactly fills the carousel viewport;
    // snap-center: magnetic alignment after a swipe.
    <div className="w-full h-full shrink-0 snap-center flex flex-col px-3 pt-3 pb-6">
      {/* Slide header: location name + yellow favorite star (remove action) */}
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <h2 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate min-w-0">
          {location.name}
        </h2>
        {location.favoriteId && onRemoveFavorite && (
          <button
            type="button"
            onClick={() => onRemoveFavorite(location.favoriteId!)}
            className="p-2 -mr-1 -mt-1 shrink-0 rounded-full text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
            title={removeTitle}
            aria-label={removeTitle}
          >
            <Star className="w-5 h-5 fill-amber-400" />
          </button>
        )}
      </div>

      {/* Vertically scrollable weather content (current, forecast, graphs) */}
      <div className="flex-1 overflow-y-auto">
        <LocationWeatherContent {...weatherState} />
      </div>
    </div>
  );
}