// src/app/privacy/page.tsx
'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { ShieldCheck, ArrowLeft, Cookie, Server, Database, UserCheck, HelpCircle } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
                <ShieldCheck className="w-7 h-7" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {t('privacy_title')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic">
              {t('privacy_last_updated')}
            </p>
            <p className="mt-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
              {t('privacy_intro')}
            </p>
          </header>

          <div className="space-y-8 text-gray-700 dark:text-gray-300">
            {/* Section 1 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500 shrink-0" />
                <span>{t('privacy_data_collected_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('privacy_data_collected_desc')}
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Cookie className="w-5 h-5 text-amber-500 shrink-0" />
                <span>{t('privacy_cookies_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('privacy_cookies_desc')}
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500 shrink-0" />
                <span>{t('privacy_third_party_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('privacy_third_party_desc')}
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{t('privacy_rights_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('privacy_rights_desc')}
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-sky-500 shrink-0" />
                <span>{t('privacy_contact_title')}</span>
              </h2>
              <p className="text-sm sm:text-base leading-relaxed pl-7">
                {t('privacy_contact_desc')}
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
