// src/app/components/MobileFooterNav.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, Search, Settings } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getLocalFavorites, saveLocalFavorites } from '@/lib/localWeatherDb';
import { getFavorites } from '@/lib/account_api';
import { FAVORITES_UPDATED_EVENT } from '@/lib/constants';
import { FavoriteLocation } from '@/lib/types';
import { debugLog } from '@/lib/logger';

/**
 * Dev comment:
 * Mobile-only sticky footer navigation, rendered at the bottom of the viewport
 * on every page (hidden on desktop via `md:hidden`).
 *
 * It exposes:
 *  - Home: navigates back to the weather home page.
 *  - Favorites (List icon): shown only when authenticated and the user has more
 *    than 2 favorite locations (`favoritesCount > 2`), opening the dedicated
 *    vertical `/favorites` list so the user can jump directly to any favorite
 *    on the Home carousel without swiping through dozens of slides.
 *  - Search: navigates to the dedicated /search page (full-page search with
 *    favorite actions, much easier to use than an overlay panel on mobile).
 *  - My Account: navigates to the account management page.
 *
 * The bar is fixed (always visible, app-like) and respects the iOS safe area
 * via the existing `pb-safe-bottom` utility defined in globals.css.
 */
export default function MobileFooterNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [favoritesCount, setFavoritesCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setFavoritesCount(0);
      return;
    }

    let isMounted = true;

    const handleFavoritesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<FavoriteLocation[]>;
      if (Array.isArray(customEvent.detail)) {
        setFavoritesCount(customEvent.detail.length);
      }
    };

    window.addEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);

    // 1. Read immediately from local IndexedDB cache
    getLocalFavorites()
      .then((cached) => {
        if (isMounted && Array.isArray(cached)) {
          setFavoritesCount(cached.length);
        }
      })
      .catch((err) => debugLog('Error reading local favorites in MobileFooterNav:', err));

    // 2. Refresh from backend to ensure accurate count on any page
    getFavorites()
      .then((favs) => {
        if (isMounted && Array.isArray(favs)) {
          setFavoritesCount(favs.length);
          saveLocalFavorites(favs).catch((err) =>
            debugLog('Failed caching favorites in MobileFooterNav:', err)
          );
        }
      })
      .catch((err) => debugLog('Error fetching favorites in MobileFooterNav:', err));

    return () => {
      isMounted = false;
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    };
  }, [isAuthenticated]);

  const itemClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[11px] font-medium transition-colors ${
      isActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
    }`;

  const showFavoritesShortcut = isAuthenticated && favoritesCount > 2;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe-bottom"
      aria-label={t('footer_nav_label')}
    >
      <div className="flex items-stretch max-w-md mx-auto">
        {/* Home */}
        <Link href="/" className={itemClass(pathname === '/')}>
          <Home className="w-6 h-6" />
          <span>{t('footer_nav_home')}</span>
        </Link>

        {/* Favorites vertical list shortcut (only when authenticated and > 2 favorites) */}
        {showFavoritesShortcut && (
          <Link
            href="/favorites"
            data-testid="mobile-footer-favorites"
            className={itemClass(pathname === '/favorites')}
          >
            <List className="w-6 h-6" />
            <span>{t('footer_nav_favorites')}</span>
          </Link>
        )}

        {/* Search */}
        <Link href="/search" className={itemClass(pathname === '/search')}>
          <Search className="w-6 h-6" />
          <span>{t('footer_nav_search')}</span>
        </Link>

        {/* My Account */}
        <Link href="/account" className={itemClass(pathname === '/account')}>
          <Settings className="w-6 h-6" />
          <span>{t('footer_nav_account')}</span>
        </Link>
      </div>
    </nav>
  );
}
