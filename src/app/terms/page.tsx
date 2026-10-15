// src/app/terms/page.tsx
'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { FileText, ArrowLeft, CheckCircle2, CloudSun, KeyRound, Scale } from 'lucide-react';

export default function TermsOfServicePage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('back_to_home')}</span>
          </Link>
        </div>

        {/* Legal Document Card */}
        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-10 border border-gray-200 dark:border-gray-700">
          <header className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <FileText className="w-7 h-7" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {t('terms_title')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">
              {t('terms_last_updated')}
            </p>
            <p className="mt-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('terms_intro')}
            </p>
          </header>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Section 1 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                <span>{t('terms_use_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('terms_use_desc')}
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-amber-500 shrink-0" />
                <span>{t('terms_disclaimer_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('terms_disclaimer_desc')}
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-500 shrink-0" />
                <span>{t('terms_account_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('terms_account_desc')}
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{t('terms_liability_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('terms_liability_desc')}
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
