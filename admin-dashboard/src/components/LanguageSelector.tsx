'use client';

import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Language } from '../i18n/translations';

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="relative inline-flex items-center gap-1.5 bg-slate-900/80 border border-cyan-500/30 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-200 shadow-inner backdrop-blur-md">
      <span className="text-sm">🌐</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-transparent text-slate-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
        aria-label="Select Language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100 py-1">
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};
