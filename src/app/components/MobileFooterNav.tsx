// src/app/components/MobileFooterNav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Settings } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Dev comment:
 * Mobile-only sticky footer navigation, rendered at the bottom of the viewport
 * on every page (hidden on desktop via `md:hidden`).
 *
 * It exposes three actions:
 *  - Home: navigates back to the weather home page.
 *  - Search: opens the mobile search panel. The panel itself lives on the home
 *    page (close to the data it mutates). When the user is already on home we
 *    simply notify it through a custom window event; otherwise we navigate
 *    home with a `?search=open` query param that opens the panel on arrival.
 *  - My Account: navigates to the account management page.
 *
 * The bar is fixed (always visible, app-like) and respects the iOS safe area
 * via the existing `pb-safe-bottom` utility defined in globals.css.
 */
export default function MobileFooterNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const handleSearchClick = () => {
    if (pathname === '/') {
      // Notify the home page to toggle its mobile search panel.
      window.dispatchEvent(new CustomEvent('sotc:toggle-mobile-search'));
    } else {
      // From other pages, go home first; the home page opens the panel
      // when it detects the `search=open` query param.
      router.push('/?search=open');
    }
  };

  const itemClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[11px] font-medium transition-colors ${
      isActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
    }`;

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

        {/* Search */}
        <button
          type="button"
          onClick={handleSearchClick}
          className={itemClass(false)}
          aria-label={t('footer_nav_search')}
        >
          <Search className="w-6 h-6" />
          <span>{t('footer_nav_search')}</span>
        </button>

        {/* My Account */}
        <Link href="/account" className={itemClass(pathname === '/account')}>
          <Settings className="w-6 h-6" />
          <span>{t('footer_nav_account')}</span>
        </Link>
      </div>
    </nav>
  );
}
