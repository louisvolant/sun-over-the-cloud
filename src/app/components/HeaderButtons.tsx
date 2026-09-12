// src/components/HeaderButtons.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
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
    <div className="flex items-center space-x-4">
      {/* Language Dropdown */}
      <select
        value={language}
        onChange={handleLanguageChange}
        className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
      </select>

      {isAuthenticated ? (
        <>
          {pathname !== '/account' && (
            <Link href="/account">
              <button className="border border-blue-500 text-blue-500 bg-transparent hover:bg-blue-500 hover:text-white px-4 py-2 rounded-md transition-all duration-300">
                {t('account_button')}
              </button>
            </Link>
          )}
          <button
            className="border border-red-500 text-red-500 bg-transparent hover:bg-red-500 hover:text-white px-4 py-2 rounded-md transition-all duration-300"
            onClick={handleLogout}
          >
            {t('logout_button')}
          </button>
        </>
      ) : (
        <>
          <Link href="/register">
            <button className="border border-primary text-primary bg-transparent hover:bg-primary hover:text-white px-4 py-2 rounded-md transition-all duration-300">
              {t('register_button')}
            </button>
          </Link>
          <button
            className="border border-secondary text-secondary bg-transparent hover:bg-secondary hover:text-white px-4 py-2 rounded-md transition-all duration-300"
            onClick={() => setIsOpen(true)}
          >
            {t('login_button')}
          </button>
        </>
      )}
      <LoginModal isOpen={isOpen} setIsOpen={setIsOpen} />
    </div>
  );
}