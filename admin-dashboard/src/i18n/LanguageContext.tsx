'use client';

import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';
import { Language, TranslationDict, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDict;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr',
  setLanguage: () => {},
  t: translations.fr,
  dir: 'ltr',
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('fr');
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rma_healthcare_lang') as Language;
      if (saved && (saved === 'fr' || saved === 'en' || saved === 'es' || saved === 'ar')) {
        startTransition(() => {
          setLanguageState(saved);
        });
      } else {
        localStorage.setItem('rma_healthcare_lang', 'fr');
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (lang: Language) => {
    startTransition(() => {
      setLanguageState(lang);
    });
    try {
      localStorage.setItem('rma_healthcare_lang', lang);
    } catch {
      // ignore
    }
  };

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language], dir }}>
      <div dir={dir} className="w-full h-full">
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
