// src/components/HeaderButtons.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Settings, Home } from 'lucide-react';
import LoginModal from './LoginModal';

export default function HeaderButtons() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, handleLogout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'fr' | 'es');
  };

  return (
    <>
      {/* Desktop Header Navigation */}
      <div className="hidden md:flex items-center space-x-3">
        {/* Language Dropdown */}
        <select
          value={language}
          onChange={handleLanguageChange}
          aria-label="Select language"
          className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
        </select>

        {isAuthenticated ? (
          <>
            {pathname !== '/account' ? (
              <Link href="/account">
                <button className="flex items-center gap-1.5 border border-blue-500 text-blue-500 bg-transparent hover:bg-blue-500 hover:text-white px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium">
                  <Settings className="w-4 h-4" />
                  <span>{t('account_button')}</span>
                </button>
              </Link>
            ) : (
              <Link href="/">
                <button className="flex items-center gap-1.5 border border-blue-500 text-blue-500 bg-transparent hover:bg-blue-500 hover:text-white px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium">
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
              </Link>
            )}
            <button
              className="border border-red-500 text-red-500 bg-transparent hover:bg-red-500 hover:text-white px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium"
              onClick={handleLogout}
            >
              {t('logout_button')}
            </button>
          </>
        ) : (
          <>
            <Link href="/register">
              <button className="border border-primary text-primary bg-transparent hover:bg-primary hover:text-white px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium">
                {t('register_button')}
              </button>
            </Link>
            <button
              className="border border-secondary text-secondary bg-transparent hover:bg-secondary hover:text-white px-4 py-2 rounded-md transition-all duration-300 text-sm font-medium"
              onClick={() => setIsOpen(true)}
            >
              {t('login_button')}
            </button>
          </>
        )}
      </div>

      {/* Mobile Single-line Header Navigation */}
      <div className="flex md:hidden items-center space-x-2">
        {isAuthenticated ? (
          <Link
            href={pathname === '/account' ? '/' : '/account'}
            title={pathname === '/account' ? 'Home' : t('account_button')}
            aria-label={pathname === '/account' ? 'Home' : t('account_button')}
            className="p-2 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white rounded-md transition-all duration-300 flex items-center justify-center"
          >
            {pathname === '/account' ? <Home className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
          </Link>
        ) : (
          <>
            <Link href="/register">
              <button className="border border-primary text-primary bg-transparent hover:bg-primary hover:text-white px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-300">
                {t('register_button')}
              </button>
            </Link>
            <button
              className="border border-secondary text-secondary bg-transparent hover:bg-secondary hover:text-white px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-300"
              onClick={() => setIsOpen(true)}
            >
              {t('login_button')}
            </button>
          </>
        )}
      </div>

      <LoginModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </>
  );
}