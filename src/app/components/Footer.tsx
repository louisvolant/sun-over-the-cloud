// src/components/Footer.tsx
'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { externalLinks } from './links';
import { useTheme } from './ThemeProvider';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const { darkMode, toggleDarkMode } = useTheme();
  const { t } = useLanguage();

  return (
    <footer className="bg-gray-200 dark:bg-gray-800 py-4 pb-[calc(1rem+var(--spacing-safe-bottom))]">
      {/* Single compact row: external links, copyright and theme toggle. */}
      <div className="container mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 text-center text-gray-600 dark:text-gray-300">
        {externalLinks.map((link) => (
          <Fragment key={link.href}>
            <Link
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-800 dark:hover:text-gray-100"
            >
              {link.label}
            </Link>
            <span className="text-gray-400 dark:text-gray-500">|</span>
          </Fragment>
        ))}
        <span>{t('footer_copyright', { year: new Date().getFullYear() })}</span>
        <button
          onClick={toggleDarkMode}
          className="p-2 bg-gray-300 dark:bg-gray-700 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
          aria-label={t('toggle_dark_mode')}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </footer>
  );
}