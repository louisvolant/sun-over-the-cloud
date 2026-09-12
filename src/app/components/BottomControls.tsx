// src/app/components/BottomControls.tsx
'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { LogOut } from 'lucide-react';

export default function BottomControls() {
  const { isAuthenticated, handleLogout } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'fr' | 'es');
  };

  return (
    <div className="md:hidden w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-3 px-4 transition-colors">
      <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
        {/* Language Dropdown */}
        <select
          value={language}
          onChange={handleLanguageChange}
          aria-label="Select language"
          className="px-3 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
        </select>

        {/* Logout button (shown on mobile when authenticated) */}
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-500/50 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('logout_button')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
