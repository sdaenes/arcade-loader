import React, { createContext, useContext, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('al_lang') || 'fr');

  const setLang = (l) => {
    localStorage.setItem('al_lang', l);
    setLangState(l);
  };

  const t = (key, params) => {
    const dict = translations[lang] || translations.fr;
    const val = dict[key] ?? translations.fr[key];
    if (val === undefined) return key;
    if (typeof val === 'function') return val(params || {});
    if (params && typeof val === 'string') {
      return val.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '');
    }
    return val;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
