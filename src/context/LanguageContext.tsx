// src/context/LanguageContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import enTranslations from '@/locales/en.json';
import frTranslations from '@/locales/fr.json';
import esTranslations from '@/locales/es.json';

type Language = 'en' | 'fr' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tWeather: (description: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translationsMap: Record<Language, Record<string, string>> = {
  en: enTranslations,
  fr: frTranslations,
  es: esTranslations,
};

const defaultLocaleCodes: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fr' || savedLanguage === 'es')) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('language', lang);
    } catch (e) {
      console.warn('Failed to save language to localStorage:', e);
    }
  }, []);

  const currentTranslations = useMemo(() => {
    return translationsMap[language] || translationsMap.en;
  }, [language]);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translatedText = currentTranslations[key] || translationsMap.en[key] || key;

    if (key === 'locale_code' && (!translatedText || translatedText === 'locale_code')) {
      translatedText = defaultLocaleCodes[language] || 'en-US';
    }

    if (replacements) {
      for (const placeholder in replacements) {
        if (Object.prototype.hasOwnProperty.call(replacements, placeholder)) {
          translatedText = translatedText.replace(`{${placeholder}}`, String(replacements[placeholder]));
        }
      }
    }
    return translatedText;
  }, [currentTranslations, language]);

  const tWeather = useCallback((description: string): string => {
    const key = `weather_${description.toLowerCase().replace(/ /g, '_')}`;
    const translatedValue = t(key);

    if (translatedValue === key) {
      return description;
    } else {
      return translatedValue;
    }
  }, [t]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    tWeather,
  }), [language, setLanguage, t, tWeather]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}