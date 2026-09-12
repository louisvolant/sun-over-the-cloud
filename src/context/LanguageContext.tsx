// src/context/LanguageContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

type Language = 'en' | 'fr' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tWeather: (description: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type TranslationModule = { default: Record<string, string> };

const loadTranslations = async (lang: Language): Promise<Record<string, string>> => {
  try {
    const mod = await import(`@/locales/${lang}.json`) as TranslationModule;
    return mod.default;
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    const defaultMod = await import(`@/locales/en.json`) as TranslationModule;
    return defaultMod.default;
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [currentTranslations, setCurrentTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const initializeLanguage = async () => {
      const savedLanguage = localStorage.getItem('language') as Language;
      const initialLang: Language = (savedLanguage && ['en', 'fr', 'es'].includes(savedLanguage)) ? savedLanguage : 'en';
      setLanguageState(initialLang);
      const translations = await loadTranslations(initialLang);
      setCurrentTranslations(translations);
    };
    initializeLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    if (language === lang) return;
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    const translations = await loadTranslations(lang);
    setCurrentTranslations(translations);
  }, [language]);

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translatedText = currentTranslations[key] || key;

    if (replacements) {
      for (const placeholder in replacements) {
        if (Object.prototype.hasOwnProperty.call(replacements, placeholder)) {
          translatedText = translatedText.replace(`{${placeholder}}`, String(replacements[placeholder]));
        }
      }
    }
    return translatedText;
  }, [currentTranslations]);

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